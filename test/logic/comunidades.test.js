// Comunidad autónoma de la licencia federativa (PBI-41): catálogo, importación, clasificación y ranking.
import test from "node:test";
import assert from "node:assert/strict";
import { COMUNIDADES, comunidadDeFederacion, nombreComunidad, codigoFederacion } from "../../server/logic/catalogos.js";
import { crearServicioRanking } from "../../server/logic/ranking.js";
import { crearServicioConsulta } from "../../server/logic/consulta.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { crearExcel, finalista, CABECERA } from "../helpers/excelSintetico.js";

test("catálogo: 19 territorios, códigos y alias sin repetirse, y se reconocen sin tildes ni mayúsculas", () => {
  assert.equal(COMUNIDADES.length, 19);
  const claves = COMUNIDADES.flatMap((c) => [c.codigo, ...c.alias]);
  assert.equal(new Set(claves).size, claves.length, "ningún código o alias repetido");
  assert.equal(comunidadDeFederacion("MAD").nombre, "Comunidad de Madrid");
  assert.equal(comunidadDeFederacion(" mad ").nombre, "Comunidad de Madrid");
  assert.equal(comunidadDeFederacion("Andalucía").nombre, "Andalucía");
  assert.equal(comunidadDeFederacion("CV").nombre, "Comunitat Valenciana");
  // En los Excel reales Canarias aparece como CAN y como CNA (los mismos atletas con los dos códigos); Cantabria como CNT.
  assert.deepEqual(["CAN", "CNA", "CNT", "PVA"].map((c) => comunidadDeFederacion(c).nombre), ["Canarias", "Canarias", "Cantabria", "País Vasco"]);
  assert.equal(comunidadDeFederacion("XXX"), null);
  assert.equal(comunidadDeFederacion(null), null);
});

test("nombreComunidad: nombre si se reconoce, el código tal cual si no, null si no hay", () => {
  assert.deepEqual([nombreComunidad("CAT"), nombreComunidad("ZZZ"), nombreComunidad(null), nombreComunidad("")], ["Cataluña", "ZZZ", null, null]);
  assert.equal(codigoFederacion(" ra "), "RA");
});

function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const usuarios = { async exigirAdministrador() {} };
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios });
  // Como finalista(), pero con la federación de la licencia indicada.
  const con = (fed, ...args) => { const f = finalista(...args); f[6] = fed; return f; };
  const importar = async (idExterno, fecha, filas) => importacion.importar("a", { idExterno, nombre: `Prueba ${idExterno}`, deporte: "duatlon", fecha }, await crearExcel(filas));
  return { repos, con, importar, ranking: crearServicioRanking({ repos, usuarios }), consulta: crearServicioConsulta({ repos }) };
}

test("la clasificación muestra la comunidad de la licencia de cada atleta", async () => {
  const { con, importar, consulta } = preparar();
  const { prueba } = await importar("1", "2026-02-01", [
    con("MAD", "Ana López", 1995, "Club Uno", 1, 1, "00:50:00"),
    con("cat", "Beto Ruiz", 1990, "Club Dos", 2, 2, "00:51:00"),
    con("ZZZ", "Carla Sanz", 1992, "Club Tres", 3, 3, "00:52:00"),
  ]);
  const { clasificacion } = await consulta.detallePrueba(prueba.id);
  assert.deepEqual(clasificacion.map((f) => f.comunidad), ["Comunidad de Madrid", "Cataluña", "ZZZ"]);
});

test("el ranking muestra y filtra por comunidad; usa la licencia de la última prueba", async () => {
  const { con, importar, ranking } = preparar();
  await importar("1", "2026-02-01", [
    con("MAD", "Ana López", 1995, "Club Uno", 1, 1, "00:50:00"),
    con("CAT", "Beto Ruiz", 1990, "Club Dos", 2, 2, "00:51:00"),
    con("CAT", "Carla Sanz", 1992, "Club Tres", 3, 3, "00:52:00"),
  ]);
  await importar("2", "2026-03-01", [ // Ana cambia su licencia a Andalucía
    con("AND", "Ana López", 1995, "Club Uno", 1, 1, "00:50:00"),
    con("CAT", "Beto Ruiz", 1990, "Club Dos", 2, 2, "00:51:00"),
  ]);
  await ranking.recalcular("a", "duatlon");
  const todos = await ranking.ranking("duatlon");
  assert.deepEqual(todos.filas.map((f) => [f.atleta.nombre, f.comunidad]), [["Ana López", "Andalucía"], ["Beto Ruiz", "Cataluña"], ["Carla Sanz", "Cataluña"]]);
  const cat = await ranking.ranking("duatlon", { comunidad: "Cataluña" });
  assert.deepEqual([cat.total, cat.filas.map((f) => f.atleta.nombre)], [2, ["Beto Ruiz", "Carla Sanz"]]);
  assert.equal((await ranking.ranking("duatlon", { comunidad: "Galicia" })).total, 0);
  await assert.rejects(ranking.ranking("duatlon", { comunidad: "Atlántida" }), (e) => e.codigo === "DATOS_INVALIDOS");
});

test("un Excel sin columna FEDERACION se importa igual, sin comunidad", async () => {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: { async exigirAdministrador() {} } });
  const cabecera = CABECERA.filter((c) => c !== "FEDERACION");
  const fila = finalista("Ana López", 1995, "Club Uno", 1, 1, "00:50:00");
  fila.splice(6, 1); // quita la celda de la federación
  const r = await importacion.importar("a", { idExterno: "9", nombre: "Sin federación", deporte: "duatlon", fecha: "2026-02-01" }, await crearExcel([fila], cabecera));
  assert.equal(r.importados, 1);
  const [guardado] = await repos.resultados.listar({ pruebaId: r.prueba.id });
  assert.ok(!("federacion" in guardado));
});
