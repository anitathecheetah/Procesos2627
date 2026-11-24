import test from "node:test";
import assert from "node:assert/strict";
import { fondoDeColores } from "../../client/js/coloresClub.js";

test("fondoDeColores: liso, franjas o nada", () => {
  assert.equal(fondoDeColores(["#ffffff"]), "#ffffff");
  assert.equal(fondoDeColores(["#111111", "#ffffff"]), "linear-gradient(90deg, #111111 0% 50%, #ffffff 50% 100%)");
  assert.match(fondoDeColores(["#111111", "#222222", "#333333"]), /#333333 66\.66/);
  assert.equal(fondoDeColores([]), null);
  assert.equal(fondoDeColores(undefined), null);
  assert.equal(fondoDeColores(["rojo; background:url(x)"]), null); // nada que no sea #rrggbb llega al estilo
});
