import test from "node:test";
import assert from "node:assert/strict";
import {
  SECCIONES, SECCION_POR_DEFECTO, hashDeSeccion, seccionDeHash, seccionesVisibles, tituloDeSeccion,
} from "../../client/js/rutas.js";

test("hashDeSeccion y seccionDeHash son inversas para todas las secciones", () => {
  for (const { id } of SECCIONES) assert.equal(seccionDeHash(hashDeSeccion(id), { esAdmin: true }), id);
});
test("una dirección vacía o desconocida lleva a Inicio", () => {
  for (const hash of ["", "#", "#/", "#/nada", undefined, null, "#/Rankings"]) {
    assert.equal(seccionDeHash(hash), SECCION_POR_DEFECTO);
  }
});
test("tolera parámetros y subrutas tras la sección", () => {
  assert.equal(seccionDeHash("#/rankings?deporte=triatlon"), "rankings");
  assert.equal(seccionDeHash("#/carreras/42"), "carreras");
  assert.equal(seccionDeHash("rankings"), "rankings");
});
test("Admin solo es accesible para administradores", () => {
  assert.equal(seccionDeHash("#/admin"), "inicio");
  assert.equal(seccionDeHash("#/admin", { esAdmin: false }), "inicio");
  assert.equal(seccionDeHash("#/admin", { esAdmin: true }), "admin");
});
test("seccionesVisibles oculta Admin a quien no es administrador", () => {
  assert.ok(!seccionesVisibles().some((s) => s.id === "admin"));
  assert.ok(seccionesVisibles({ esAdmin: true }).some((s) => s.id === "admin"));
  assert.equal(seccionesVisibles({ esAdmin: true }).length, SECCIONES.length);
});
test("los identificadores son únicos y hay título para cada sección", () => {
  assert.equal(new Set(SECCIONES.map((s) => s.id)).size, SECCIONES.length);
  assert.equal(tituloDeSeccion("rankings"), "Rankings");
  assert.equal(tituloDeSeccion("zzz"), "");
});
