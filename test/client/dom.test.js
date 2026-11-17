// Formato de tiempos y fechas (no usa DOM: las funciones de DOM solo se llaman desde el navegador).
import test from "node:test";
import assert from "node:assert/strict";
import { formatearTiempo, formatearTiempoCorto, formatearFecha } from "../../client/js/dom.js";

test("formatearTiempo siempre muestra horas", () => {
  assert.equal(formatearTiempo(3635), "1:00:35");
  assert.equal(formatearTiempo(30), "0:00:30");
  assert.equal(formatearTiempo(null), "—");
});

test("formatearTiempoCorto quita las horas si no llegan a 1", () => {
  assert.equal(formatearTiempoCorto(30), "0:30");
  assert.equal(formatearTiempoCorto(1156), "19:16");
  assert.equal(formatearTiempoCorto(3893), "1:04:53");
  assert.equal(formatearTiempoCorto(undefined), "—");
});

test("formatearFecha pasa de ISO a día/mes/año", () => {
  assert.equal(formatearFecha("2026-02-01"), "01/02/2026");
});
