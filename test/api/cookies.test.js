// Pruebas de la firma de cookies.
import test from "node:test";
import assert from "node:assert/strict";
import { firmar, verificar } from "../../server/api/cookies.js";

test("una cookie firmada se verifica con el mismo secreto", () => {
  assert.equal(verificar(firmar("abc", "secreto"), "secreto"), "abc");
});

test("ERROR: una cookie manipulada o firmada con otro secreto se rechaza", () => {
  const firmada = firmar("abc", "secreto");
  assert.equal(verificar(firmada, "otro-secreto"), null);
  assert.equal(verificar("xyz" + firmada.slice(3), "secreto"), null);
  assert.equal(verificar("sin-firma", "secreto"), null);
  assert.equal(verificar(undefined, "secreto"), null);
});
