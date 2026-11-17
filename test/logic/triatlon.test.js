// Triatlón (PBI-19): importa Excel con la cabecera de triatlón y su ranking es independiente del de duatlón.
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioRanking } from "../../server/logic/ranking.js";
import { crearServicioConsulta } from "../../server/logic/consulta.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { CABECERA, crearExcel, finalista } from "../helpers/excelSintetico.js";

// Misma estructura que los Excel de triatlón: el primer parcial es la natación.
const CABECERA_TRIATLON = CABECERA.map((c, i) => (i === 9 ? "NATACION" : c));
const PARCIALES_TRI = ["00:10:00", "00:00:30", "00:32:00", "00:00:25", "00:18:00"];

function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const admin = { async exigirAdministrador() {} };
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: admin });
  return {
    importacion, repos,
    ranking: crearServicioRanking({ repos, usuarios: admin }),
    consulta: crearServicioConsulta({ repos }),
  };
}
const ana = (dorsal, pos, parciales) => finalista("Ana López", 1995, "Club Uno", dorsal, pos, `01:0${pos}:00`, parciales);
const beto = (dorsal, pos, parciales) => finalista("Beto Ruiz", 1990, "Club Dos", dorsal, pos, `01:0${pos}:00`, parciales);
const importar = async (s, idExterno, deporte, fecha, filas, cabecera) =>
  s.importacion.importar("a", { idExterno, nombre: `Prueba ${idExterno}`, deporte, fecha }, await crearExcel(filas, cabecera));

test("importa un Excel de triatlón con la cabecera NATACION y guarda sus 5 parciales", async () => {
  const s = preparar();
  const r = await importar(s, "t1", "triatlon", "2026-05-10", [ana(1, 1, PARCIALES_TRI), beto(2, 2, PARCIALES_TRI)], CABECERA_TRIATLON);
  assert.equal(r.importados, 2);
  assert.deepEqual(r.revisar, [], "los 5 parciales de triatlón no se marcan para revisar");
  const detalle = await s.consulta.detallePrueba((await s.consulta.listarPruebas({ deporte: "triatlon" }))[0].id);
  assert.equal(detalle.prueba.deporte, "triatlon");
  assert.deepEqual(detalle.clasificacion[0].parciales, [600, 30, 1920, 25, 1080]);
});

test("el ranking de triatlón es independiente del de duatlón", async () => {
  const s = preparar();
  await importar(s, "d1", "duatlon", "2026-03-01", [ana(1, 1), beto(2, 2)]);
  await importar(s, "t1", "triatlon", "2026-05-10", [beto(1, 1, PARCIALES_TRI), ana(2, 2, PARCIALES_TRI)], CABECERA_TRIATLON);
  assert.deepEqual(await s.ranking.recalcular("a", "triatlon"), { deporte: "triatlon", pruebas: 1, atletas: 2 });
  assert.equal((await s.ranking.ranking("duatlon")).total, 0, "recalcular triatlón no toca el duatlón");

  await s.ranking.recalcular("a", "duatlon");
  const nombres = (r) => r.filas.map((f) => f.atleta.nombre);
  assert.deepEqual(nombres(await s.ranking.ranking("duatlon")), ["Ana López", "Beto Ruiz"]);
  assert.deepEqual(nombres(await s.ranking.ranking("triatlon")), ["Beto Ruiz", "Ana López"]);
});

test("el ranking de triatlón se puede filtrar por sexo y paginar", async () => {
  const s = preparar();
  await s.importacion.importar("a", { idExterno: "t2", nombre: "Tri F", deporte: "triatlon", fecha: "2026-05-10", sexo: "F" },
    await crearExcel([ana(1, 1, PARCIALES_TRI), beto(2, 2, PARCIALES_TRI)], CABECERA_TRIATLON));
  await s.ranking.recalcular("a", "triatlon");
  assert.equal((await s.ranking.ranking("triatlon", { sexo: "F" })).total, 2);
  assert.equal((await s.ranking.ranking("triatlon", { sexo: "M" })).total, 0);
  assert.equal((await s.ranking.ranking("triatlon", { tamano: 1 })).filas.length, 1);
});
