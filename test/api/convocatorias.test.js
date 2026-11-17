// Pruebas HTTP de las próximas carreras e inscripciones (PBI-37/38).
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearCifradorBcrypt } from "../../server/logic/cifrador.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

async function arrancar() {
  const repositorio = crearRepositorioMemoria();
  const hash = await crearCifradorBcrypt().cifrar("secreta123");
  await repositorio.crear({ id: "admin", nombre: "Admin", email: "admin@correo.es", rol: "admin", estado: "activo", hash });
  await repositorio.crear({ id: "eva", nombre: "Eva Gil", email: "eva@correo.es", rol: "user", estado: "activo", hash });
  const servidor = await new Promise((r) => { const s = crearApp({ repositorio, secreto: "secreto-de-prueba" }).listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const entrar = async (email) => (await fetch(`${url}/api/sesion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "secreta123" }) })).headers.getSetCookie()[0].split(";")[0];
  const llamar = (cookie, metodo, ruta, cuerpo) => fetch(`${url}/api${ruta}`, {
    method: metodo, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { "Content-Type": "application/json" } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { url, entrar, llamar, cerrar: () => { servidor.close(); servidor.closeAllConnections(); } };
}
const DATOS = { nombre: "Duatlón Águilas 2027", deporte: "duatlon", fecha: "2027-02-07", lugar: "Águilas" };

test("el admin crea, cualquiera lista, un usuario se apunta y el admin ve quién", async () => {
  const { entrar, llamar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    const eva = await entrar("eva@correo.es");
    const creada = await llamar(admin, "POST", "/convocatorias", DATOS);
    assert.equal(creada.status, 201);
    const { id } = await creada.json();

    const publica = await (await llamar(undefined, "GET", "/convocatorias")).json();
    assert.deepEqual(publica.map((c) => [c.nombre, c.apuntados]), [["Duatlón Águilas 2027", 0]]);
    assert.ok(!("apuntado" in publica[0]), "sin sesión no se sabe si estás apuntado");

    assert.equal((await llamar(eva, "PUT", `/convocatorias/${id}/inscripcion`)).status, 204);
    const conSesion = await (await llamar(eva, "GET", "/convocatorias")).json();
    assert.deepEqual([conSesion[0].apuntados, conSesion[0].apuntado], [1, true]);

    const apuntados = await (await llamar(admin, "GET", `/convocatorias/${id}/inscripciones`)).json();
    assert.deepEqual(apuntados, [{ usuarioId: "eva", nombre: "Eva Gil" }]);

    assert.equal((await llamar(eva, "DELETE", `/convocatorias/${id}/inscripcion`)).status, 204);
    assert.equal((await (await llamar(undefined, "GET", "/convocatorias")).json())[0].apuntados, 0);
    assert.equal((await llamar(admin, "DELETE", `/convocatorias/${id}`)).status, 204);
    assert.deepEqual(await (await llamar(undefined, "GET", "/convocatorias")).json(), []);
  } finally { cerrar(); }
});

test("vincular el listado real y consultar la asistencia", async () => {
  const { url, entrar, llamar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    const eva = await entrar("eva@correo.es");
    const { id } = await (await llamar(admin, "POST", "/convocatorias", DATOS)).json();
    await llamar(eva, "PUT", `/convocatorias/${id}/inscripcion`);
    const real = await fetch(`${url}/api/pruebas/importar?idExterno=1&nombre=Real&deporte=duatlon&fecha=2027-02-07`, {
      method: "POST", headers: { Cookie: admin, "Content-Type": "application/octet-stream" },
      body: await crearExcel([finalista("Eva Gil", 1995, "Club Uno", 1, 1, "00:52:00"), finalista("Beto Ruiz", 1990, "Club Dos", 2, 2, "00:53:00")]),
    });
    const { prueba } = await real.json();

    const vinculo = await llamar(admin, "PUT", `/convocatorias/${id}/listado`, { pruebaId: prueba.id });
    assert.equal(vinculo.status, 200);
    const r = await vinculo.json();
    assert.deepEqual([r.participantes, r.participaron, r.noParticiparon, r.sinApuntarse], [2, 1, 0, 1]);
    assert.deepEqual(await (await llamar(admin, "GET", `/convocatorias/${id}/asistencia`)).json(), r);
    assert.equal((await (await llamar(undefined, "GET", "/convocatorias")).json())[0].estado, "celebrada");
  } finally { cerrar(); }
});

test("ERROR: sin sesión 401, usuario normal 403, datos inválidos 400 y carrera inexistente 404", async () => {
  const { entrar, llamar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    const eva = await entrar("eva@correo.es");
    assert.equal((await llamar(undefined, "POST", "/convocatorias", DATOS)).status, 401);
    assert.equal((await llamar(undefined, "PUT", "/convocatorias/x/inscripcion")).status, 401);
    assert.equal((await llamar(eva, "POST", "/convocatorias", DATOS)).status, 403);
    assert.equal((await llamar(admin, "POST", "/convocatorias", { ...DATOS, fecha: "mañana" })).status, 400);
    assert.equal((await llamar(admin, "POST", "/convocatorias", { ...DATOS, deporte: "natacion" })).status, 400);
    assert.equal((await llamar(eva, "PUT", "/convocatorias/no-existe/inscripcion")).status, 404);
    const { id } = await (await llamar(admin, "POST", "/convocatorias", DATOS)).json();
    assert.equal((await llamar(eva, "GET", `/convocatorias/${id}/inscripciones`)).status, 403);
    assert.equal((await llamar(eva, "DELETE", `/convocatorias/${id}`)).status, 403);
    assert.equal((await llamar(admin, "GET", `/convocatorias/${id}/asistencia`)).status, 400);
    assert.equal((await llamar(admin, "PUT", `/convocatorias/${id}/listado`, { pruebaId: "no-existe" })).status, 404);
  } finally { cerrar(); }
});
