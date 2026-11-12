import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioRanking } from "../../server/logic/ranking.js";
import { crearServicioConsulta } from "../../server/logic/consulta.js";
import { crearServicioSanciones } from "../../server/logic/sanciones.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { ErrorLogica } from "../../server/logic/errores.js";
import { crearExcel, finalista, abandono } from "../helpers/excelSintetico.js";

const codigo = (c) => (e) => e.codigo === c;

function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const permiso = (esAdmin) => ({ async exigirAdministrador(id) {
    if (!id) throw new ErrorLogica("NO_AUTENTICADO", "Debes identificarte");
    if (!esAdmin) throw new ErrorLogica("PROHIBIDO", "Solo un administrador puede hacer esto");
  } });
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: permiso(true) });
  const importar = (idExterno, fecha, filas, deporte = "duatlon") =>
    crearExcel(filas).then((b) => importacion.importar("a", { idExterno, nombre: `Prueba ${idExterno}`, deporte, fecha }, b));
  return {
    repos, importar,
    ranking: crearServicioRanking({ repos, usuarios: permiso(true) }),
    rankingSinPermiso: crearServicioRanking({ repos, usuarios: permiso(false) }),
    sanciones: crearServicioSanciones({ repos, usuarios: permiso(true) }),
    consulta: crearServicioConsulta({ repos }),
  };
}
const A = (d, pos) => finalista("Ana López", 1995, "Club Uno", d, pos, "00:5" + pos + ":00");
const B = (d, pos) => finalista("Beto Ruiz", 1990, "Club Dos", d, pos, "00:5" + pos + ":00");
const C = (d, pos) => finalista("Carla Sanz", 1992, "Club Tres", d, pos, "00:5" + pos + ":00");
const nombres = (r) => r.filas.map((f) => f.atleta.nombre);

test("tras una carrera, el ganador está arriba y los puntos se conservan", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-02-01", [A(1, 1), B(2, 2), C(3, 3)]);
  assert.deepEqual(await ranking.recalcular("a", "duatlon"), { deporte: "duatlon", pruebas: 1, atletas: 3 });
  const r = await ranking.ranking("duatlon");
  assert.deepEqual(nombres(r), ["Ana López", "Beto Ruiz", "Carla Sanz"]);
  assert.deepEqual(r.filas.map((f) => f.posicion), [1, 2, 3]);
  assert.equal(r.filas.reduce((s, f) => s + f.rating, 0), 4500);
  assert.equal(r.filas[0].club.nombre, "Club Uno");
  assert.equal(r.filas[0].pruebas, 1);
});

test("el orden cronológico importa: la última prueba corrige el ranking", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-02-01", [A(1, 1), B(2, 2)]);
  await importar("2", "2026-03-01", [B(1, 1), A(2, 2)]);
  await importar("3", "2026-04-01", [B(1, 1), A(2, 2)]);
  await ranking.recalcular("a", "duatlon");
  assert.deepEqual(nombres(await ranking.ranking("duatlon")), ["Beto Ruiz", "Ana López"]);
});

test("el recálculo es determinista: importar en otro orden y recalcular da el mismo ranking", async () => {
  const x = preparar(); const y = preparar();
  const pruebas = [["1", "2026-02-01", [A(1, 1), B(2, 2), C(3, 3)]], ["2", "2026-03-01", [C(1, 1), A(2, 2), B(3, 3)]], ["3", "2026-03-01", [B(1, 1), C(2, 2)]]];
  for (const p of pruebas) await x.importar(...p);
  for (const p of [...pruebas].reverse()) await y.importar(...p);
  await x.ranking.recalcular("a", "duatlon"); await x.ranking.recalcular("a", "duatlon"); // dos veces
  await y.ranking.recalcular("a", "duatlon");
  const sinIds = (r) => r.filas.map(({ posicion, atleta, club, rating, pruebas }) => ({ posicion, atleta: atleta.nombre, club: club.nombre, rating, pruebas }));
  assert.deepEqual(sinIds(await x.ranking.ranking("duatlon")), sinIds(await y.ranking.ranking("duatlon"))); // los ids internos son aleatorios, el ranking no
});

test("DNF, DNS y descalificados no puntúan en esa prueba (por estado y por sanción DSQ)", async () => {
  const { importar, ranking, sanciones } = preparar();
  const { prueba } = await importar("1", "2026-02-01", [A(1, 1), B(2, 2), C(3, 3), abandono("Dani Gil", 1993, "Club", 8)]);
  await sanciones.cargar("a", prueba.id, [{ dorsal: "1", pares: [{ accion: "DSQ", infraccion: "LM" }] }]);
  await ranking.recalcular("a", "duatlon");
  const r = await ranking.ranking("duatlon");
  assert.deepEqual(nombres(r), ["Beto Ruiz", "Carla Sanz"]); // Ana (DSQ) y Dani (DNF) fuera
  assert.equal(r.total, 2);
});

