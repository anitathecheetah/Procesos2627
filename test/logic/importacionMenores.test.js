// Protección de menores: por defecto la importación no guarda a quien pueda ser menor de edad.
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioImportacion, esPosibleMenor } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

function preparar() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const mensajes = [];
  const log = { info: (m, d) => mensajes.push(JSON.stringify([m, d])), warn() {}, error() {}, debug() {} };
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios: { async exigirAdministrador() {} }, log });
  return { repos, mensajes, importacion };
}
const excel = (...anios) => crearExcel(anios.map((a, i) => finalista(`Persona ${a}`, a, "Club Uno", i + 1, i + 1, `00:5${i + 1}:00`)));
const meta = { idExterno: "1", nombre: "P", deporte: "duatlon", fecha: "2026-03-01" };

test("esPosibleMenor: nacidos en el año de la mayoría de edad o después", () => {
  assert.equal(esPosibleMenor(2010, "2026-03-01"), true); // 16
  assert.equal(esPosibleMenor(2008, "2026-03-01"), true); // 17 o 18: prudencia
  assert.equal(esPosibleMenor(2007, "2026-03-01"), false); // 18 o 19 cumplidos
  assert.equal(esPosibleMenor(1995, "2026-03-01"), false);
});

test("por defecto se excluyen los posibles menores y no se guarda nada de ellos", async () => {
  const { importacion, repos, mensajes } = preparar();
  const r = await importacion.importar("a", meta, await excel(1995, 2010, 2008, 2007));
  assert.equal(r.importados, 2);
  assert.equal(r.menoresExcluidos, 2);
  const nombres = (await repos.atletas.listar()).map((a) => a.nombre).sort();
  assert.deepEqual(nombres, ["Persona 1995", "Persona 2007"]);
  assert.equal((await repos.resultados.listar({ pruebaId: r.prueba.id })).length, 2);
  assert.doesNotMatch(JSON.stringify(r.descartadas) + mensajes.join(""), /Persona 2010|Persona 2008/, "ni la respuesta ni el log nombran a los menores");
});

test("soloMayores=false permite importar también a los menores", async () => {
  const { importacion } = preparar();
  const r = await importacion.importar("a", { ...meta, soloMayores: false }, await excel(1995, 2010));
  assert.equal(r.importados, 2);
  assert.equal(r.menoresExcluidos, 0);
});

test("ERROR: si todo el archivo son posibles menores no se crea la prueba y se puede reintentar", async () => {
  const { importacion, repos } = preparar();
  await assert.rejects(importacion.importar("a", meta, await excel(2010, 2011)), (e) => e.codigo === "DATOS_INVALIDOS");
  assert.equal((await repos.pruebas.listar()).length, 0);
  assert.equal((await repos.atletas.listar()).length, 0);
  assert.equal((await importacion.importar("a", meta, await excel(1995, 1990))).importados, 2); // mismo idExterno: sigue libre
});

test("el ranking no cuenta a los menores excluidos: las posiciones de los demás se conservan", async () => {
  const { importacion, repos } = preparar();
  // Llegada: adulto 1.º, menor 2.º, adulto 3.º
  const r = await importacion.importar("a", meta, await excel(1995, 2010, 1990));
  assert.deepEqual((await repos.resultados.listar({ pruebaId: r.prueba.id })).map((x) => x.posicion).sort(), [1, 3]);
});
