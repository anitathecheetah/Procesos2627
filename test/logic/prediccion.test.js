// Predicción de posiciones (PBI-26): simulación a partir del Elo y servicio con lista de salida.
import test from "node:test";
import assert from "node:assert/strict";
import { generador, simular, crearServicioPrediccion } from "../../server/logic/prediccion.js";
import { crearServicioRanking } from "../../server/logic/ranking.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

const codigo = (c) => (e) => e.codigo === c;

test("el generador con la misma semilla da la misma secuencia, en [0, 1)", () => {
  const a = generador(7); const b = generador(7);
  const xs = Array.from({ length: 5 }, a);
  assert.deepEqual(xs, Array.from({ length: 5 }, b));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, Array.from({ length: 5 }, generador(8)));
});

test("con 400 puntos de diferencia el favorito gana ~91 %, como dice la fórmula Elo", () => {
  const [fuerte, flojo] = simular([{ id: "f", rating: 1900 }, { id: "d", rating: 1500 }], { simulaciones: 20000 });
  assert.ok(Math.abs(fuerte.probVictoria - 1 / (1 + 10 ** -1)) < 0.015, `salió ${fuerte.probVictoria}`);
  assert.ok(Math.abs(fuerte.probVictoria + flojo.probVictoria - 1) < 0.001);
});

test("con el mismo Elo todos tienen las mismas opciones", () => {
  const r = simular(Array.from({ length: 4 }, (_, i) => ({ id: String(i), rating: 1600 })), { simulaciones: 20000 });
  for (const f of r) assert.ok(Math.abs(f.probVictoria - 0.25) < 0.02 && Math.abs(f.posicionMedia - 2.5) < 0.1);
});

test("las probabilidades y posiciones cuadran: una victoria, tres podios y posiciones medias que suman n(n+1)/2", () => {
  const r = simular(Array.from({ length: 12 }, (_, i) => ({ id: String(i), rating: 1400 + i * 40 })));
  const suma = (campo) => r.reduce((s, f) => s + f[campo], 0);
  assert.ok(Math.abs(suma("probVictoria") - 1) < 0.01);
  assert.ok(Math.abs(suma("probPodio") - 3) < 0.02);
  assert.ok(Math.abs(suma("posicionMedia") - 78) < 0.5);
  assert.ok(r[11].posicionMedia < r[0].posicionMedia, "más Elo, mejor posición esperada");
  for (const f of r) assert.ok(f.rango[0] <= f.rango[1] && f.rango[0] >= 1 && f.rango[1] <= 12);
});

test("es repetible: mismos datos, misma predicción", () => {
  const datos = [{ id: "a", rating: 1700 }, { id: "b", rating: 1650 }, { id: "c", rating: 1500 }];
  assert.deepEqual(simular(datos), simular(datos));
});

test("ERROR: con menos de 2 atletas no se puede predecir", () => {
  assert.throws(() => simular([{ id: "a", rating: 1500 }]), codigo("DATOS_INVALIDOS"));
  assert.throws(() => simular([]), codigo("DATOS_INVALIDOS"));
});

// --- Servicio ---
function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const admin = { async exigirAdministrador() {} };
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: admin });
  const importar = async (idExterno, fecha, nombres, extra = {}) =>
    (await importacion.importar("a", { idExterno, nombre: `Prueba ${idExterno}`, deporte: "duatlon", fecha, ...extra },
      await crearExcel(nombres.map((n, i) => finalista(n, 1990 + (n.charCodeAt(0) % 9), "Club Uno", i + 1, i + 1, `00:5${i + 1}:00`))))).prueba;
  return { importar, ranking: crearServicioRanking({ repos, usuarios: admin }), prediccion: crearServicioPrediccion({ repos }) };
}
const NOMBRES = ["Ana Uno", "Beto Dos", "Carla Tres", "Dani Cuatro", "Eva Cinco", "Fran Seis"];