test("una prueba con menos de 2 que puntúen no mueve a nadie ni cuenta", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-02-01", [A(1, 1)]);
  assert.deepEqual(await ranking.recalcular("a", "duatlon"), { deporte: "duatlon", pruebas: 0, atletas: 0 });
});

test("cada deporte tiene su ranking independiente", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-02-01", [A(1, 1), B(2, 2)], "duatlon");
  await importar("2", "2026-03-01", [B(1, 1), A(2, 2)], "triatlon");
  await ranking.recalcular("a", "duatlon"); await ranking.recalcular("a", "triatlon");
  assert.deepEqual(nombres(await ranking.ranking("duatlon")), ["Ana López", "Beto Ruiz"]);
  assert.deepEqual(nombres(await ranking.ranking("triatlon")), ["Beto Ruiz", "Ana López"]);
});

test("recalcular después de importar más pruebas actualiza el ranking", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-02-01", [A(1, 1), B(2, 2)]);
  await ranking.recalcular("a", "duatlon");
  assert.equal((await ranking.ranking("duatlon")).filas[0].pruebas, 1);
  await importar("2", "2026-03-01", [A(1, 1), B(2, 2)]);
  await ranking.recalcular("a", "duatlon");
  assert.equal((await ranking.ranking("duatlon")).filas[0].pruebas, 2);
});

test("paginación y mínimo de pruebas", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-02-01", [A(1, 1), B(2, 2), C(3, 3)]);
  await importar("2", "2026-03-01", [A(1, 1), B(2, 2)]);
  await ranking.recalcular("a", "duatlon");
  const p2 = await ranking.ranking("duatlon", { pagina: "2", tamano: "2" });
  assert.equal(p2.total, 3);
  assert.deepEqual(p2.filas.map((f) => f.posicion), [3]);
  assert.deepEqual(nombres(await ranking.ranking("duatlon", { minPruebas: "2" })), ["Ana López", "Beto Ruiz"]);
});

test("el historial de rating de cada atleta se conserva y sale en su ficha", async () => {
  const { importar, ranking, consulta } = preparar();
  await importar("1", "2026-02-01", [A(1, 1), B(2, 2)]);
  await importar("2", "2026-03-01", [B(1, 1), A(2, 2)]);
  await ranking.recalcular("a", "duatlon");
  const [ana] = await consulta.buscarAtletas("ana lopez");
  const { elo } = await consulta.fichaAtleta(ana.id);
  assert.equal(elo.length, 1);
  assert.equal(elo[0].deporte, "duatlon");
  assert.deepEqual(elo[0].historial.map((h) => [h.fecha, h.antes]), [["2026-02-01", 1500], ["2026-03-01", elo[0].historial[0].despues]]);
  assert.equal(elo[0].historial[1].despues, elo[0].rating);
});

test("ERROR: deporte desconocido, parámetros inválidos y permisos", async () => {
  const { ranking, rankingSinPermiso } = preparar();
  await assert.rejects(ranking.ranking("natacion"), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.ranking("duatlon", { pagina: "0" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.ranking("duatlon", { tamano: "1000" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.ranking("duatlon", { pagina: "x" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.recalcular("a", "natacion"), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.recalcular(undefined, "duatlon"), codigo("NO_AUTENTICADO"));
  await assert.rejects(rankingSinPermiso.recalcular("u", "duatlon"), codigo("PROHIBIDO"));
});

test("sin recalcular el ranking está vacío, no falla", async () => {
  const { ranking } = preparar();
  assert.deepEqual(await ranking.ranking("duatlon"), { deporte: "duatlon", total: 0, pagina: 1, tamano: 50, filas: [] });
});

test("el ranking se puede filtrar por sexo (el del atleta, tomado de la categoría de la prueba)", async () => {
  const { importar, ranking, repos } = preparar();
  const importarCon = async (id, fecha, filas, sexo) => {
    const { crearServicioImportacion } = await import("../../server/logic/importacion.js");
    const { crearServicioDominio } = await import("../../server/logic/dominio.js");
    return crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: { async exigirAdministrador() {} } })
      .importar("a", { idExterno: id, nombre: id, deporte: "duatlon", fecha, sexo }, await crearExcel(filas));
  };
  await importarCon("h", "2026-02-01", [A(1, 1), B(2, 2)], "M");
  await importarCon("m", "2026-02-01", [finalista("Marta Gil", 1999, "Club", 5, 1, "01:00:00"), finalista("Nuria Sol", 1998, "Club", 6, 2, "01:01:00")], "F");
  await ranking.recalcular("a", "duatlon");
  assert.deepEqual(nombres(await ranking.ranking("duatlon", { sexo: "F" })), ["Marta Gil", "Nuria Sol"]);
  assert.deepEqual(nombres(await ranking.ranking("duatlon", { sexo: "M" })), ["Ana López", "Beto Ruiz"]);
  assert.equal((await ranking.ranking("duatlon")).total, 4);
  await assert.rejects(ranking.ranking("duatlon", { sexo: "X" }), codigo("DATOS_INVALIDOS"));
});
