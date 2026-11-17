// Eliminar una prueba: borra sus resultados y deja limpios los atletas y clubes que ya no tienen nada.
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioRanking } from "../../server/logic/ranking.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { ErrorLogica } from "../../server/logic/errores.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

function preparar({ admin = true } = {}) {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const usuarios = { async exigirAdministrador(id) {
    if (!id) throw new ErrorLogica("NO_AUTENTICADO", "Debes identificarte");
    if (!admin) throw new ErrorLogica("PROHIBIDO", "Solo un administrador puede hacer esto");
  } };
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios });
  return { repos, importacion, ranking: crearServicioRanking({ repos, usuarios }) };
}
const subir = async (s, idExterno, fecha, filas) =>
  (await s.importacion.importar("a", { idExterno, nombre: `Prueba ${idExterno}`, deporte: "duatlon", fecha }, await crearExcel(filas))).prueba;
const fila = (nombre, anio, club, d, pos) => finalista(nombre, anio, club, d, pos, `00:5${pos}:00`);

test("elimina la prueba, sus resultados y a quien solo estaba en ella; conserva a quien está en otras", async () => {
  const s = preparar();
  const demo = await subir(s, "demo", "2026-01-01", [fila("Ana López", 1995, "Club Real", 1, 1), fila("Demo Uno", 1990, "Club Demo", 2, 2)]);
  await subir(s, "real", "2026-02-01", [fila("Ana López", 1995, "Club Real", 1, 1), fila("Beto Ruiz", 1992, "Club Real", 2, 2)]);

  const r = await s.importacion.eliminarPrueba("a", demo.id);
  assert.deepEqual([r.resultados, r.atletasEliminados, r.clubesEliminados], [2, 1, 1]);
  assert.deepEqual((await s.repos.atletas.listar()).map((a) => a.nombre).sort(), ["Ana López", "Beto Ruiz"]);
  assert.deepEqual((await s.repos.clubes.listar()).map((c) => c.nombre), ["Club Real"]);
  assert.equal(await s.repos.pruebas.buscarPorId(demo.id), null);
  assert.equal((await s.repos.resultados.listar({ pruebaId: demo.id })).length, 0);
});

test("tras recalcular, el ranking solo refleja las pruebas que quedan", async () => {
  const s = preparar();
  const demo = await subir(s, "demo", "2026-01-01", [fila("Demo Uno", 1990, "Club Demo", 1, 1), fila("Ana López", 1995, "Club Real", 2, 2)]);
  await subir(s, "real", "2026-02-01", [fila("Ana López", 1995, "Club Real", 1, 1), fila("Beto Ruiz", 1992, "Club Real", 2, 2)]);
  await s.ranking.recalcular("a", "duatlon");
  assert.equal((await s.ranking.ranking("duatlon")).total, 3);

  await s.importacion.eliminarPrueba("a", demo.id);
  await s.ranking.recalcular("a", "duatlon");
  const r = await s.ranking.ranking("duatlon");
  assert.deepEqual(r.filas.map((f) => [f.atleta.nombre, f.pruebas]), [["Ana López", 1], ["Beto Ruiz", 1]]);
  assert.equal((await s.repos.historialElo.listar({ pruebaId: demo.id })).length, 0);
});

test("se puede volver a importar la misma prueba después de eliminarla", async () => {
  const s = preparar();
  const p = await subir(s, "x", "2026-01-01", [fila("Ana López", 1995, "Club Uno", 1, 1), fila("Beto Ruiz", 1992, "Club Dos", 2, 2)]);
  await s.importacion.eliminarPrueba("a", p.id);
  assert.ok(await subir(s, "x", "2026-01-01", [fila("Ana López", 1995, "Club Uno", 1, 1), fila("Beto Ruiz", 1992, "Club Dos", 2, 2)]));
});

test("ERROR: prueba inexistente (NO_ENCONTRADO), sin sesión y sin ser administrador", async () => {
  const s = preparar();
  await assert.rejects(s.importacion.eliminarPrueba("a", "no-existe"), (e) => e.codigo === "NO_ENCONTRADO");
  await assert.rejects(s.importacion.eliminarPrueba(undefined, "x"), (e) => e.codigo === "NO_AUTENTICADO");
  const sinPermiso = preparar({ admin: false });
  await assert.rejects(sinPermiso.importacion.eliminarPrueba("u", "x"), (e) => e.codigo === "PROHIBIDO");
});
