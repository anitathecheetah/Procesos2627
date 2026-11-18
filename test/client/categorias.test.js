import test from "node:test";
import assert from "node:assert/strict";
import { etiquetaCategoria, sexoDeCategoria, pruebaEncajaConSexo, nombreConCategoria } from "../../client/js/categorias.js";

test("etiquetaCategoria", () => {
  assert.equal(etiquetaCategoria("elite-masculino"), "Élite masculino");
  assert.equal(etiquetaCategoria("elite-femenino"), "Élite femenino");
  assert.equal(etiquetaCategoria("sub23-femenino"), "Sub23 femenino");
  assert.deepEqual([undefined, null, "", "  "].map(etiquetaCategoria), ["", "", "", ""]);
});
test("sexoDeCategoria", () => {
  assert.equal(sexoDeCategoria("elite-masculino"), "M");
  assert.equal(sexoDeCategoria("Élite femenino"), "F");
  assert.equal(sexoDeCategoria("relevos-mixto"), null);
  assert.equal(sexoDeCategoria(undefined), null);
});
test("pruebaEncajaConSexo", () => {
  const m = { categoria: "elite-masculino" }, f = { categoria: "elite-femenino" }, sin = { nombre: "x" };
  assert.equal(pruebaEncajaConSexo(m, "M"), true);
  assert.equal(pruebaEncajaConSexo(m, "F"), false);
  assert.equal(pruebaEncajaConSexo(f, "F"), true);
  assert.equal(pruebaEncajaConSexo(f, "M"), false);
  assert.equal(pruebaEncajaConSexo(m, ""), true); // todos
  assert.equal(pruebaEncajaConSexo(sin, "M"), true); // sexo desconocido: se muestra
  assert.equal(pruebaEncajaConSexo({ sexo: "F" }, "M"), false); // el campo sexo manda sobre la categoría
});
test("nombreConCategoria", () => {
  assert.equal(nombreConCategoria({ nombre: "caceres duatlon", categoria: "elite-femenino" }), "caceres duatlon · Élite femenino");
  assert.equal(nombreConCategoria({ nombre: "caceres duatlon" }), "caceres duatlon");
});
