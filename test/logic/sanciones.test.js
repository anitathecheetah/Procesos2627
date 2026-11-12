import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioSanciones, leerCsvSanciones } from "../../server/logic/sanciones.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { ErrorLogica } from "../../server/logic/errores.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

async function preparar({ admin = true } = {}) {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const usuarios = { async exigirAdministrador(id) {
    if (!id) throw new ErrorLogica("NO_AUTENTICADO", "Debes identificarte");
    if (!admin) throw new ErrorLogica("PROHIBIDO", "Solo un administrador puede hacer esto");
  } };
  const dominio = crearServicioDominio(repos);
  const siempreAdmin = { async exigirAdministrador() {} }; // la prueba se prepara siempre con permiso
  const { prueba } = await crearServicioImportacion({ repos, dominio, usuarios: siempreAdmin }).importar("admin",
    { idExterno: "1-1", nombre: "Campeonato", deporte: "duatlon", fecha: "2026-03-01" },
    await crearExcel([
      finalista("Ana López", 1995, "Club Uno", 67, 1, "00:52:00"),
      finalista("Beatriz Ruiz", 1990, "Club Dos", 92, 2, "00:53:00"),
      finalista("Carla Sanz", 1992, "Club Uno", 10, 3, "00:54:00"),
    ]));
  return { repos, prueba, sanciones: crearServicioSanciones({ repos, usuarios }) };
}
const codigo = (c) => (e) => e.codigo === c;
const dsq = [{ accion: "DSQ", infraccion: "LM" }, { accion: "DSQ", infraccion: "OTH" }];
const st = [{ accion: "ST", infraccion: "LM" }];
const estadoDe = async (repos, pruebaId, dorsal) => (await repos.resultados.buscarUno({ pruebaId, dorsal })).estado;

test("cargar sanciones las enlaza con el resultado por prueba + dorsal", async () => {
  const { repos, prueba, sanciones } = await preparar();
  const r = await sanciones.cargar("admin", prueba.id, [{ dorsal: "92", pares: st }, { dorsal: 67, pares: dsq, observaciones: "ver acta" }]);
  assert.deepEqual(r, { cargadas: 2, descalificados: 1 });
  const lista = await sanciones.deLaPrueba(prueba.id);
  assert.equal(lista.length, 2);
  const de67 = lista.find((s) => s.dorsal === "67");
  assert.equal(de67.pares.length, 2);
  assert.equal(de67.observaciones, "ver acta");
  assert.equal(de67.resultadoId, (await repos.resultados.buscarUno({ pruebaId: prueba.id, dorsal: "67" })).id);
});

test("una DSQ deja el resultado descalificado y una ST no cambia el estado", async () => {
  const { repos, prueba, sanciones } = await preparar();
  await sanciones.cargar("admin", prueba.id, [{ dorsal: "92", pares: st }, { dorsal: "67", pares: dsq }]);
  assert.equal(await estadoDe(repos, prueba.id, "67"), "dq");
  assert.equal(await estadoDe(repos, prueba.id, "92"), "finalizado");
  assert.equal(await estadoDe(repos, prueba.id, "10"), "finalizado");
});

test("recargar un dorsal sustituye la sanción y, si ya no hay DSQ, recupera el estado", async () => {
  const { repos, prueba, sanciones } = await preparar();
  await sanciones.cargar("admin", prueba.id, [{ dorsal: "67", pares: dsq }]);
  await sanciones.cargar("admin", prueba.id, [{ dorsal: "67", pares: st }]);
  assert.equal((await sanciones.deLaPrueba(prueba.id)).length, 1);
  assert.equal(await estadoDe(repos, prueba.id, "67"), "finalizado");
});

test("ERROR: dorsal inexistente, código desconocido y datos incompletos devuelven error claro y no guardan nada", async () => {
  const { prueba, sanciones } = await preparar();
  const ok = { dorsal: "67", pares: st };
  await assert.rejects(sanciones.cargar("admin", prueba.id, [ok, { dorsal: "999", pares: st }]), (e) => codigo("NO_ENCONTRADO")(e) && /999/.test(e.message));
  await assert.rejects(sanciones.cargar("admin", prueba.id, [ok, { dorsal: "92", pares: [{ accion: "XX", infraccion: "LM" }] }]), (e) => codigo("DATOS_INVALIDOS")(e) && /XX/.test(e.message));
  await assert.rejects(sanciones.cargar("admin", prueba.id, [{ dorsal: "92", pares: [{ accion: "ST", infraccion: "ZZ" }] }]), codigo("DATOS_INVALIDOS"));
  await assert.rejects(sanciones.cargar("admin", prueba.id, [{ dorsal: "92", pares: [] }]), codigo("DATOS_INVALIDOS"));
  await assert.rejects(sanciones.cargar("admin", prueba.id, [{ dorsal: "", pares: st }]), codigo("DATOS_INVALIDOS"));
  await assert.rejects(sanciones.cargar("admin", prueba.id, [ok, ok]), /repetido/);
  await assert.rejects(sanciones.cargar("admin", prueba.id, [{ dorsal: "92", pares: [...st, ...st, ...st, ...st] }]), /máximo 3/);
  assert.equal((await sanciones.deLaPrueba(prueba.id)).length, 0); // ninguna carga fallida dejó datos
});

test("ERROR: solo un administrador, y la prueba debe existir", async () => {
  const { prueba, sanciones } = await preparar();
  await assert.rejects(sanciones.cargar(undefined, prueba.id, [{ dorsal: "67", pares: st }]), codigo("NO_AUTENTICADO"));
  await assert.rejects(sanciones.cargar("admin", "nada", [{ dorsal: "67", pares: st }]), codigo("NO_ENCONTRADO"));
  await assert.rejects(sanciones.deLaPrueba("nada"), codigo("NO_ENCONTRADO"));
  const sinPermiso = await preparar({ admin: false });
  await assert.rejects(sinPermiso.sanciones.cargar("user", sinPermiso.prueba.id, [{ dorsal: "67", pares: st }]), codigo("PROHIBIDO"));
});

test("leerCsvSanciones lee separador ; o , con o sin cabecera y observaciones", () => {
  const a = leerCsvSanciones("dorsal;accion1;infraccion1;accion2;infraccion2\n67;dsq;lm;DSQ;OTH\n92;ST;LM\n\n");
  assert.deepEqual(a.map((f) => [f.dorsal, f.pares.length]), [["67", 2], ["92", 1]]);
  assert.equal(a[0].pares[0].accion, "DSQ");
  const b = leerCsvSanciones("92,ST,LM,,,,,fuera de la línea, por poco");
  assert.equal(b[0].observaciones, "fuera de la línea, por poco");
  assert.equal(b[0].pares.length, 1);
});

test("ERROR: un CSV vacío o solo con cabecera se rechaza", () => {
  assert.throws(() => leerCsvSanciones(""), codigo("DATOS_INVALIDOS"));
  assert.throws(() => leerCsvSanciones(undefined), codigo("DATOS_INVALIDOS"));
  assert.throws(() => leerCsvSanciones("dorsal;accion1;infraccion1\n"), codigo("DATOS_INVALIDOS"));
});
