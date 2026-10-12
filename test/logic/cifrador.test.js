// Prueba del cifrador real con bcrypt.
import test from "node:test";
import assert from "node:assert/strict";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";

test("bcrypt: el hash difiere del texto y solo valida la contraseña correcta", async () => {
  const cifrador = crearCifradorBcrypt();
  const hash = await cifrador.cifrar("secreta123");
  assert.notEqual(hash, "secreta123");
  assert.ok(hash.startsWith("$2"));
  assert.equal(await cifrador.comparar("secreta123", hash), true);
  assert.equal(await cifrador.comparar("incorrecta", hash), false);
});
