// Pruebas unitarias de la política de contraseñas (VARIANTE-1).
import test from "node:test";
import assert from "node:assert/strict";
import { validarPassword } from "../../server/logic/politicaPassword.js";

const ordenados = (errores) => [...errores].sort();

test("variante1: acepta una contraseña que cumple las tres reglas", () => {
  assert.deepEqual(validarPassword("Abcdefgh12"), { valida: true, errores: [] });
});

test("variante1: rechaza 'abc1' por LONGITUD y MAYUSCULA", () => {
  const r = validarPassword("abc1");
  assert.equal(r.valida, false);
  assert.deepEqual(ordenados(r.errores), ["LONGITUD", "MAYUSCULA"]);
});

test("variante1: ERROR una contraseña sin dígito solo incumple DIGITO", () => {
  const r = validarPassword("Abcdefghijk");
  assert.equal(r.valida, false);
  assert.deepEqual(r.errores, ["DIGITO"]);
});

test("variante1: ERROR una contraseña sin mayúscula solo incumple MAYUSCULA", () => {
  const r = validarPassword("abcdefghi12");
  assert.equal(r.valida, false);
  assert.deepEqual(r.errores, ["MAYUSCULA"]);
});

test("variante1: la cadena vacía incumple las tres reglas", () => {
  const r = validarPassword("");
  assert.equal(r.valida, false);
  assert.deepEqual(ordenados(r.errores), ["DIGITO", "LONGITUD", "MAYUSCULA"]);
});

test("variante1: el límite de longitud es 10 (9 rechaza, 10 acepta) y la Ñ cuenta como mayúscula", () => {
  assert.deepEqual(validarPassword("Abcdefgh1").errores, ["LONGITUD"]);
  assert.deepEqual(validarPassword("Abcdefghi1"), { valida: true, errores: [] });
  assert.deepEqual(validarPassword("ñandúñandú1Ñ"), { valida: true, errores: [] });
});
