import test from "node:test";
import assert from "node:assert/strict";
import { filtrarClubes, textoClubResumen } from "../../client/js/filtroClubes.js";

const clubes = [{ id: "1", nombre: "Triatlón Albacete", atletas: 12 }, { id: "2", nombre: "Club Triatlón Cuenca", atletas: 3 }, { id: "3", nombre: "Náutico Narón", atletas: 12 }];

test("filtrarClubes: todas las palabras, sin tildes ni mayúsculas; más atletas primero", () => {
  assert.deepEqual(filtrarClubes(clubes, "").map((c) => c.id), ["3", "1", "2"]);
  assert.deepEqual(filtrarClubes(clubes, "TRIATLON").map((c) => c.id), ["1", "2"]);
  assert.deepEqual(filtrarClubes(clubes, "cuenca club").map((c) => c.id), ["2"]);
  assert.deepEqual(filtrarClubes(clubes, "naron").map((c) => c.id), ["3"]);
  assert.deepEqual(filtrarClubes(clubes, "zzz"), []);
});

test("textoClubResumen concuerda en singular y plural", () => {
  assert.equal(textoClubResumen({ nombre: "A", atletas: 1 }), "A · 1 atleta");
  assert.equal(textoClubResumen({ nombre: "A", atletas: 0 }), "A · 0 atletas");
});