test("con una prueba base, la lista de salida son sus participantes y el favorito es quien tiene más Elo", async () => {
  const { importar, ranking, prediccion } = preparar();
  const base = await importar("1", "2026-02-01", NOMBRES, { sexo: "F" });
  await importar("2", "2026-03-01", NOMBRES, { sexo: "F" });
  await ranking.recalcular("a", "duatlon");
  const r = await prediccion.predecir("duatlon", { base: base.id });
  assert.equal(r.filas.length, 6);
  assert.equal(r.base.id, base.id);
  assert.equal(r.retrospectiva, false);
  assert.equal(r.filas[0].atleta.nombre, "Ana Uno");
  assert.deepEqual(r.filas.map((f) => f.posicionPrevista), [1, 2, 3, 4, 5, 6]);
  assert.ok(r.filas[0].probVictoria > r.filas[5].probVictoria);
  assert.equal(r.filas[0].club.nombre, "Club Uno");
  assert.ok(!("posicionReal" in r.filas[0]));
});

test("sin base usa los mejores del ranking, filtra por sexo y respeta el máximo", async () => {
  const { importar, ranking, prediccion } = preparar();
  await importar("1", "2026-02-01", NOMBRES, { sexo: "F" });
  await importar("2", "2026-03-01", ["Gael Siete", "Hugo Ocho", "Iker Nueve"], { sexo: "M" });
  await ranking.recalcular("a", "duatlon");
  const mujeres = await prediccion.predecir("duatlon", { sexo: "F", maximo: "4" });
  assert.deepEqual(mujeres.filas.map((f) => f.atleta.nombre), ["Ana Uno", "Beto Dos", "Carla Tres", "Dani Cuatro"]);
  assert.equal(mujeres.base, null);
  assert.equal((await prediccion.predecir("duatlon", { sexo: "M" })).filas.length, 3);
});

test("retrospectiva: usa el Elo de antes de la prueba y añade el resultado real y el error", async () => {
  const { importar, ranking, prediccion } = preparar();
  await importar("1", "2026-02-01", NOMBRES);
  const segunda = await importar("2", "2026-03-01", NOMBRES);
  await ranking.recalcular("a", "duatlon");
  const r = await prediccion.predecir("duatlon", { base: segunda.id, retrospectiva: "true" });
  assert.equal(r.retrospectiva, true);
  assert.deepEqual(r.filas.map((f) => f.posicionReal), [1, 2, 3, 4, 5, 6]);
  assert.equal(r.errorMedio, 0, "el orden previsto coincide con el real");
});

test("ERROR: una prueba importada después del último recálculo aún no tiene Elo previo para comparar", async () => {
  const { importar, ranking, prediccion } = preparar();
  await importar("1", "2026-02-01", NOMBRES);
  await ranking.recalcular("a", "duatlon");
  const nueva = await importar("2", "2026-03-01", NOMBRES);
  await assert.rejects(prediccion.predecir("duatlon", { base: nueva.id, retrospectiva: true }), codigo("DATOS_INVALIDOS"));
});

test("ERROR: datos de la petición no válidos", async () => {
  const { importar, ranking, prediccion } = preparar();
  const base = await importar("1", "2026-02-01", NOMBRES);
  await ranking.recalcular("a", "duatlon");
  await assert.rejects(prediccion.predecir("natacion"), codigo("DATOS_INVALIDOS"));
  await assert.rejects(prediccion.predecir("duatlon", { sexo: "X" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(prediccion.predecir("duatlon", { base: "no-existe" }), codigo("NO_ENCONTRADO"));
  await assert.rejects(prediccion.predecir("triatlon", { base: base.id }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(prediccion.predecir("duatlon", { retrospectiva: "true" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(prediccion.predecir("duatlon", { simulaciones: "5" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(prediccion.predecir("duatlon", { maximo: "1" }), codigo("DATOS_INVALIDOS"));
});

test("ERROR: sin ranking calculado no hay con quién predecir", async () => {
  const { prediccion } = preparar();
  await assert.rejects(prediccion.predecir("duatlon"), codigo("DATOS_INVALIDOS"));
});
