// Ranking de clubes (PBI-20): nota del club = media del Elo de sus mejores atletas.
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioRanking } from "../../server/logic/ranking.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

const codigo = (c) => (e) => e.codigo === c;

function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const admin = { async exigirAdministrador() {} };
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: admin });
  const importar = async (idExterno, fecha, filas, extra = {}) =>
    importacion.importar("a", { idExterno, nombre: `Prueba ${idExterno}`, deporte: "duatlon", fecha, ...extra }, await crearExcel(filas));
  return { importar, ranking: crearServicioRanking({ repos, usuarios: admin }) };
}

// Una carrera: la lista es el orden de llegada. Cada elemento: [nombre, club].
const carrera = (llegada) => llegada.map(([nombre, club], i) => finalista(nombre, 1990 + i, club, i + 1, i + 1, `00:5${i + 1}:00`));
// Norte gana: sus 3 atletas llegan 1.º, 2.º y 3.º; Sur 4.º, 5.º y 6.º; Este solo tiene un atleta (7.º).
const LLEGADA = [
  ["Ana Norte Uno", "Club Norte"], ["Beto Norte Dos", "Club Norte"], ["Carla Norte Tres", "Club Norte"],
  ["Dani Sur Uno", "Club Sur"], ["Eva Sur Dos", "Club Sur"], ["Fran Sur Tres", "Club Sur"],
  ["Gael Este Solo", "Club Este"],
];
const nombresClub = (r) => r.filas.map((f) => f.club.nombre);

test("ordena los clubes por la media del Elo de sus atletas", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-03-01", carrera(LLEGADA));
  await ranking.recalcular("a", "duatlon");
  const r = await ranking.rankingClubes("duatlon");
  assert.deepEqual(nombresClub(r), ["Club Norte", "Club Sur"]);
  assert.deepEqual(r.filas.map((f) => f.posicion), [1, 2]);
  assert.ok(r.filas[0].rating > r.filas[1].rating);
  assert.equal(r.filas[0].atletas, 3);
  assert.deepEqual(r.filas[0].mejores.map((m) => m.nombre), ["Ana Norte Uno", "Beto Norte Dos", "Carla Norte Tres"]);
});

test("la nota es la media de los N mejores (mejores=2 deja fuera al tercero)", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-03-01", carrera(LLEGADA));
  await ranking.recalcular("a", "duatlon");
  const todos = await ranking.rankingClubes("duatlon");
  const dos = await ranking.rankingClubes("duatlon", { mejores: "2" });
  const norte = (x) => x.filas.find((f) => f.club.nombre === "Club Norte");
  assert.equal(norte(dos).mejores.length, 2);
  assert.ok(norte(dos).rating >= norte(todos).rating, "sin el tercero la media no baja");
  const media = norte(dos).mejores.reduce((s, m) => s + m.rating, 0) / 2;
  assert.ok(Math.abs(norte(dos).rating - media) <= 1);
});

test("un club con menos atletas que el mínimo no aparece; con minAtletas=1 sí", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-03-01", carrera(LLEGADA));
  await ranking.recalcular("a", "duatlon");
  assert.ok(!nombresClub(await ranking.rankingClubes("duatlon")).includes("Club Este"));
  assert.ok(nombresClub(await ranking.rankingClubes("duatlon", { minAtletas: "1" })).includes("Club Este"));
});

test("filtra por sexo con los atletas de la categoría de la prueba", async () => {
  const { importar, ranking } = preparar();
  await importar("m", "2026-03-01", carrera(LLEGADA), { sexo: "M" });
  await importar("f", "2026-03-08", carrera(LLEGADA.map(([n, c]) => [`${n} F`, c])), { sexo: "F" });
  await ranking.recalcular("a", "duatlon");
  assert.equal((await ranking.rankingClubes("duatlon", { sexo: "F" })).filas[0].atletas, 3);
  assert.equal((await ranking.rankingClubes("duatlon")).filas[0].atletas, 6, "sin filtro cuentan los dos sexos");
});

test("sin ranking recalculado no hay clubes, y la paginación funciona", async () => {
  const { importar, ranking } = preparar();
  await importar("1", "2026-03-01", carrera(LLEGADA));
  assert.deepEqual((await ranking.rankingClubes("duatlon")).filas, []);
  await ranking.recalcular("a", "duatlon");
  const p2 = await ranking.rankingClubes("duatlon", { pagina: "2", tamano: "1" });
  assert.equal(p2.total, 2);
  assert.deepEqual(nombresClub(p2), ["Club Sur"]);
  assert.equal(p2.filas[0].posicion, 2);
});

test("ERROR: deporte desconocido y parámetros inválidos", async () => {
  const { ranking } = preparar();
  await assert.rejects(ranking.rankingClubes("natacion"), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.rankingClubes("duatlon", { sexo: "X" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.rankingClubes("duatlon", { mejores: "0" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.rankingClubes("duatlon", { minAtletas: "0" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(ranking.rankingClubes("duatlon", { tamano: "500" }), codigo("DATOS_INVALIDOS"));
});
