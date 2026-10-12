// Pruebas unitarias de la capa lógica (sin HTTP) con el repositorio en memoria.
import test from "node:test";
import assert from "node:assert/strict";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearServicioUsuarios } from "../../server/logic/usuarios.js";
import { ErrorLogica } from "../../server/logic/errores.js";

// Cifrador falso y rápido: la prueba con bcrypt real está en cifrador.test.js.
const cifradorFalso = {
  cifrar: async (texto) => `hash(${texto})`,
  comparar: async (texto, hash) => hash === `hash(${texto})`,
};

function preparar() {
  const repo = crearRepositorioMemoria();
  const avisos = [];
  const servicio = crearServicioUsuarios(repo, {
    cifrador: cifradorFalso,
    notificar: (usuario, token) => avisos.push({ usuario, token }),
  });
  return { repo, servicio, avisos };
}
const rechazaCon = (codigo) => (e) => e instanceof ErrorLogica && e.codigo === codigo;

test("el alta crea un usuario pendiente con rol user", async () => {
  const { servicio } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "Ana@Correo.es", password: "secreta123" });
  assert.equal(u.estado, "pendiente");
  assert.equal(u.rol, "user");
  assert.equal(u.email, "ana@correo.es");
  assert.ok(u.id);
});

test("el alta no devuelve datos internos", async () => {
  const { servicio } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  assert.deepEqual(Object.keys(u).sort(), ["email", "estado", "id", "nombre", "rol"]);
});

test("ERROR: un email repetido se rechaza (EMAIL_DUPLICADO)", async () => {
  const { servicio } = preparar();
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await assert.rejects(servicio.alta({ nombre: "Otra", email: "ANA@correo.es", password: "secreta123" }), rechazaCon("EMAIL_DUPLICADO"));
});

test("ERROR: un email con formato inválido se rechaza (DATOS_INVALIDOS)", async () => {
  const { servicio } = preparar();
  await assert.rejects(servicio.alta({ nombre: "Ana", email: "no-es-email", password: "secreta123" }), rechazaCon("DATOS_INVALIDOS"));
});

test("ERROR: un nombre vacío o ausente se rechaza (DATOS_INVALIDOS)", async () => {
  const { servicio } = preparar();
  await assert.rejects(servicio.alta({ nombre: "  ", email: "a@b.es", password: "secreta123" }), rechazaCon("DATOS_INVALIDOS"));
  await assert.rejects(servicio.alta(), rechazaCon("DATOS_INVALIDOS"));
});

test("un administrador lista todos los usuarios", async () => {
  const { repo, servicio } = preparar();
  await repo.crear({ id: "adm", nombre: "Admin", email: "admin@x.es", rol: "admin", estado: "activo" });
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  const lista = await servicio.listar("adm");
  assert.equal(lista.length, 2);
});

test("ERROR: un usuario normal no puede listar (PROHIBIDO)", async () => {
  const { servicio } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await assert.rejects(servicio.listar(u.id), rechazaCon("PROHIBIDO"));
});

test("ERROR: listar sin identificarse o con id desconocido da NO_AUTENTICADO", async () => {
  const { servicio } = preparar();
  await assert.rejects(servicio.listar(undefined), rechazaCon("NO_AUTENTICADO"));
  await assert.rejects(servicio.listar("fantasma"), rechazaCon("NO_AUTENTICADO"));
});

// ---- PBI-05: estado y eliminación ----
async function conAdmin() {
  const { repo, servicio } = preparar();
  await repo.crear({ id: "adm", nombre: "Admin", email: "admin@x.es", rol: "admin", estado: "activo" });
  return { repo, servicio };
}

test("un usuario pendiente no está activo y uno confirmado sí", async () => {
  const { repo, servicio } = await conAdmin();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  assert.deepEqual(await servicio.usuarioActivo("adm", u.id), { id: u.id, activo: false });
  await repo.actualizar({ ...(await repo.buscarPorId(u.id)), estado: "activo" });
  assert.equal((await servicio.usuarioActivo("adm", u.id)).activo, true);
});

test("un usuario eliminado deja de estar activo", async () => {
  const { repo, servicio } = await conAdmin();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await repo.actualizar({ ...(await repo.buscarPorId(u.id)), estado: "activo" });
  await servicio.eliminar("adm", u.id);
  assert.equal((await servicio.usuarioActivo("adm", u.id)).activo, false);
});

test("la eliminación es lógica: el usuario sigue en el repositorio con estado eliminado", async () => {
  const { repo, servicio } = await conAdmin();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await servicio.eliminar(u.id, u.id);
  assert.equal((await repo.buscarPorId(u.id)).estado, "eliminado");
});

