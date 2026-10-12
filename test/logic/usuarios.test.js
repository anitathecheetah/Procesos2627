// Pruebas unitarias de la capa lógica (sin HTTP) con el repositorio en memoria.
import test from "node:test";
import assert from "node:assert/strict";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearServicioUsuarios } from "../../server/logic/usuarios.js";
import { ErrorLogica } from "../../server/logic/errores.js";

function preparar() {
  const repo = crearRepositorioMemoria();
  return { repo, servicio: crearServicioUsuarios(repo) };
}
const rechazaCon = (codigo) => (e) => e instanceof ErrorLogica && e.codigo === codigo;

test("el alta crea un usuario pendiente con rol user", async () => {
  const { servicio } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "Ana@Correo.es" });
  assert.equal(u.estado, "pendiente");
  assert.equal(u.rol, "user");
  assert.equal(u.email, "ana@correo.es");
  assert.ok(u.id);
});

test("el alta no devuelve datos internos", async () => {
  const { servicio } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es" });
  assert.deepEqual(Object.keys(u).sort(), ["email", "estado", "id", "nombre", "rol"]);
});

test("ERROR: un email repetido se rechaza (EMAIL_DUPLICADO)", async () => {
  const { servicio } = preparar();
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es" });
  await assert.rejects(servicio.alta({ nombre: "Otra", email: "ANA@correo.es" }), rechazaCon("EMAIL_DUPLICADO"));
});

test("ERROR: un email con formato inválido se rechaza (DATOS_INVALIDOS)", async () => {
  const { servicio } = preparar();
  await assert.rejects(servicio.alta({ nombre: "Ana", email: "no-es-email" }), rechazaCon("DATOS_INVALIDOS"));
});

test("ERROR: un nombre vacío o ausente se rechaza (DATOS_INVALIDOS)", async () => {
  const { servicio } = preparar();
  await assert.rejects(servicio.alta({ nombre: "  ", email: "a@b.es" }), rechazaCon("DATOS_INVALIDOS"));
  await assert.rejects(servicio.alta(), rechazaCon("DATOS_INVALIDOS"));
});

test("un administrador lista todos los usuarios", async () => {
  const { repo, servicio } = preparar();
  await repo.crear({ id: "adm", nombre: "Admin", email: "admin@x.es", rol: "admin", estado: "activo" });
  await servicio.alta({ nombre: "Ana", email: "ana@correo.es" });
  const lista = await servicio.listar("adm");
  assert.equal(lista.length, 2);
});

test("ERROR: un usuario normal no puede listar (PROHIBIDO)", async () => {
  const { servicio } = preparar();
  const u = await servicio.alta({ nombre: "Ana", email: "ana@correo.es" });
  await assert.rejects(servicio.listar(u.id), rechazaCon("PROHIBIDO"));
});

test("ERROR: listar sin identificarse o con id desconocido da NO_AUTENTICADO", async () => {
  const { servicio } = preparar();
  await assert.rejects(servicio.listar(undefined), rechazaCon("NO_AUTENTICADO"));
  await assert.rejects(servicio.listar("fantasma"), rechazaCon("NO_AUTENTICADO"));
});
