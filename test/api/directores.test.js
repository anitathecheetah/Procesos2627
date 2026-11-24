// API de directores de club (PBI-55).
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";

async function arrancar() {
  const repositorio = crearRepositorioMemoria();
  const hash = await crearCifradorBcrypt().cifrar("ClaveActual1");
  await repositorio.crear({ id: "adm", nombre: "Admin", email: "admin@correo.es", rol: "admin", estado: "activo", hash });
  await repositorio.crear({ id: "u1", nombre: "Ana", email: "ana@correo.es", rol: "user", estado: "activo", hash });
  const dominioRepos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  await dominioRepos.clubes.crear({ id: "c1", clave: "TRIATLON ALBACETE", nombre: "Triatlón Albacete" });
  const servidor = await new Promise((r) => { const s = crearApp({ repositorio, dominioRepos, secreto: "secreto-de-prueba" }).listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const json = (metodo, ruta, cuerpo, cookie) =>
    fetch(url + ruta, { method: metodo, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const entrar = async (email) => (await json("POST", "/api/sesion", { email, password: "ClaveActual1" })).headers.getSetCookie()[0].split(";")[0];
  return { json, entrar, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}

test("flujo completo: lista de clubes, solicitud, aprobación del admin y panel", async () => {
  const { json, entrar, cerrar } = await arrancar();
  try {
    const ana = await entrar("ana@correo.es");
    const adm = await entrar("admin@correo.es");
    const clubes = await (await json("GET", "/api/clubes", null, ana)).json();
    assert.ok(clubes.length > 600); // existentes + catálogo FETRI
    assert.equal(clubes.filter((c) => c.id === "c1").length, 1);
    assert.ok(clubes.some((c) => c.id.startsWith("fetri:") && c.comunidad));
    assert.equal(await (await json("GET", "/api/directores/solicitudes/yo", null, ana)).json(), null);
    assert.equal((await json("GET", "/api/directores/panel", null, ana)).status, 403);
    const creada = await json("POST", "/api/directores/solicitudes", { clubId: "c1" }, ana);
    assert.equal(creada.status, 201);
    const { id } = await creada.json();
    assert.equal((await json("GET", "/api/directores/solicitudes", null, ana)).status, 403); // solo admin
    assert.equal((await (await json("GET", "/api/directores/solicitudes", null, adm)).json()).length, 1);
    assert.equal((await json("PUT", `/api/directores/solicitudes/${id}`, { aprobar: true }, ana)).status, 403);
    assert.equal((await json("PUT", `/api/directores/solicitudes/${id}`, { aprobar: true }, adm)).status, 200);
    const panel = await (await json("GET", "/api/directores/panel", null, ana)).json();
    assert.equal(panel.club.nombre, "Triatlón Albacete");
    assert.equal(panel.vacio, true);
  } finally { cerrar(); }
});

test("ERROR: sin sesión 401, datos inválidos 400", async () => {
  const { json, entrar, cerrar } = await arrancar();
  try {
    for (const [m, r] of [["GET", "/api/clubes"], ["POST", "/api/directores/solicitudes"], ["GET", "/api/directores/panel"], ["GET", "/api/directores/solicitudes/yo"]]) {
      assert.equal((await json(m, r, m === "POST" ? {} : null)).status, 401, r);
    }
    const ana = await entrar("ana@correo.es");
    const r = await json("POST", "/api/directores/solicitudes", {}, ana);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, "DATOS_INVALIDOS");
  } finally { cerrar(); }
});
