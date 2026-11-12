import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { ErrorLogica } from "../../server/logic/errores.js";
import { crearExcel, finalista, abandono, desplazada } from "../helpers/excelSintetico.js";

const meta = { idExterno: "1-1", nombre: "Duatlón de prueba", deporte: "duatlon", fecha: "2026-03-01", sexo: "F" };

function preparar({ admin = true } = {}) {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const dominio = crearServicioDominio(repos);
  const usuarios = { async exigirAdministrador(id) {
    if (!id) throw new ErrorLogica("NO_AUTENTICADO", "Debes identificarte");
    if (!admin) throw new ErrorLogica("PROHIBIDO", "Solo un administrador puede hacer esto");
  } };
  return { repos, dominio, importador: crearServicioImportacion({ repos, dominio, usuarios }) };
}
const codigo = (c) => (e) => e.codigo === c;
const base = () => crearExcel([
  finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00"),
  finalista("Beatriz Ruiz", 1990, "Club Dos", 2, 2, "00:53:00"),
  abandono("Carla Sanz", 1992, "Club Uno", 3),
]);

test("importa la prueba con sus atletas, clubes y resultados", async () => {
  const { repos, importador } = preparar();
  const r = await importador.importar("admin", meta, await base());
  assert.equal(r.importados, 3);
  assert.equal(r.prueba.temporada, "2026");
  assert.equal((await repos.atletas.listar()).length, 3);
  assert.equal((await repos.clubes.listar()).length, 2);
  const resultados = await repos.resultados.listar({ pruebaId: r.prueba.id });
  assert.deepEqual(resultados.map((x) => x.estado).sort(), ["dnf", "finalizado", "finalizado"]);
  assert.equal((await repos.atletas.buscarUno({ clave: "ANA LOPEZ|1995" })).sexo, "F");
});

test("ERROR: reimportar la misma prueba se rechaza y no duplica nada", async () => {
  const { repos, importador } = preparar();
  await importador.importar("admin", meta, await base());
  await assert.rejects(importador.importar("admin", meta, await base()), codigo("DUPLICADO"));
  assert.equal((await repos.pruebas.listar()).length, 1);
  assert.equal((await repos.resultados.listar()).length, 3);
});

test("un atleta que corre dos pruebas es el mismo atleta con dos resultados", async () => {
  const { repos, importador } = preparar();
  await importador.importar("admin", meta, await base());
  await importador.importar("admin", { ...meta, idExterno: "2-2", fecha: "2026-04-01" }, await crearExcel([finalista("ANA LOPEZ", 1995, "CLUB UNO", 9, 3, "00:55:00")]));
  assert.equal((await repos.atletas.listar()).length, 3);
  assert.equal((await repos.resultados.listar({ atletaId: (await repos.atletas.buscarUno({ clave: "ANA LOPEZ|1995" })).id })).length, 2);
  assert.equal((await repos.clubes.listar()).length, 2);
});

test("avisa de homónimos con otro año y de parciales incompletos", async () => {
  const { importador } = preparar();
  await importador.importar("admin", meta, await base());
  const r = await importador.importar("admin", { ...meta, idExterno: "2-2" }, await crearExcel([
    finalista("Ana López", 1996, "Club Uno", 1, 1, "00:52:00"),
    desplazada("Eva Mora", 1992, "Club Tres", 9, 2, "00:55:15"),
  ]));
  assert.equal(r.revisar.length, 2);
  assert.match(r.revisar[0].motivos[0], /otro año de nacimiento \(1995\)/);
  assert.match(r.revisar[1].motivos[0], /parciales incompletos/);
});

test("un atleta repetido dentro del mismo archivo se descarta", async () => {
  const { repos, importador } = preparar();
  const r = await importador.importar("admin", meta, await crearExcel([
    finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00"),
    finalista("ana lopez", 1995, "Club Uno", 2, 2, "00:53:00"),
  ]));
  assert.equal(r.importados, 1);
  assert.match(r.descartadas[0].motivo, /repetido/);
  assert.equal((await repos.resultados.listar()).length, 1);
});

test("el club de la temporada es el de la primera prueba; el de cada prueba queda en el resultado", async () => {
  const { repos, dominio, importador } = preparar();
  await importador.importar("admin", meta, await crearExcel([finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00")]));
  const r2 = await importador.importar("admin", { ...meta, idExterno: "2-2", fecha: "2026-05-01" }, await crearExcel([finalista("Ana López", 1995, "Club Dos", 1, 1, "00:52:00")]));
  const ana = await repos.atletas.buscarUno({ clave: "ANA LOPEZ|1995" });
  assert.equal((await dominio.clubDeAtleta(ana.id, "2026")).nombre, "Club Uno");
  const res = await repos.resultados.buscarUno({ pruebaId: r2.prueba.id, atletaId: ana.id });
  assert.equal((await repos.clubes.buscarPorId(res.clubId)).nombre, "Club Dos");
});

test("ERROR: solo un administrador identificado puede importar", async () => {
  await assert.rejects(preparar({ admin: false }).importador.importar("user", meta, await base()), codigo("PROHIBIDO"));
  await assert.rejects(preparar().importador.importar(undefined, meta, await base()), codigo("NO_AUTENTICADO"));
});

test("ERROR: archivo ausente o inválido, y datos de la prueba inválidos no crean nada", async () => {
  const { repos, importador } = preparar();
  await assert.rejects(importador.importar("admin", meta, undefined), codigo("DATOS_INVALIDOS"));
  await assert.rejects(importador.importar("admin", meta, Buffer.from("basura")), codigo("DATOS_INVALIDOS"));
  await assert.rejects(importador.importar("admin", { ...meta, deporte: "natacion" }, await base()), codigo("DATOS_INVALIDOS"));
  assert.equal((await repos.pruebas.listar()).length, 0);
});

test("si falla a medias se deshace la prueba y se puede reintentar", async () => {
  const { repos, importador } = preparar();
  const original = repos.resultados.crear;
  let n = 0;
  repos.resultados.crear = async (x) => { if (++n === 2) throw new Error("fallo de la base de datos"); return original(x); };
  await assert.rejects(importador.importar("admin", meta, await base()), /fallo de la base/);
  assert.equal((await repos.pruebas.listar()).length, 0);
  assert.equal((await repos.resultados.listar()).length, 0);
  repos.resultados.crear = original;
  assert.equal((await importador.importar("admin", meta, await base())).importados, 3);
});
