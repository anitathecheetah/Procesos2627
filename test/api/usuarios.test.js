// Pruebas de integración de /api/usuarios con peticiones HTTP reales.
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";

// Crea directamente en el repositorio un usuario ya confirmado (contraseña "secreta123").
async function crearActivo(repositorio, { id, email, rol = "user" }) {
  const hash = await crearCifradorBcrypt().cifrar("secreta123");
  await repositorio.crear({ id, nombre: id, email, rol, estado: "activo", hash });
}

// Inicia sesión y devuelve la cookie para usarla en la cabecera Cookie.
async function entrar(url, email, password = "secreta123") {
  const r = await fetch(`${url}/api/sesion`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200);
  return r.headers.getSetCookie()[0].split(";")[0];
}

async function arrancar(repositorio = crearRepositorioMemoria()) {
  const tokens = [];
  const servidor = await new Promise((r) => {
    const s = crearApp({ repositorio, secreto: "secreto-de-prueba", notificar: (_u, token) => tokens.push(token) }).listen(0, () => r(s));
  });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  return { url, repositorio, tokens, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}
const post = (url, cuerpo) =>
  fetch(`${url}/api/usuarios`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

test("POST /api/usuarios responde 201 con el usuario pendiente", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const r = await post(url, { nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
    assert.equal(r.status, 201);
    const u = await r.json();
    assert.equal(u.estado, "pendiente");
  } finally { cerrar(); }
});

test("POST /api/usuarios con email repetido responde 409 {error, codigo}", async () => {
  const { url, cerrar } = await arrancar();
  try {
    await post(url, { nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
    const r = await post(url, { nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).codigo, "EMAIL_DUPLICADO");
  } finally { cerrar(); }
});

test("POST /api/usuarios con datos inválidos responde 400", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const r = await post(url, { nombre: "", email: "x", password: "secreta123" });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, "DATOS_INVALIDOS");
  } finally { cerrar(); }
});

test("GET /api/usuarios: 401 sin sesión, 403 siendo usuario, 200 siendo admin", async () => {
  const { url, repositorio, cerrar } = await arrancar();
  try {
    await crearActivo(repositorio, { id: "adm", email: "admin@x.es", rol: "admin" });
    await crearActivo(repositorio, { id: "u1", email: "ana@correo.es" });

    assert.equal((await fetch(`${url}/api/usuarios`)).status, 401);
    assert.equal((await fetch(`${url}/api/usuarios`, { headers: { Cookie: await entrar(url, "ana@correo.es") } })).status, 403);

    const r = await fetch(`${url}/api/usuarios`, { headers: { Cookie: await entrar(url, "admin@x.es") } });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).length, 2);
  } finally { cerrar(); }
});

// ---- PBI-05: estado y eliminación ----
test("GET /api/usuarios/:id/activo: admin 200 {id, activo}, usuario 403, inexistente 404", async () => {
  const { url, repositorio, cerrar } = await arrancar();
  try {
    await crearActivo(repositorio, { id: "adm", email: "admin@x.es", rol: "admin" });
    await crearActivo(repositorio, { id: "u1", email: "ana@correo.es" });
    const admin = { headers: { Cookie: await entrar(url, "admin@x.es") } };

    const r = await fetch(`${url}/api/usuarios/u1/activo`, admin);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { id: "u1", activo: true });

    assert.equal((await fetch(`${url}/api/usuarios/u1/activo`, { headers: { Cookie: await entrar(url, "ana@correo.es") } })).status, 403);
    const r404 = await fetch(`${url}/api/usuarios/nada/activo`, admin);
    assert.equal(r404.status, 404);
    assert.equal((await r404.json()).codigo, "NO_ENCONTRADO");
  } finally { cerrar(); }
});

test("DELETE /api/usuarios/:id: 204 al borrarse a sí mismo, 403 a otro, 401 sin sesión", async () => {
  const { url, repositorio, cerrar } = await arrancar();
  try {
    await crearActivo(repositorio, { id: "a", email: "ana@correo.es" });
    await crearActivo(repositorio, { id: "b", email: "beto@correo.es" });
    const cookieAna = await entrar(url, "ana@correo.es");

    assert.equal((await fetch(`${url}/api/usuarios/b`, { method: "DELETE" })).status, 401);
    assert.equal((await fetch(`${url}/api/usuarios/b`, { method: "DELETE", headers: { Cookie: cookieAna } })).status, 403);
    assert.equal((await fetch(`${url}/api/usuarios/a`, { method: "DELETE", headers: { Cookie: cookieAna } })).status, 204);
  } finally { cerrar(); }
});

test("DELETE /api/usuarios/:id como admin: 204 y el usuario deja de estar activo", async () => {
  const { url, repositorio, cerrar } = await arrancar();
  try {
    await crearActivo(repositorio, { id: "adm", email: "admin@x.es", rol: "admin" });
    await crearActivo(repositorio, { id: "u1", email: "ana@correo.es" });
    const admin = { headers: { Cookie: await entrar(url, "admin@x.es") } };

    assert.equal((await fetch(`${url}/api/usuarios/u1`, { method: "DELETE", ...admin })).status, 204);
    assert.equal((await (await fetch(`${url}/api/usuarios/u1/activo`, admin)).json()).activo, false);
  } finally { cerrar(); }
});

// ---- PBI-06: confirmación e inicio de sesión ----
const login = (url, cuerpo) =>
  fetch(`${url}/api/sesion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

test("registro, confirmación por enlace y login (con bcrypt real)", async () => {
  const { url, tokens, cerrar } = await arrancar();
  try {
    const credenciales = { email: "ana@correo.es", password: "secreta123" };
    const u = await (await post(url, { nombre: "Ana", ...credenciales })).json();

    // Pendiente: no puede entrar todavía.
    const pendiente = await login(url, credenciales);
    assert.equal(pendiente.status, 403);
    assert.equal((await pendiente.json()).codigo, "CUENTA_PENDIENTE");

    // Confirma con el enlace.
    const conf = await fetch(`${url}/api/confirmar?token=${tokens[0]}`, { redirect: "manual" });
    assert.equal(conf.status, 302);

    const ok = await login(url, credenciales);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).id, u.id);
  } finally { cerrar(); }
});

test("POST /api/sesion con contraseña errónea responde 401 {error, codigo}", async () => {
  const { url, tokens, cerrar } = await arrancar();
  try {
    await post(url, { nombre: "Ana", email: "ana@correo.es", password: "secreta123" });
    await fetch(`${url}/api/confirmar?token=${tokens[0]}`, { redirect: "manual" });
    const r = await login(url, { email: "ana@correo.es", password: "mala-mala" });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).codigo, "CREDENCIALES_INVALIDAS");
  } finally { cerrar(); }
});

test("GET /api/confirmar con token inválido responde 404 en JSON", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const r = await fetch(`${url}/api/confirmar?token=falso`, { redirect: "manual" });
    assert.equal(r.status, 404);
    assert.equal((await r.json()).codigo, "NO_ENCONTRADO");
  } finally { cerrar(); }
});
