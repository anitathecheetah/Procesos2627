// Pruebas HTTP del ranking Elo.
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

async function arrancar() {
  const repositorio = crearRepositorioMemoria();
  const hash = await crearCifradorBcrypt().cifrar("secreta123");
  await repositorio.crear({ id: "admin", nombre: "admin", email: "admin@correo.es", rol: "admin", estado: "activo", hash });
  await repositorio.crear({ id: "user", nombre: "user", email: "user@correo.es", rol: "user", estado: "activo", hash });
  const servidor = await new Promise((r) => { const s = crearApp({ repositorio, secreto: "secreto-de-prueba" }).listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const entrar = async (email) => (await fetch(`${url}/api/sesion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "secreta123" }) })).headers.getSetCookie()[0].split(";")[0];
  return { url, entrar, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}

test("recalcular (admin) y consultar el ranking (público)", async () => {
  const { url, entrar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    await fetch(`${url}/api/pruebas/importar?idExterno=1&nombre=P&deporte=duatlon&fecha=2026-03-01`, {
      method: "POST", headers: { Cookie: admin, "Content-Type": "application/octet-stream" },
      body: await crearExcel([finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00"), finalista("Beto Ruiz", 1990, "Club Dos", 2, 2, "00:53:00")]),
    });
    const vacio = await (await fetch(`${url}/api/ranking/duatlon`)).json();
    assert.equal(vacio.total, 0); // aún sin recalcular

    const r = await fetch(`${url}/api/ranking/duatlon/recalcular`, { method: "POST", headers: { Cookie: admin } });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { deporte: "duatlon", pruebas: 1, atletas: 2 });

    const ranking = await (await fetch(`${url}/api/ranking/duatlon?pagina=1&tamano=1`)).json();
    assert.equal(ranking.total, 2);
    assert.equal(ranking.filas.length, 1);
    assert.deepEqual([ranking.filas[0].atleta.nombre, ranking.filas[0].rating, ranking.filas[0].pruebas], ["Ana López", 1516, 1]);
  } finally { cerrar(); }
});

test("ERROR: recalcular sin sesión 401 y como usuario normal 403; deporte o parámetros inválidos 400", async () => {
  const { url, entrar, cerrar } = await arrancar();
  try {
    assert.equal((await fetch(`${url}/api/ranking/duatlon/recalcular`, { method: "POST" })).status, 401);
    assert.equal((await fetch(`${url}/api/ranking/duatlon/recalcular`, { method: "POST", headers: { Cookie: await entrar("user@correo.es") } })).status, 403);
    assert.equal((await fetch(`${url}/api/ranking/natacion`)).status, 400);
    assert.equal((await fetch(`${url}/api/ranking/duatlon?pagina=0`)).status, 400);
    assert.equal((await fetch(`${url}/api/ranking/duatlon?tamano=500`)).status, 400);
  } finally { cerrar(); }
});

test("GET /api/ranking/:deporte/clubes es público, usa el mínimo de atletas y valida los parámetros", async () => {
  const { url, entrar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    await fetch(`${url}/api/pruebas/importar?idExterno=1&nombre=P&deporte=duatlon&fecha=2026-03-01`, {
      method: "POST", headers: { Cookie: admin, "Content-Type": "application/octet-stream" },
      body: await crearExcel([
        finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00"), finalista("Beto Ruiz", 1990, "Club Uno", 2, 2, "00:53:00"),
        finalista("Carla Sanz", 1992, "Club Dos", 3, 3, "00:54:00"),
      ]),
    });
    await fetch(`${url}/api/ranking/duatlon/recalcular`, { method: "POST", headers: { Cookie: admin } });

    const normal = await fetch(`${url}/api/ranking/duatlon/clubes?minAtletas=1`); // sin cookie: es público
    assert.equal(normal.status, 200);
    const datos = await normal.json();
    assert.deepEqual(datos.filas.map((f) => f.club.nombre), ["Club Uno", "Club Dos"]);
    assert.equal(datos.filas[0].atletas, 2);

    assert.equal((await (await fetch(`${url}/api/ranking/duatlon/clubes`)).json()).total, 0, "con el mínimo por defecto (3) ninguno entra");
    assert.equal((await fetch(`${url}/api/ranking/natacion/clubes`)).status, 400);
    assert.equal((await fetch(`${url}/api/ranking/duatlon/clubes?mejores=0`)).status, 400);
  } finally { cerrar(); }
});
