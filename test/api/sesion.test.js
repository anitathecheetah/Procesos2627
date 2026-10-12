// Pruebas de integración de la sesión: cookie, persistencia, cierre y rutas protegidas.
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";

async function arrancar() {
  const repositorio = crearRepositorioMemoria();
  const hash = await crearCifradorBcrypt().cifrar("secreta123");
  await repositorio.crear({ id: "u1", nombre: "Ana", email: "ana@correo.es", rol: "user", estado: "activo", hash });
  const servidor = await new Promise((r) => {
    const s = crearApp({ repositorio, secreto: "secreto-de-prueba" }).listen(0, () => r(s));
  });
  return { url: `http://127.0.0.1:${servidor.address().port}`, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}
const entrar = (url) =>
  fetch(`${url}/api/sesion`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ana@correo.es", password: "secreta123" }),
  });

test("ERROR: una ruta protegida sin sesión responde 401 {error, codigo}", async () => {
  const { url, cerrar } = await arrancar();
  try {
    for (const ruta of ["/api/sesion", "/api/usuarios", "/api/usuarios/u1/activo"]) {
      const r = await fetch(url + ruta);
      assert.equal(r.status, 401, ruta);
      assert.equal((await r.json()).codigo, "NO_AUTENTICADO");
    }
  } finally { cerrar(); }
});

test("el login deja una cookie HttpOnly y GET /api/sesion devuelve al usuario (la recarga mantiene la sesión)", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const r = await entrar(url);
    const setCookie = r.headers.getSetCookie()[0];
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);

    const cookie = setCookie.split(";")[0];
    // Dos peticiones seguidas con la misma cookie = recargar la página.
    for (let i = 0; i < 2; i++) {
      const actual = await fetch(`${url}/api/sesion`, { headers: { Cookie: cookie } });
      assert.equal(actual.status, 200);
      assert.equal((await actual.json()).email, "ana@correo.es");
    }
  } finally { cerrar(); }
});

test("cerrar sesión invalida la cookie en el servidor", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const cookie = (await entrar(url)).headers.getSetCookie()[0].split(";")[0];
    const salir = await fetch(`${url}/api/sesion`, { method: "DELETE", headers: { Cookie: cookie } });
    assert.equal(salir.status, 204);
    assert.match(salir.headers.getSetCookie()[0], /Max-Age=0/);
    // La cookie vieja ya no sirve aunque alguien la hubiera copiado.
    assert.equal((await fetch(`${url}/api/sesion`, { headers: { Cookie: cookie } })).status, 401);
  } finally { cerrar(); }
});

test("ERROR: una cookie manipulada se rechaza con 401", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const cookie = (await entrar(url)).headers.getSetCookie()[0].split(";")[0];
    const falsa = cookie.slice(0, -3) + "AAA";
    assert.equal((await fetch(`${url}/api/sesion`, { headers: { Cookie: falsa } })).status, 401);
  } finally { cerrar(); }
});

test("ERROR: un usuario eliminado ya no puede usar su sesión", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const cookie = (await entrar(url)).headers.getSetCookie()[0].split(";")[0];
    assert.equal((await fetch(`${url}/api/usuarios/u1`, { method: "DELETE", headers: { Cookie: cookie } })).status, 204);
    assert.equal((await fetch(`${url}/api/sesion`, { headers: { Cookie: cookie } })).status, 401);
  } finally { cerrar(); }
});
