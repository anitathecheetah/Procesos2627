// Pruebas de integración de /api/usuarios con peticiones HTTP reales.
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";

async function arrancar(repositorio = crearRepositorioMemoria()) {
  const servidor = await new Promise((r) => {
    const s = crearApp({ repositorio }).listen(0, () => r(s));
  });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  return { url, repositorio, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}
const post = (url, cuerpo) =>
  fetch(`${url}/api/usuarios`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

test("POST /api/usuarios responde 201 con el usuario pendiente", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const r = await post(url, { nombre: "Ana", email: "ana@correo.es" });
    assert.equal(r.status, 201);
    const u = await r.json();
    assert.equal(u.estado, "pendiente");
  } finally { cerrar(); }
});

test("POST /api/usuarios con email repetido responde 409 {error, codigo}", async () => {
  const { url, cerrar } = await arrancar();
  try {
    await post(url, { nombre: "Ana", email: "ana@correo.es" });
    const r = await post(url, { nombre: "Ana", email: "ana@correo.es" });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).codigo, "EMAIL_DUPLICADO");
  } finally { cerrar(); }
});

test("POST /api/usuarios con datos inválidos responde 400", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const r = await post(url, { nombre: "", email: "x" });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, "DATOS_INVALIDOS");
  } finally { cerrar(); }
});

test("GET /api/usuarios: 401 sin identificar, 403 siendo usuario, 200 siendo admin", async () => {
  const { url, repositorio, cerrar } = await arrancar();
  try {
    await repositorio.crear({ id: "adm", nombre: "Admin", email: "admin@x.es", rol: "admin", estado: "activo" });
    const normal = await (await post(url, { nombre: "Ana", email: "ana@correo.es" })).json();

    assert.equal((await fetch(`${url}/api/usuarios`)).status, 401);
    assert.equal((await fetch(`${url}/api/usuarios`, { headers: { "X-Usuario-Id": normal.id } })).status, 403);

    const r = await fetch(`${url}/api/usuarios`, { headers: { "X-Usuario-Id": "adm" } });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).length, 2);
  } finally { cerrar(); }
});
