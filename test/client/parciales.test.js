// Nombres de los parciales por deporte para la clasificación (no usa DOM).
import test from "node:test";
import assert from "node:assert/strict";
import { describirParciales, NOMBRES_PARCIALES } from "../../client/js/parciales.js";

const formato = (s) => `${s}s`;
const cinco = [600, 20, 1800, 20, 420];

test("triatlón: natación, T1, bici, T2 y carrera", () => {
  assert.equal(describirParciales("triatlon", cinco, formato), "Natación 600s · T1 20s · Bici 1800s · T2 20s · Carrera 420s");
});

test("duatlón: carrera 1, T1, bici, T2 y carrera 2", () => {
  assert.equal(describirParciales("duatlon", cinco, formato), "Carrera 1 600s · T1 20s · Bici 1800s · T2 20s · Carrera 2 420s");
});

test("sin parciales fiables, devuelve vacío", () => {
  assert.equal(describirParciales("triatlon", null, formato), "");
  assert.equal(describirParciales("triatlon", [1, 2], formato), "");
  assert.equal(describirParciales("aquatlon", cinco, formato), "");
});

test("cada deporte tiene 5 nombres", () => {
  for (const nombres of Object.values(NOMBRES_PARCIALES)) assert.equal(nombres.length, 5);
});
