import test from "node:test";
import assert from "node:assert/strict";
import { COLORES_CLUBES, coloresDeClub, conColores } from "../../server/logic/coloresClubes.js";

test("los 22 clubes de Primera tienen colores CSS válidos y nombres distintos", () => {
  assert.equal(COLORES_CLUBES.length, 22);
  assert.equal(new Set(COLORES_CLUBES.map((c) => c.nombre)).size, 22);
  for (const c of COLORES_CLUBES) {
    assert.ok(c.colores.length >= 1 && c.colores.every((h) => /^#[0-9a-f]{6}$/i.test(h)), c.nombre);
    assert.ok(c.descripcion, c.nombre);
  }
});

test("coloresDeClub: ignora mayúsculas y tildes y reconoce variantes del nombre", () => {
  assert.deepEqual(coloresDeClub("CLUB TRIATLÓN ALBACETE RES").colores, ["#facc15"]);
  assert.equal(coloresDeClub("triatlon albacete res").descripcion, "amarillo");
  assert.equal(coloresDeClub("Peñota Dental Alusigma").descripcion, "blanco");
  assert.equal(coloresDeClub("ISBILYA - SLOPPY JOE´S").descripcion, "rojo y negro");
  assert.equal(coloresDeClub("Isbilya Sloppy Joe's").descripcion, "rojo y negro");
  assert.equal(coloresDeClub("TRIPUÇOL").colores.length, 3);
  assert.equal(coloresDeClub("Club que no existe"), null);
  assert.equal(coloresDeClub(""), null);
  assert.equal(coloresDeClub(undefined), null);
});

test("coloresDeClub devuelve una copia: no se puede alterar la tabla", () => {
  coloresDeClub("Tripuçol").colores.push("#000000");
  assert.equal(coloresDeClub("Tripuçol").colores.length, 3);
});

test("conColores amplía un club solo si tiene color", () => {
  assert.deepEqual(conColores({ id: "1", nombre: "Cidade de Lugo Fluvial" }), { id: "1", nombre: "Cidade de Lugo Fluvial", colores: ["#d9138a"], descripcionColor: "fucsia" });
  assert.deepEqual(conColores({ id: "2", nombre: "Otro" }), { id: "2", nombre: "Otro" });
  assert.equal(conColores(null), null);
});
