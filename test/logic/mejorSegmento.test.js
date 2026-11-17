// PBI-25: mejor tiempo de cada segmento de una prueba.
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioConsulta, mejoresSegmentos } from "../../server/logic/consulta.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { CABECERA, crearExcel, finalista } from "../helpers/excelSintetico.js";

const CABECERA_TRI = CABECERA.map((c, i) => (i === 9 ? "NATACION" : c));

function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: { async exigirAdministrador() {} } });
  return { importacion, consulta: crearServicioConsulta({ repos }) };
}

test("devuelve el mejor tiempo de cada uno de los 5 segmentos y quién lo hizo", async () => {
  const { importacion, consulta } = preparar();
  const filas = [
    finalista("Ana López", 1995, "Club Uno", 1, 1, "01:00:00", ["00:10:00", "00:00:30", "00:32:00", "00:00:25", "00:18:00"]),
    finalista("Beto Ruiz", 1990, "Club Dos", 2, 2, "01:01:00", ["00:09:00", "00:00:20", "00:33:00", "00:00:30", "00:19:00"]),
  ];
  const r = await importacion.importar("a", { idExterno: "t1", nombre: "Tri", deporte: "triatlon", fecha: "2026-05-10" }, await crearExcel(filas, CABECERA_TRI));
  const { mejoresSegmentos: m } = await consulta.detallePrueba(r.prueba.id);
  assert.deepEqual(m.map((s) => s.tiempo), [540, 20, 1920, 25, 1080]);
  assert.deepEqual(m.map((s) => s.atletas.map((a) => a.nombre)), [["Beto Ruiz"], ["Beto Ruiz"], ["Ana López"], ["Ana López"], ["Ana López"]]);
  assert.equal(m[0].atletas[0].club, "Club Dos");
});

const fila = (id, estado, parciales, club = "C") => ({ estado, parciales, atleta: { id, nombre: id }, club: { nombre: club } });

test("los empates devuelven a todos los atletas empatados", () => {
  const m = mejoresSegmentos([fila("a", "finalizado", [1, 2, 3, 4, 5]), fila("b", "finalizado", [1, 3, 3, 5, 6])]);
  assert.deepEqual(m[0].atletas.map((a) => a.id), ["a", "b"]);
  assert.deepEqual(m[1].atletas.map((a) => a.id), ["a"]);
});

test("no cuentan abandonos, parciales incompletos ni tiempos no válidos", () => {
  const m = mejoresSegmentos([
    fila("dnf", "dnf", [1, 1, 1, 1, 1]),
    fila("corto", "finalizado", [1, 1]),
    fila("nulo", "finalizado", null),
    fila("cero", "finalizado", [0, 2, 3, 4, 5]),
    fila("ok", "finalizado", [10, 20, 30, 40, 50]),
  ]);
  assert.deepEqual(m.map((s) => s.tiempo), [10, 2, 3, 4, 5]);
  assert.equal(m[1].atletas[0].id, "cero");
  assert.equal(m[0].atletas[0].id, "ok", "un 0 en un segmento no es un tiempo válido");
});

test("sin tiempos válidos, cada segmento es null", () => {
  assert.deepEqual(mejoresSegmentos([]), [null, null, null, null, null]);
  assert.deepEqual(mejoresSegmentos([fila("x", "dns", null)]), [null, null, null, null, null]);
});
