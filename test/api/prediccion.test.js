// Pruebas HTTP de la predicción de una carrera (PBI-26): pública, como el ranking.
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
  const importar = async (id, fecha) => (await (await fetch(`${url}/api/pruebas/importar?idExterno=${id}&nombre=Aguilas${id}&deporte=duatlon&fecha=${fecha}`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/octet-stream" },
    body: await crearExcel([finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00"), finalista("Beto Ruiz", 1990, "Club Dos", 2, 2, "00:53:00"), finalista("Carla Gil", 1992, "Club Uno", 3, 3, "00:54:00")]),
  })).json()).prueba;
  const recalcular = () => fetch(`${url}/api/ranking/duatlon/recalcular`, { method: "POST", headers: { Cookie: cookie } });
  return { url, importar, recalcular, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}

test("la predicción es pública y devuelve probabilidades por atleta", async () => {
  const { url, importar, recalcular, cerrar } = await arrancar();
  try {
    const base = await importar("1", "2026-02-01");
    await recalcular();
    const r = await fetch(`${url}/api/prediccion/duatlon?base=${base.id}`);
    assert.equal(r.status, 200);
    const cuerpo = await r.json();
    assert.equal(cuerpo.filas.length, 3);
    assert.equal(cuerpo.filas[0].atleta.nombre, "Ana López");
    assert.deepEqual(Object.keys(cuerpo.filas[0]).filter((k) => ["probVictoria", "probPodio", "probTop10", "posicionMedia", "rango", "posicionPrevista"].includes(k)).length, 6);
    assert.equal(cuerpo.base.nombre, "Aguilas1");
  } finally { cerrar(); }
});

test("retrospectiva=true añade el resultado real", async () => {
  const { url, importar, recalcular, cerrar } = await arrancar();
  try {
    const base = await importar("1", "2026-02-01");
    await recalcular();
    const cuerpo = await (await fetch(`${url}/api/prediccion/duatlon?base=${base.id}&retrospectiva=true`)).json();
    assert.equal(cuerpo.retrospectiva, true);
    assert.deepEqual(cuerpo.filas.map((f) => f.posicionReal).sort(), [1, 2, 3]);
    assert.equal(typeof cuerpo.errorMedio, "number");
  } finally { cerrar(); }
});

test("ERROR: deporte, prueba o parámetros inválidos dan 400 o 404", async () => {
  const { url, cerrar } = await arrancar();
  try {
    assert.equal((await fetch(`${url}/api/prediccion/natacion`)).status, 400);
    assert.equal((await fetch(`${url}/api/prediccion/duatlon`)).status, 400, "sin ranking no hay con quién predecir");
    assert.equal((await fetch(`${url}/api/prediccion/duatlon?base=no-existe`)).status, 404);
    assert.equal((await fetch(`${url}/api/prediccion/duatlon?simulaciones=1`)).status, 400);
    assert.equal((await fetch(`${url}/api/prediccion/duatlon?retrospectiva=true`)).status, 400);
  } finally { cerrar(); }
});
