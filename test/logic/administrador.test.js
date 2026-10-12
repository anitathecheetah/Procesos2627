// Pruebas de roles: administrador inicial (ADMIN_EMAIL) y logging.
import test from "node:test";
import assert from "node:assert/strict";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearServicioUsuarios } from "../../server/logic/usuarios.js";
import { crearLogger } from "../../server/logger.js";

const cifrador = {
  cifrar: async (t) => `hash(${t})`,
  comparar: async (t, h) => h === `hash(${t})`,
};
const datos = (email) => ({ nombre: "Ana", email, password: "secreta123" });

function preparar(opciones = {}) {
  const repo = crearRepositorioMemoria();
  return { repo, servicio: crearServicioUsuarios(repo, { cifrador, ...opciones }) };
}

test("quien se registra con ADMIN_EMAIL (sin importar mayúsculas) recibe rol admin", async () => {
  const { servicio } = preparar({ emailAdmin: "Jefa@Correo.es" });
  assert.equal((await servicio.alta(datos("jefa@correo.es"))).rol, "admin");
});

test("un usuario con otro email recibe rol user", async () => {
  const { servicio } = preparar({ emailAdmin: "jefa@correo.es" });
  assert.equal((await servicio.alta(datos("otra@correo.es"))).rol, "user");
});

test("el arranque promociona al usuario existente y es idempotente", async () => {
  const { repo, servicio } = preparar();
  const u = await servicio.alta(datos("jefa@correo.es"));
  assert.equal(u.rol, "user");

  const conAdmin = crearServicioUsuarios(repo, { cifrador, emailAdmin: "jefa@correo.es" });
  assert.equal(await conAdmin.asegurarAdministrador(), true);
  assert.equal(await conAdmin.asegurarAdministrador(), true); // segunda vez: mismo resultado
  assert.equal((await repo.buscarPorId(u.id)).rol, "admin");
  assert.equal((await repo.listar()).length, 1); // no se duplica
});

test("el arranque sin ADMIN_EMAIL o con un email sin registrar no cambia nada", async () => {
  const { repo, servicio } = preparar();
  assert.equal(await servicio.asegurarAdministrador(), false);
  const conAdmin = crearServicioUsuarios(repo, { cifrador, emailAdmin: "nadie@correo.es" });
  assert.equal(await conAdmin.asegurarAdministrador(), false);
  assert.equal((await repo.listar()).length, 0);
});

test("el log registra altas, logins fallidos y eliminaciones sin contraseñas", async () => {
  const lineas = [];
  const salida = { log: (l) => lineas.push(l), warn: (l) => lineas.push(l), error: (l) => lineas.push(l) };
  const { servicio } = preparar({ log: crearLogger({ nivel: "info", salida }) });
  const u = await servicio.alta(datos("ana@correo.es"));
  await servicio.iniciarSesion({ email: "ana@correo.es", password: "mala-mala" }).catch(() => {});
  await servicio.eliminar(u.id, u.id);

  const texto = lineas.join("\n");
  assert.match(texto, /INFO Usuario registrado/);
  assert.match(texto, /WARN Inicio de sesión fallido/);
  assert.match(texto, /INFO Usuario eliminado/);
  assert.ok(!texto.includes("secreta123") && !texto.includes("mala-mala") && !texto.includes("hash("));
});

test("el nivel del log filtra los mensajes menos importantes", () => {
  const lineas = [];
  const salida = { log: (l) => lineas.push(l), warn: (l) => lineas.push(l), error: (l) => lineas.push(l) };
  const log = crearLogger({ nivel: "warn", salida });
  log.info("no sale");
  log.warn("sale");
  assert.equal(lineas.length, 1);
});
