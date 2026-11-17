// Texto del cambio de Elo en la clasificación (no usa DOM).
import test from "node:test";
import assert from "node:assert/strict";
import { textoElo } from "../../client/js/elo.js";

test("muestra antes → después y el cambio con su signo", () => {
  assert.equal(textoElo({ antes: 1500, despues: 1516, cambio: 16 }), "1500 → 1516 (+16)");
  assert.equal(textoElo({ antes: 1516, despues: 1498, cambio: -18 }), "1516 → 1498 (−18)");
  assert.equal(textoElo({ antes: 1500, despues: 1500, cambio: 0 }), "1500 → 1500 (±0)");
});

test("sin Elo calculado (abandono o ranking sin recalcular) devuelve vacío", () => {
  assert.equal(textoElo(null), "");
  assert.equal(textoElo(undefined), "");
});
