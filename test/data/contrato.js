// Pruebas de contrato del repositorio de usuarios: la MISMA batería se ejecuta contra la
// implementación en memoria y contra MongoDB. Si ambas pasan, la capa lógica no nota el cambio.
import test from "node:test";
import assert from "node:assert/strict";

const usuario = (id, email, extra = {}) => ({ id, nombre: id, email, rol: "user", estado: "pendiente", ...extra });

// preparar() devuelve { repo, limpiar } con un repositorio vacío.
export function pruebasDeContrato(nombre, preparar, opciones = {}) {
  const prueba = (titulo, fn) =>
    test(`[${nombre}] ${titulo}`, opciones, async () => {
      const { repo, limpiar } = await preparar();
      try { await fn(repo); } finally { await limpiar(); }
    });

  prueba("crear y buscar por id", async (repo) => {
    await repo.crear(usuario("u1", "ana@correo.es"));
    assert.deepEqual(await repo.buscarPorId("u1"), usuario("u1", "ana@correo.es"));
  });

  prueba("buscar por id inexistente devuelve null", async (repo) => {
    assert.equal(await repo.buscarPorId("nada"), null);
  });

  prueba("buscar por email", async (repo) => {
    await repo.crear(usuario("u1", "ana@correo.es"));
    assert.equal((await repo.buscarPorEmail("ana@correo.es")).id, "u1");
    assert.equal(await repo.buscarPorEmail("otro@correo.es"), null);
  });

  prueba("buscar por token de confirmación", async (repo) => {
    await repo.crear(usuario("u1", "ana@correo.es", { tokenConfirmacion: "tok-1" }));
    assert.equal((await repo.buscarPorToken("tok-1")).id, "u1");
    assert.equal(await repo.buscarPorToken("otro"), null);
    assert.equal(await repo.buscarPorToken(undefined), null);
  });

  prueba("listar devuelve todos los usuarios", async (repo) => {
    await repo.crear(usuario("u1", "ana@correo.es"));
    await repo.crear(usuario("u2", "beto@correo.es"));
    assert.deepEqual((await repo.listar()).map((u) => u.id).sort(), ["u1", "u2"]);
  });

  prueba("actualizar cambia los datos guardados", async (repo) => {
    await repo.crear(usuario("u1", "ana@correo.es", { tokenConfirmacion: "tok-1" }));
    await repo.actualizar(usuario("u1", "ana@correo.es", { estado: "activo" }));
    const guardado = await repo.buscarPorId("u1");
    assert.equal(guardado.estado, "activo");
    assert.equal(guardado.tokenConfirmacion, undefined);
  });

  prueba("actualizar un usuario inexistente devuelve null", async (repo) => {
    assert.equal(await repo.actualizar(usuario("nada", "x@correo.es")), null);
  });

  prueba("lo devuelto es una copia: modificarlo no altera lo guardado", async (repo) => {
    await repo.crear(usuario("u1", "ana@correo.es"));
    const copia = await repo.buscarPorId("u1");
    copia.estado = "manipulado";
    assert.equal((await repo.buscarPorId("u1")).estado, "pendiente");
  });
}
