import test from "node:test";
import assert from "node:assert/strict";
import { leerResultados, aSegundos } from "../../server/logic/excelResultados.js";
import { crearExcel, finalista, abandono, desplazada, CABECERA } from "../helpers/excelSintetico.js";

test("aSegundos convierte hh:mm:ss y rechaza lo que no es tiempo", () => {
  assert.equal(aSegundos("00:13:52"), 832);
  assert.equal(aSegundos("01:04:39"), 3879);
  assert.equal(aSegundos("00:00:27.5"), 27.5);
  assert.equal(aSegundos("DNF"), null);
  assert.equal(aSegundos("35"), null);
});

test("lee finalistas con posición, tiempo total y los 5 parciales", async () => {
  const buffer = await crearExcel([finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00")]);
  const { resultados, descartadas } = await leerResultados(buffer);
  assert.equal(descartadas.length, 0);
  assert.deepEqual(resultados[0], {
    dorsal: "1", nombre: "Ana López", anioNacimiento: 1995, club: "Club Uno", federacion: "MAD",
    posicion: 1, estado: "finalizado", tiempoTotal: 3120, parciales: [840, 20, 1800, 20, 420], avisos: [],
  });
});

test("un DNF se guarda sin posición ni tiempo total", async () => {
  const buffer = await crearExcel([abandono("Beto Ruiz", 1990, "Club Dos", 5)]);
  const { resultados } = await leerResultados(buffer);
  assert.equal(resultados[0].estado, "dnf");
  assert.equal(resultados[0].posicion, null);
  assert.equal(resultados[0].tiempoTotal, null);
  assert.deepEqual(resultados[0].parciales, [840, 20]);
});

test("DQ y DNS se reconocen", async () => {
  const dq = abandono("Carla Sanz", 1992, "Club", 7); dq[16] = "DQ";
  const dns = abandono("Dani Gil", 1993, "Club", 8); dns[16] = "DNS";
  const { resultados } = await leerResultados(await crearExcel([dq, dns]));
  assert.deepEqual(resultados.map((r) => r.estado), ["dq", "dns"]);
});

test("una fila con las celdas desplazadas se lee bien y avisa de parciales incompletos", async () => {
  const buffer = await crearExcel([desplazada("Eva Mora", 1992, "Club Tres", 9, 40, "00:55:15")]);
  const { resultados } = await leerResultados(buffer);
  assert.equal(resultados[0].posicion, 40);
  assert.equal(resultados[0].tiempoTotal, 3315);
  assert.equal(resultados[0].parciales, null);
  assert.match(resultados[0].avisos[0], /parciales incompletos/);
});

test("ERROR: filas sin año, sin posición o con estado desconocido se descartan con motivo", async () => {
  const sinAnio = finalista("Fran Paz", 1990, "Club", 1, 1, "00:50:00"); sinAnio[8] = null;
  const sinPos = finalista("Gala Rey", 1990, "Club", 2, 2, "00:51:00"); sinPos[14] = null; sinPos[15] = null;
  const raro = abandono("Hugo Vega", 1990, "Club", 3); raro[16] = "XYZ";
  const ok = finalista("Iris Sol", 1990, "Club", 4, 3, "00:52:00");
  const { resultados, descartadas } = await leerResultados(await crearExcel([sinAnio, sinPos, raro, ok]));
  assert.equal(resultados.length, 1);
  assert.deepEqual(descartadas.map((d) => d.fila), [2, 3, 4]);
  assert.match(descartadas[0].motivo, /año de nacimiento/);
  assert.match(descartadas[1].motivo, /posición/);
  assert.match(descartadas[2].motivo, /estado desconocido/);
});

test("las filas vacías del final se ignoran", async () => {
  const vacia = Array(CABECERA.length).fill(null);
  const { resultados, descartadas } = await leerResultados(await crearExcel([finalista("Ana López", 1995, "Club", 1, 1, "00:52:00"), vacia]));
  assert.equal(resultados.length, 1);
  assert.equal(descartadas.length, 0);
});

test("ERROR: un archivo que no es Excel, sin columnas o sin filas se rechaza", async () => {
  const codigo = (e) => e.codigo === "DATOS_INVALIDOS";
  await assert.rejects(leerResultados(Buffer.from("esto no es un excel")), codigo);
  await assert.rejects(leerResultados(await crearExcel([["x"]], ["A", "B"])), (e) => codigo(e) && /Faltan columnas/.test(e.message));
  await assert.rejects(leerResultados(await crearExcel([])), (e) => codigo(e) && /no tiene resultados/.test(e.message));
});

test("las columnas extra a la derecha de TIEMPO se ignoran", async () => {
  const fila = [...finalista("Ana López", 1995, "Club", 1, 1, "00:52:00"), "00:01:00", "00:02:00", 3];
  const { resultados } = await leerResultados(await crearExcel([fila], [...CABECERA, "V1", "V2", "V3"]));
  assert.equal(resultados[0].tiempoTotal, 3120);
  assert.equal(resultados[0].parciales.length, 5);
});

test("sin texto de estado, la posición marcador (10065…) indica que no clasificó: DNF con parciales, DNS sin ellos", async () => {
  const dnf = abandono("Jose Mar", 1990, "Club", 1); dnf[15] = 10065; dnf[16] = null;
  const dns = abandono("Kira Sol", 1991, "Club", 2); dns[9] = null; dns[10] = null; dns[15] = 10066; dns[16] = null;
  const { resultados, descartadas } = await leerResultados(await crearExcel([dnf, dns]));
  assert.equal(descartadas.length, 0);
  assert.deepEqual(resultados.map((r) => r.estado), ["dnf", "dns"]);
  assert.equal(resultados[0].posicion, null);
});

test("un invitado no tiene POSICION pero sí POSICION_FINAL: se usa la final y se marca como invitado", async () => {
  const inv = finalista("Lola Nuño (Invitada)", 1994, "Club", 3, 18, "01:04:45"); inv[14] = null;
  const sig = finalista("Mara Gil", 1994, "Club", 4, 19, "01:04:46"); sig[14] = 18; // POSICION 18, FINAL 19
  const { resultados } = await leerResultados(await crearExcel([inv, sig]));
  assert.equal(resultados[0].posicion, 18);
  assert.equal(resultados[0].invitado, true);
  assert.equal(resultados[1].posicion, 19);
  assert.equal(resultados[1].invitado, undefined);
});
