// GET/PUT /api/usuarios/yo/perfil: perfil y material privados (PBI-54).
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";

async function arrancar() {
  const repositorio = crearRepositorioMemoria();
  const hash = await crearCifradorBcrypt().cifrar("ClaveActual1");
  for (const [id, email] of [["u1", "ana@correo.es"], ["u2", "luis@correo.es"]]) await repositorio.crear({ id, nombre: id, email, rol: "user", estado: "activo", hash });
  const servidor = await new Promise((r) => { const s = crearApp({ repositorio, secreto: "secreto-de-prueba" }).listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const json = (metodo, ruta, cuerpo, cookie) =>
    fetch(url + ruta, { method: metodo, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const entrar = async (email) => (await json("POST", "/api/sesion", { email, password: "ClaveActual1" })).headers.getSetCookie()[0].split(";")[0];
  return { json, entrar, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}

test("guarda y lee el perfil propio; otro usuario no lo ve", async () => {
  const { json, entrar, cerrar } = await arrancar();
  try {
    const ana = await entrar("ana@correo.es");
    const luis = await entrar("luis@correo.es");
    const r = await json("PUT", "/api/usuarios/yo/perfil", { club: "Triatlón Albacete", pesoKg: 60, bicis: [{ nombre: "Canyon", tipo: "ruta" }] }, ana);
    assert.equal(r.status, 200);
    assert.equal((await (await json("GET", "/api/usuarios/yo/perfil", null, ana)).json()).club, "Triatlón Albacete");
    assert.equal((await (await json("GET", "/api/usuarios/yo/perfil", null, luis)).json()).club, "");
  } finally { cerrar(); }
});

test("ERROR: sin sesión 401 y datos inválidos 400", async () => {
  const { json, entrar, cerrar } = await arrancar();
  try {
    assert.equal((await json("GET", "/api/usuarios/yo/perfil")).status, 401);
    assert.equal((await json("PUT", "/api/usuarios/yo/perfil", {})).status, 401);
    const ana = await entrar("ana@correo.es");
    const r = await json("PUT", "/api/usuarios/yo/perfil", { alturaCm: 5 }, ana);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, "DATOS_INVALIDOS");
  } finally { cerrar(); }
});

test("al eliminar la cuenta se borra el perfil", async () => {
  const { json, entrar, cerrar } = await arrancar();
  try {
    const ana = await entrar("ana@correo.es");
    await json("PUT", "/api/usuarios/yo/perfil", { club: "X" }, ana);
    assert.equal((await json("DELETE", "/api/usuarios/u1", null, ana)).status, 204);
    const luis = await entrar("luis@correo.es");
    assert.equal((await (await json("GET", "/api/usuarios/yo/perfil", null, luis)).json()).club, "");
  } finally { cerrar(); }
});
