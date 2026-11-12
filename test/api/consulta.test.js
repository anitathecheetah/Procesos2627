// Pruebas HTTP de las consultas públicas de pruebas y atletas.
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

async function arrancar() {
  const repositorio = crearRepositorioMemoria();
  await repositorio.crear({ id: "admin", nombre: "admin", email: "admin@correo.es", rol: "admin", estado: "activo", hash: await crearCifradorBcrypt().cifrar("secreta123") });
  const servidor = await new Promise((r) => { const s = crearApp({ repositorio, secreto: "secreto-de-prueba" }).listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const login = await fetch(`${url}/api/sesion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@correo.es", password: "secreta123" }) });
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  const importar = async () => {
    const r = await fetch(`${url}/api/pruebas/importar?idExterno=1&nombre=Duatl%C3%B3n&deporte=duatlon&fecha=2026-03-01`, {
      method: "POST", headers: { Cookie: cookie, "Content-Type": "application/octet-stream" },
      body: await crearExcel([finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00"), finalista("Beto Ruiz", 1990, "Club Dos", 2, 2, "00:53:00")]),
    });
    return (await r.json()).prueba;
  };
  return { url, importar, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}
const json = async (r) => ({ estado: r.status, cuerpo: await r.json() });

test("las consultas son públicas: listado, detalle, búsqueda y ficha", async () => {
  const { url, importar, cerrar } = await arrancar();
  try {
    const prueba = await importar();
    const lista = await json(await fetch(`${url}/api/pruebas?deporte=duatlon`));
    assert.equal(lista.estado, 200);
    assert.equal(lista.cuerpo[0].participantes, 2);

    const detalle = await json(await fetch(`${url}/api/pruebas/${prueba.id}`));
    assert.equal(detalle.estado, 200);
    assert.deepEqual(detalle.cuerpo.clasificacion.map((f) => f.atleta.nombre), ["Ana López", "Beto Ruiz"]);

    const busqueda = await json(await fetch(`${url}/api/atletas?q=${encodeURIComponent("lópez")}`));
    assert.equal(busqueda.cuerpo.length, 1);

    const ficha = await json(await fetch(`${url}/api/atletas/${busqueda.cuerpo[0].id}`));
    assert.equal(ficha.estado, 200);
    assert.equal(ficha.cuerpo.resultados[0].prueba.nombre, "Duatlón");
  } finally { cerrar(); }
});

test("ERROR: 404 de prueba y atleta inexistentes, 400 de filtros y búsquedas inválidos", async () => {
  const { url, cerrar } = await arrancar();
  try {
    assert.equal((await fetch(`${url}/api/pruebas/nada`)).status, 404);
    assert.equal((await fetch(`${url}/api/atletas/nada`)).status, 404);
    assert.equal((await fetch(`${url}/api/pruebas?deporte=natacion`)).status, 400);
    assert.equal((await fetch(`${url}/api/atletas?q=a`)).status, 400);
    assert.equal((await fetch(`${url}/api/atletas`)).status, 400);
  } finally { cerrar(); }
});
