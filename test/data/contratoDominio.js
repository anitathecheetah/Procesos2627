// Contrato de los repositorios del dominio: la misma batería contra memoria y MongoDB.
import test from "node:test";
import assert from "node:assert/strict";

const atleta = (id, clave, extra = {}) => ({ id, clave, nombre: clave, anioNacimiento: 1990, ...extra });

// preparar() -> { repos: { atletas, pertenencias, ... }, limpiar }
export function pruebasContratoDominio(nombre, preparar, opciones = {}) {
  const prueba = (titulo, fn) =>
    test(`[${nombre}] dominio: ${titulo}`, opciones, async () => {
      const { repos, limpiar } = await preparar();
      try { await fn(repos); } finally { await limpiar(); }
    });

  prueba("crear y buscar por id", async ({ atletas }) => {
    await atletas.crear(atleta("a1", "ANA|1990"));
    assert.deepEqual(await atletas.buscarPorId("a1"), atleta("a1", "ANA|1990"));
    assert.equal(await atletas.buscarPorId("nada"), null);
  });

  prueba("buscarUno y listar filtran por campos", async ({ atletas }) => {
    await atletas.crear(atleta("a1", "ANA|1990"));
    await atletas.crear(atleta("a2", "BETO|1985", { anioNacimiento: 1985 }));
    assert.equal((await atletas.buscarUno({ clave: "BETO|1985" })).id, "a2");
    assert.equal(await atletas.buscarUno({ clave: "NADIE|2000" }), null);
    assert.deepEqual((await atletas.listar({ anioNacimiento: 1990 })).map((a) => a.id), ["a1"]);
    assert.equal((await atletas.listar()).length, 2);
  });

  prueba("actualizar cambia los datos y devuelve null si no existe", async ({ atletas }) => {
    await atletas.crear(atleta("a1", "ANA|1990"));
    await atletas.actualizar(atleta("a1", "ANA|1990", { sexo: "F" }));
    assert.equal((await atletas.buscarPorId("a1")).sexo, "F");
    assert.equal(await atletas.actualizar(atleta("nada", "X|1990")), null);
  });

  prueba("ERROR: no se puede repetir la clave de un atleta", async ({ atletas }) => {
    await atletas.crear(atleta("a1", "ANA|1990"));
    await assert.rejects(atletas.crear(atleta("a2", "ANA|1990")));
  });

  prueba("ERROR: un atleta solo tiene un club por temporada", async ({ pertenencias }) => {
    await pertenencias.crear({ id: "p1", atletaId: "a1", temporada: "2026", clubId: "c1" });
    await assert.rejects(pertenencias.crear({ id: "p2", atletaId: "a1", temporada: "2026", clubId: "c2" }));
    await pertenencias.crear({ id: "p3", atletaId: "a1", temporada: "2027", clubId: "c2" }); // otra temporada: permitido
  });

  prueba("eliminar borra y avisa si no existía", async ({ clubes }) => {
    await clubes.crear({ id: "c1", clave: "CLUB UNO", nombre: "Club Uno" });
    assert.equal(await clubes.eliminar("c1"), true);
    assert.equal(await clubes.eliminar("c1"), false);
    assert.equal(await clubes.buscarPorId("c1"), null);
  });

  prueba("lo devuelto es una copia: modificarlo no altera lo guardado", async ({ atletas }) => {
    await atletas.crear(atleta("a1", "ANA|1990"));
    const copia = await atletas.buscarPorId("a1");
    copia.nombre = "manipulado";
    assert.equal((await atletas.buscarPorId("a1")).nombre, "ANA|1990");
  });

  prueba("crearVarios inserta todo y eliminarPor borra por filtro devolviendo cuántos", async ({ atletas }) => {
    assert.equal(await atletas.crearVarios([atleta("a1", "ANA|1990"), atleta("a2", "BETO|1985", { anioNacimiento: 1985 }), atleta("a3", "CARLA|1985", { anioNacimiento: 1985 })]), 3);
    assert.equal(await atletas.crearVarios([]), 0);
    assert.equal(await atletas.eliminarPor({ anioNacimiento: 1985 }), 2);
    assert.deepEqual((await atletas.listar()).map((a) => a.id), ["a1"]);
    assert.equal(await atletas.eliminarPor({ anioNacimiento: 2000 }), 0);
  });
}
