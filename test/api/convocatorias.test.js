// Pruebas HTTP de las próximas carreras, inscripciones y lista de salida (PBI-37/38).
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
  await repositorio.crear({ id: "eva", nombre: "Eva Gil Pérez", email: "eva@correo.es", rol: "user", estado: "activo", hash });
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

    assert.equal((await llamar(eva, "PUT", `/convocatorias/${id}/inscripcion`)).status, 400, "sin nombre completo no se apunta");
    assert.equal((await llamar(eva, "PUT", `/convocatorias/${id}/inscripcion`, { nombre: "Eva Gil Pérez" })).status, 204);
    const conSesion = await (await llamar(eva, "GET", "/convocatorias")).json();
    assert.deepEqual([conSesion[0].apuntados, conSesion[0].apuntado], [1, true]);

    const apuntados = await (await llamar(admin, "GET", `/convocatorias/${id}/inscripciones`)).json();
    assert.deepEqual(apuntados, [{ usuarioId: "eva", nombre: "Eva Gil Pérez" }]);

    assert.equal((await llamar(eva, "DELETE", `/convocatorias/${id}/inscripcion`, { nombre: "Eva Gil Pérez" })).status, 204);
    assert.equal((await (await llamar(undefined, "GET", "/convocatorias")).json())[0].apuntados, 0);
    assert.equal((await llamar(admin, "DELETE", `/convocatorias/${id}`)).status, 204);
    assert.deepEqual(await (await llamar(undefined, "GET", "/convocatorias")).json(), []);
  } finally { cerrar(); }
});

test("el admin sube la lista de salida: cierra la carrera, es pública y se compara con los apuntados", async () => {
  const { url, entrar, llamar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    const eva = await entrar("eva@correo.es");
    const { id } = await (await llamar(admin, "POST", "/convocatorias", DATOS)).json();
    await llamar(eva, "PUT", `/convocatorias/${id}/inscripcion`, { nombre: "Eva Gil Pérez" });
    const excel = await crearExcel([finalista("Eva Gil Pérez", 1995, "Club Uno", 1, 1, "00:52:00"), finalista("Beto Ruiz", 1990, "Club Dos", 2, 2, "00:53:00")]);
    const subir = (cookie) => fetch(`${url}/api/convocatorias/${id}/salida?sexo=F`, {
      method: "PUT", headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/octet-stream" }, body: excel,
    });
    assert.equal((await subir(undefined)).status, 401);
    assert.equal((await subir(eva)).status, 403);
    const r = await (await subir(admin)).json();
    assert.deepEqual([r.participantes, r.asistencia.enLista, r.asistencia.sinApuntarse], [2, 1, 1]);
    assert.deepEqual(await (await llamar(admin, "GET", `/convocatorias/${id}/asistencia`)).json(), r.asistencia);

    const publica = await (await llamar(undefined, "GET", `/convocatorias/${id}/salida`)).json();
    assert.deepEqual(publica.map((p) => p.atleta.nombre), ["Beto Ruiz", "Eva Gil Pérez"]);
    const lista = await (await llamar(undefined, "GET", "/convocatorias")).json();
    assert.deepEqual([lista[0].estado, lista[0].participantes], ["cerrada", 2]);
    assert.equal((await llamar(eva, "PUT", `/convocatorias/${id}/inscripcion`)).status, 400, "cerrada: no admite inscripciones");
  } finally { cerrar(); }
});

test("la predicción de una carrera futura usa su lista de salida", async () => {
  const { url, entrar, llamar, cerrar } = await arrancar();
  try {
    const admin = await entrar("admin@correo.es");
    const { id } = await (await llamar(admin, "POST", "/convocatorias", DATOS)).json();
    assert.equal((await llamar(undefined, "GET", `/prediccion/duatlon?convocatoria=${id}`)).status, 400, "sin lista de salida");
    await fetch(`${url}/api/convocatorias/${id}/salida`, {
      method: "PUT", headers: { Cookie: admin, "Content-Type": "application/octet-stream" },
      body: await crearExcel([finalista("Eva Gil Pérez", 1995, "Club Uno", 1, 1, "00:52:00"), finalista("Beto Ruiz", 1990, "Club Dos", 2, 2, "00:53:00"), finalista("Carla Gil", 1992, "Club Uno", 3, 3, "00:54:00")]),
    });
    const r = await llamar(undefined, "GET", `/prediccion/duatlon?convocatoria=${id}`);
    assert.equal(r.status, 200);
    const cuerpo = await r.json();
    assert.equal(cuerpo.filas.length, 3);
    assert.ok(cuerpo.filas.every((f) => f.sinHistorial === true), "nadie tiene Elo todavía");
    assert.equal(cuerpo.carrera.nombre, "Duatlón Águilas 2027");
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
    assert.equal((await llamar(undefined, "GET", "/convocatorias/no-existe/salida")).status, 404);
  } finally { cerrar(); }
});

test("preparación: días restantes en el listado y previsión + material en /preparacion", async () => {
  const { hoyEnEspana } = await import("../../server/logic/preparacion.js");
  const repositorio = crearRepositorioMemoria();
  const hash = await crearCifradorBcrypt().cifrar("secreta123");
  await repositorio.crear({ id: "admin", nombre: "Admin", email: "admin@correo.es", rol: "admin", estado: "activo", hash });
  const meteo = { prevision: async () => ({ lugar: "Águilas", tMin: 4, tMax: 13, probLluvia: 10, vientoKmh: 12, descripcion: "Nublado", fuente: "Open-Meteo" }) };
  const servidor = await new Promise((r) => { const s = crearApp({ repositorio, meteo, secreto: "secreto-de-prueba" }).listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}/api`;
  try {
    const cookie = (await fetch(`${url}/sesion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@correo.es", password: "secreta123" }) })).headers.getSetCookie()[0].split(";")[0];
    const en3 = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const { id } = await (await fetch(`${url}/convocatorias`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ ...DATOS, fecha: en3 }) })).json();
    const lista = await (await fetch(`${url}/convocatorias`)).json();
    assert.ok([2, 3, 4].includes(lista[0].diasRestantes), `días: ${lista[0].diasRestantes}`);
    const p = await (await fetch(`${url}/convocatorias/${id}/preparacion`)).json();
    assert.equal(p.tiempo.tMax, 13);
    assert.ok(p.recomendaciones.some((a) => /térmica/i.test(a.nombre)));
    assert.ok(hoyEnEspana());
    assert.equal((await fetch(`${url}/convocatorias/nada/preparacion`)).status, 404);
  } finally { servidor.close(); servidor.closeAllConnections(); }
});
