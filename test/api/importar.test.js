// Pruebas HTTP de POST /api/pruebas/importar.
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
  const servidor = await new Promise((r) => {
    const s = crearApp({ repositorio, secreto: "secreto-de-prueba" }).listen(0, () => r(s));
  });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const entrar = async (email) => {
    const r = await fetch(`${url}/api/sesion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "secreta123" }) });
    return r.headers.getSetCookie()[0].split(";")[0];
  };
  return { url, entrar, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}
const consulta = "idExterno=9-9&nombre=Prueba&deporte=duatlon&fecha=2026-03-01&sexo=M";
const subir = (url, cookie, cuerpo, q = consulta) =>
  fetch(`${url}/api/pruebas/importar?${q}`, { method: "POST", headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/octet-stream" }, body: cuerpo });

test("el administrador importa un Excel y recibe 201 con el resumen", async () => {
  const { url, entrar, cerrar } = await arrancar();
  try {
    const excel = await crearExcel([finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00")]);
    const r = await subir(url, await entrar("admin@correo.es"), excel);
    assert.equal(r.status, 201);
    const cuerpo = await r.json();
    assert.equal(cuerpo.importados, 1);
    assert.equal(cuerpo.prueba.deporte, "duatlon");
    // Reimportarla: 409
    assert.equal((await subir(url, await entrar("admin@correo.es"), excel)).status, 409);
  } finally { cerrar(); }
});

test("ERROR: sin sesión 401, usuario normal 403, archivo inválido 400", async () => {
  const { url, entrar, cerrar } = await arrancar();
  try {
    const excel = await crearExcel([finalista("Ana López", 1995, "Club Uno", 1, 1, "00:52:00")]);
    assert.equal((await subir(url, null, excel)).status, 401);
    assert.equal((await subir(url, await entrar("user@correo.es"), excel)).status, 403);
    const r = await subir(url, await entrar("admin@correo.es"), Buffer.from("no es excel"));
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, "DATOS_INVALIDOS");
    assert.equal((await subir(url, await entrar("admin@correo.es"), excel, "idExterno=1&nombre=P&deporte=nada&fecha=2026-01-01")).status, 400);
  } finally { cerrar(); }
});

test("sanciones: el administrador sube el CSV del acta y se ven en la prueba; errores 400/404/403/401", async () => {
  const { url, entrar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    const excel = await crearExcel([finalista("Ana López", 1995, "Club Uno", 67, 1, "00:52:00")]);
    const { prueba } = await (await subir(url, admin, excel)).json();
    const csv = (cookie, cuerpo, tipo = "text/csv") =>
      fetch(`${url}/api/pruebas/${prueba.id}/sanciones`, { method: "POST", headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": tipo }, body: cuerpo });

    assert.equal((await csv(null, "67;DSQ;LM")).status, 401);
    assert.equal((await csv(await entrar("user@correo.es"), "67;DSQ;LM")).status, 403);
    assert.equal((await csv(admin, "999;DSQ;LM")).status, 404);
    assert.equal((await csv(admin, "67;XX;LM")).status, 400);

    const ok = await csv(admin, "dorsal;accion1;infraccion1\n67;DSQ;LM");
    assert.equal(ok.status, 201);
    assert.deepEqual(await ok.json(), { cargadas: 1, descalificados: 1 });

    const lista = await (await fetch(`${url}/api/pruebas/${prueba.id}/sanciones`)).json();
    assert.deepEqual(lista[0].pares, [{ accion: "DSQ", infraccion: "LM" }]);

    const json = await csv(admin, JSON.stringify({ sanciones: [{ dorsal: "67", pares: [{ accion: "ST", infraccion: "LM" }] }] }), "application/json");
    assert.equal(json.status, 201);
    assert.equal((await fetch(`${url}/api/pruebas/nada/sanciones`)).status, 404);
  } finally { cerrar(); }
});