test("ERROR: un usuario normal no puede eliminar a otro (PROHIBIDO)", async () => {
  const { servicio } = await conAdmin();
  const a = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  const b = await servicio.alta({ nombre: "Beto", email: "beto@correo.es", password: "secreta123" });
  await assert.rejects(servicio.eliminar(a.id, b.id), rechazaCon("PROHIBIDO"));
});

test("ERROR: eliminar o consultar un id inexistente da NO_ENCONTRADO", async () => {
  const { servicio } = await conAdmin();
  await assert.rejects(servicio.eliminar("adm", "fantasma"), rechazaCon("NO_ENCONTRADO"));
  await assert.rejects(servicio.usuarioActivo("adm", "fantasma"), rechazaCon("NO_ENCONTRADO"));
});

test("ERROR: un usuario normal no puede consultar el estado de otro (PROHIBIDO)", async () => {
  const { servicio } = await conAdmin();
  const a = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await assert.rejects(servicio.usuarioActivo(a.id, a.id), rechazaCon("PROHIBIDO"));
});

test("ERROR: un usuario eliminado ya no puede identificarse (NO_AUTENTICADO)", async () => {
  const { servicio } = await conAdmin();
  const a = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await servicio.eliminar(a.id, a.id);
  await assert.rejects(servicio.eliminar(a.id, a.id), rechazaCon("NO_AUTENTICADO"));
});

// ---- PBI-06: contraseñas, confirmación e inicio de sesión ----
test("la contraseña se guarda con hash, nunca en claro", async () => {
  const { repo, servicio } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  const guardado = await repo.buscarPorId(u.id);
  assert.notEqual(guardado.hash, "secreta123");
  assert.ok(!JSON.stringify(u).includes("hash"));
});

test("ERROR: una contraseña demasiado corta o ausente se rechaza (DATOS_INVALIDOS)", async () => {
  const { servicio } = preparar();
  await assert.rejects(servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "corta" }), rechazaCon("DATOS_INVALIDOS"));
  await assert.rejects(servicio.alta({ nombre: "Ana", email: "ana@correo.es" }), rechazaCon("DATOS_INVALIDOS"));
});

test("el alta avisa al usuario con un token de confirmación", async () => {
  const { servicio, avisos } = preparar();
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  assert.equal(avisos.length, 1);
  assert.ok(avisos[0].token);
});

test("login correcto tras confirmar el email", async () => {
  const { servicio, avisos } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await servicio.confirmar(avisos[0].token);
  const sesion = await servicio.iniciarSesion({ email: "ANA@correo.es", password: "secreta123" });
  assert.equal(sesion.id, u.id);
  assert.equal(sesion.estado, "activo");
});

test("ERROR: contraseña errónea o email desconocido dan CREDENCIALES_INVALIDAS", async () => {
  const { servicio, avisos } = preparar();
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await servicio.confirmar(avisos[0].token);
  await assert.rejects(servicio.iniciarSesion({ email: "ana@correo.es", password: "otra-cosa" }), rechazaCon("CREDENCIALES_INVALIDAS"));
  await assert.rejects(servicio.iniciarSesion({ email: "nadie@correo.es", password: "secreta123" }), rechazaCon("CREDENCIALES_INVALIDAS"));
  await assert.rejects(servicio.iniciarSesion({}), rechazaCon("CREDENCIALES_INVALIDAS"));
});

test("ERROR: una cuenta pendiente no puede iniciar sesión (CUENTA_PENDIENTE)", async () => {
  const { servicio } = preparar();
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await assert.rejects(servicio.iniciarSesion({ email: "ana@correo.es", password: "secreta123" }), rechazaCon("CUENTA_PENDIENTE"));
});

test("ERROR: un token de confirmación inválido o ya usado da NO_ENCONTRADO", async () => {
  const { servicio, avisos } = preparar();
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await assert.rejects(servicio.confirmar("inventado"), rechazaCon("NO_ENCONTRADO"));
  await servicio.confirmar(avisos[0].token);
  await assert.rejects(servicio.confirmar(avisos[0].token), rechazaCon("NO_ENCONTRADO"));
});

test("ERROR: un usuario eliminado no puede iniciar sesión", async () => {
  const { servicio, avisos } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
  await servicio.confirmar(avisos[0].token);
  await servicio.eliminar(u.id, u.id);
  await assert.rejects(servicio.iniciarSesion({ email: "ana@correo.es", password: "secreta123" }), rechazaCon("CREDENCIALES_INVALIDAS"));
});
