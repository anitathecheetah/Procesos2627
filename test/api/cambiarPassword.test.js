// PUT /api/usuarios/yo/password: cambio de contraseña con sesión iniciada (PBI-21).
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";

async function arrancar() {
  const repositorio = crearRepositorioMemoria();
  const hash = await crearCifradorBcrypt().cifrar("ClaveActual1");
  await repositorio.crear({ id: "u1", nombre: "Ana", email: "ana@correo.es", rol: "user", estado: "activo", hash });
  const servidor = await new Promise((r) => {
    const s = crearApp({ repositorio, secreto: "secreto-de-prueba" }).listen(0, () => r(s));
  });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const json = (metodo, ruta, cuerpo, cookie) =>
    fetch(url + ruta, { method: metodo, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(cuerpo) });
  const entrar = async (password) => json("POST", "/api/sesion", { email: "ana@correo.es", password });
  return { json, entrar, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}

test("cambia la contraseña (204) y el login cambia con ella", async () => {
  const { json, entrar, cerrar } = await arrancar();
  try {
    const cookie = (await entrar("ClaveActual1")).headers.getSetCookie()[0].split(";")[0];
    const r = await json("PUT", "/api/usuarios/yo/password", { actual: "ClaveActual1", nueva: "ClaveNuevaLarga9" }, cookie);
    assert.equal(r.status, 204);
    assert.equal((await entrar("ClaveActual1")).status, 401);
    assert.equal((await entrar("ClaveNuevaLarga9")).status, 200);
  } finally { cerrar(); }
});

test("ERROR: sin sesión responde 401", async () => {
  const { json, cerrar } = await arrancar();
  try {
    const r = await json("PUT", "/api/usuarios/yo/password", { actual: "ClaveActual1", nueva: "ClaveNuevaLarga9" });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).codigo, "NO_AUTENTICADO");
  } finally { cerrar(); }
});

test("ERROR: contraseña actual incorrecta o nueva débil responden 400 {error, codigo}", async () => {
  const { json, entrar, cerrar } = await arrancar();
  try {
    const cookie = (await entrar("ClaveActual1")).headers.getSetCookie()[0].split(";")[0];
    for (const cuerpo of [
      { actual: "Equivocada123", nueva: "ClaveNuevaLarga9" },
      { actual: "ClaveActual1", nueva: "corta" },
      { actual: "ClaveActual1" },
    ]) {
      const r = await json("PUT", "/api/usuarios/yo/password", cuerpo, cookie);
      assert.equal(r.status, 400);
      const datos = await r.json();
      assert.equal(datos.codigo, "DATOS_INVALIDOS");
      assert.ok(datos.error);
    }
    assert.equal((await entrar("ClaveActual1")).status, 200); // no cambió nada
  } finally { cerrar(); }
});
