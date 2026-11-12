import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioConsulta } from "../../server/logic/consulta.js";
import { crearServicioSanciones } from "../../server/logic/sanciones.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { crearExcel, finalista, abandono } from "../helpers/excelSintetico.js";

const admin = { async exigirAdministrador() {} };
const codigo = (c) => (e) => e.codigo === c;

async function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: admin });
  const sanciones = crearServicioSanciones({ repos, usuarios: admin });
  const p1 = (await importacion.importar("a", { idExterno: "1", nombre: "Duatlón A", deporte: "duatlon", fecha: "2026-02-01" }, await crearExcel([
    abandono("Dani Gil", 1993, "Club Dos", 8),
    finalista("Beatriz Ruiz", 1990, "Club Dos", 2, 2, "00:53:00"),
    finalista("Ana López", 1995, "Club Uno", 67, 1, "00:52:00"),
    finalista("Eva Mora", 1992, "Club Uno", 10, 3, "00:54:00"),
  ]))).prueba;
  const p2 = (await importacion.importar("a", { idExterno: "2", nombre: "Triatlón B", deporte: "triatlon", fecha: "2026-05-10" }, await crearExcel([
    finalista("ANA LOPEZ", 1995, "Club Tres", 5, 1, "01:00:00"),
  ]))).prueba;
  await sanciones.cargar("a", p1.id, [{ dorsal: "67", pares: [{ accion: "DSQ", infraccion: "LM" }] }, { dorsal: "2", pares: [{ accion: "ST", infraccion: "LM" }] }]);
  return { repos, p1, p2, consulta: crearServicioConsulta({ repos }) };
}

test("listarPruebas: más recientes primero, con participantes y filtros", async () => {
  const { consulta } = await preparar();
  const todas = await consulta.listarPruebas();
  assert.deepEqual(todas.map((p) => p.nombre), ["Triatlón B", "Duatlón A"]);
  assert.deepEqual(todas.map((p) => p.participantes), [1, 4]);
  assert.deepEqual((await consulta.listarPruebas({ deporte: "duatlon" })).map((p) => p.nombre), ["Duatlón A"]);
  assert.equal((await consulta.listarPruebas({ temporada: "2025" })).length, 0);
});

test("ERROR: deporte o temporada inválidos en el listado", async () => {
  const { consulta } = await preparar();
  await assert.rejects(consulta.listarPruebas({ deporte: "natacion" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(consulta.listarPruebas({ temporada: "26" }), codigo("DATOS_INVALIDOS"));
});

test("detallePrueba: clasificación ordenada (finalistas, descalificados, abandonos) con atleta, club y sanciones", async () => {
  const { consulta, p1 } = await preparar();
  const { prueba, clasificacion } = await consulta.detallePrueba(p1.id);
  assert.equal(prueba.nombre, "Duatlón A");
  assert.deepEqual(clasificacion.map((f) => [f.atleta.nombre, f.estado]), [
    ["Beatriz Ruiz", "finalizado"], ["Eva Mora", "finalizado"], ["Ana López", "dq"], ["Dani Gil", "dnf"],
  ]);
  const beatriz = clasificacion[0];
  assert.equal(beatriz.club.nombre, "Club Dos");
  assert.deepEqual(beatriz.sanciones[0].pares, [{ accion: "ST", infraccion: "LM" }]);
  assert.equal(clasificacion[2].sanciones[0].pares[0].accion, "DSQ"); // la DSQ se ve en el detalle del resultado
});

test("ERROR: prueba inexistente", async () => {
  const { consulta } = await preparar();
  await assert.rejects(consulta.detallePrueba("nada"), codigo("NO_ENCONTRADO"));
});

test("buscarAtletas: sin tildes, sin mayúsculas, en cualquier orden y limitado", async () => {
  const { consulta } = await preparar();
  assert.deepEqual((await consulta.buscarAtletas("lopez")).map((a) => a.nombre), ["Ana López"]);
  assert.deepEqual((await consulta.buscarAtletas("RUIZ beatriz")).map((a) => a.nombre), ["Beatriz Ruiz"]);
  assert.equal((await consulta.buscarAtletas("zzzz")).length, 0);
});

test("ERROR: la búsqueda necesita al menos 2 letras", async () => {
  const { consulta } = await preparar();
  await assert.rejects(consulta.buscarAtletas("a"), codigo("DATOS_INVALIDOS"));
  await assert.rejects(consulta.buscarAtletas(""), codigo("DATOS_INVALIDOS"));
  await assert.rejects(consulta.buscarAtletas(undefined), codigo("DATOS_INVALIDOS"));
});

test("fichaAtleta: clubes por temporada e historial de sus dos pruebas con sanciones", async () => {
  const { consulta } = await preparar();
  const [ana] = await consulta.buscarAtletas("ana lopez");
  const ficha = await consulta.fichaAtleta(ana.id);
  assert.equal(ficha.atleta.anioNacimiento, 1995);
  assert.deepEqual(ficha.clubes.map((c) => [c.temporada, c.club.nombre]), [["2026", "Club Uno"]]); // el club de la temporada es el de la primera prueba
  assert.deepEqual(ficha.resultados.map((r) => [r.prueba.nombre, r.club.nombre, r.estado]), [
    ["Triatlón B", "Club Tres", "finalizado"], ["Duatlón A", "Club Uno", "dq"],
  ]);
  assert.equal(ficha.resultados[1].sanciones[0].pares[0].accion, "DSQ");
});

test("ERROR: atleta inexistente", async () => {
  const { consulta } = await preparar();
  await assert.rejects(consulta.fichaAtleta("nada"), codigo("NO_ENCONTRADO"));
});
