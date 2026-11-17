// Cambio de contraseña (PBI-21): la lógica exige la contraseña actual y la política de contraseñas.
import test from "node:test";
import assert from "node:assert/strict";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearServicioUsuarios } from "../../server/logic/usuarios.js";
import { ErrorLogica } from "../../server/logic/errores.js";

const cifradorFalso = {
  cifrar: async (texto) => `hash(${texto})`,
  comparar: async (texto, hash) => hash === `hash(${texto})`,
};
const rechazaCon = (codigo, texto) => (e) => e instanceof ErrorLogica && e.codigo === codigo && (!texto || texto.test(e.message));

async function preparar() {
  const repo = crearRepositorioMemoria();
  const mensajes = [];
  const log = { info: (m, d) => mensajes.push([m, d]), warn: (m, d) => mensajes.push([m, d]), error() {}, debug() {} };
  const servicio = crearServicioUsuarios(repo, { cifrador: cifradorFalso, log });
  const usuario = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "ClaveActual1" });
  const guardado = await repo.buscarPorId(usuario.id);
  await repo.actualizar({ ...guardado, estado: "activo" });
  return { repo, servicio, id: usuario.id, mensajes };
}

test("cambia la contraseña: la nueva sirve para entrar y la anterior ya no", async () => {
  const { servicio, id } = await preparar();
  await servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: "ClaveNuevaLarga9" });
  assert.ok(await servicio.iniciarSesion({ email: "ana@correo.es", password: "ClaveNuevaLarga9" }));
  await assert.rejects(servicio.iniciarSesion({ email: "ana@correo.es", password: "ClaveActual1" }), rechazaCon("CREDENCIALES_INVALIDAS"));
});

test("la contraseña se guarda cifrada y no se escribe en el log", async () => {
  const { servicio, repo, id, mensajes } = await preparar();
  await servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: "ClaveNuevaLarga9" });
  assert.equal((await repo.buscarPorId(id)).hash, "hash(ClaveNuevaLarga9)");
  assert.doesNotMatch(JSON.stringify(mensajes), /ClaveNuevaLarga9|ClaveActual1/);
});

test("ERROR: la contraseña actual incorrecta se rechaza y no cambia nada", async () => {
  const { servicio, repo, id } = await preparar();
  await assert.rejects(
    servicio.cambiarPassword(id, { actual: "OtraCosa123", nueva: "ClaveNuevaLarga9" }),
    rechazaCon("DATOS_INVALIDOS", /actual no es correcta/),
  );
  assert.equal((await repo.buscarPorId(id)).hash, "hash(ClaveActual1)");
});

test("ERROR: la nueva debe cumplir la política (longitud, número y mayúscula)", async () => {
  const { servicio, id } = await preparar();
  await assert.rejects(servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: "Corta1A" }), rechazaCon("DATOS_INVALIDOS", /10 caracteres/));
  await assert.rejects(servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: "SinNumeroAquiNo" }), rechazaCon("DATOS_INVALIDOS", /número/));
  await assert.rejects(servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: "sinmayuscula123" }), rechazaCon("DATOS_INVALIDOS", /mayúscula/));
});

test("ERROR: la nueva no puede ser igual a la actual", async () => {
  const { servicio, id } = await preparar();
  await assert.rejects(servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: "ClaveActual1" }), rechazaCon("DATOS_INVALIDOS"));
});

test("ERROR: faltan datos o no son texto", async () => {
  const { servicio, id } = await preparar();
  await assert.rejects(servicio.cambiarPassword(id, {}), rechazaCon("DATOS_INVALIDOS"));
  await assert.rejects(servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: 12345 }), rechazaCon("DATOS_INVALIDOS"));
  await assert.rejects(servicio.cambiarPassword(id), rechazaCon("DATOS_INVALIDOS"));
});

test("ERROR: sin identificar, o con la cuenta eliminada, no se puede cambiar", async () => {
  const { servicio, id } = await preparar();
  await assert.rejects(servicio.cambiarPassword(undefined, { actual: "ClaveActual1", nueva: "ClaveNuevaLarga9" }), rechazaCon("NO_AUTENTICADO"));
  await servicio.eliminar(id, id);
  await assert.rejects(servicio.cambiarPassword(id, { actual: "ClaveActual1", nueva: "ClaveNuevaLarga9" }), rechazaCon("NO_AUTENTICADO"));
});
