// Texto de probabilidades, rangos y diferencias de la predicción (no usa DOM).
import test from "node:test";
import assert from "node:assert/strict";
import { porcentaje, textoRango, textoDiferencia } from "../../client/js/formatoPrediccion.js";

test("porcentaje redondea y evita decir 0 % o 100 % cuando no es exacto", () => {
  assert.equal(porcentaje(0.4321), "43 %");
  assert.equal(porcentaje(0.5), "50 %");
  assert.equal(porcentaje(0), "0 %");
  assert.equal(porcentaje(0.002), "<1 %");
  assert.equal(porcentaje(0.995), ">99 %");
  assert.equal(porcentaje(1), "100 %");
  assert.equal(porcentaje(undefined), "0 %");
});

test("textoRango une los extremos o muestra uno solo si coinciden", () => {
  assert.equal(textoRango([3, 9]), "3–9");
  assert.equal(textoRango([4, 4]), "4");
});

test("textoDiferencia: + si llegó mejor de lo previsto, − si peor, = si acertó, — si no terminó", () => {
  assert.equal(textoDiferencia(5, 3), "+2");
  assert.equal(textoDiferencia(2, 4), "−2");
  assert.equal(textoDiferencia(3, 3), "=");
  assert.equal(textoDiferencia(3, null), "—");
});
