import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";

function servicio() {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, unicos]) => [n, crearColeccionMemoria({ unicos })]));
  return { repos, dominio: crearServicioDominio(repos) };
}
const rechaza = (codigo) => (e) => e.codigo === codigo;
const prueba = { idExterno: "2449:5790", nombre: "Duatlón Águilas", deporte: "duatlon", fecha: "2026-02-15" };

test("el mismo atleta escrito distinto es un único atleta", async () => {
  const { dominio, repos } = servicio();
  const a = await dominio.obtenerOCrearAtleta({ nombre: "Jesús Narro Miñano", anioNacimiento: 1990 });
  const b = await dominio.obtenerOCrearAtleta({ nombre: "JESUS  NARRO MINANO", anioNacimiento: "1990" });
  assert.equal(a.id, b.id);
  assert.equal((await repos.atletas.listar()).length, 1);
});

test("mismo nombre con otro año de nacimiento son atletas distintos", async () => {
  const { dominio } = servicio();
  const a = await dominio.obtenerOCrearAtleta({ nombre: "Ana López", anioNacimiento: 1990 });
  const b = await dominio.obtenerOCrearAtleta({ nombre: "Ana López", anioNacimiento: 1991 });
  assert.notEqual(a.id, b.id);
});

test("ERROR: atleta sin nombre, con año inválido o sexo desconocido", async () => {
  const { dominio } = servicio();
  await assert.rejects(dominio.obtenerOCrearAtleta({ nombre: "", anioNacimiento: 1990 }), rechaza("DATOS_INVALIDOS"));
  await assert.rejects(dominio.obtenerOCrearAtleta({ nombre: "Ana", anioNacimiento: "x" }), rechaza("DATOS_INVALIDOS"));
  await assert.rejects(dominio.obtenerOCrearAtleta({ nombre: "Ana", anioNacimiento: 1990, sexo: "Z" }), rechaza("DATOS_INVALIDOS"));
});

test("el club se guarda por temporada y puede cambiar de un año a otro", async () => {
  const { dominio } = servicio();
  const atleta = await dominio.obtenerOCrearAtleta({ nombre: "Ana López", anioNacimiento: 1990 });
  const c1 = await dominio.obtenerOCrearClub("Club Triatlón Soria");
  const c2 = await dominio.obtenerOCrearClub("CLUB TRIATLON SORIA"); // mismo club
  assert.equal(c1.id, c2.id);
  const otro = await dominio.obtenerOCrearClub("Club Tri Albacete");
  await dominio.asignarClub(atleta.id, 2026, c1.id);
  await dominio.asignarClub(atleta.id, 2027, otro.id);
  assert.equal((await dominio.clubDeAtleta(atleta.id, "2026")).id, c1.id);
  assert.equal((await dominio.clubDeAtleta(atleta.id, "2027")).id, otro.id);
  assert.equal(await dominio.clubDeAtleta(atleta.id, "2030"), null);
});

test("reasignar club en la misma temporada lo cambia sin duplicar", async () => {
  const { dominio, repos } = servicio();
  const atleta = await dominio.obtenerOCrearAtleta({ nombre: "Ana López", anioNacimiento: 1990 });
  const c1 = await dominio.obtenerOCrearClub("Uno");
  const c2 = await dominio.obtenerOCrearClub("Dos");
  await dominio.asignarClub(atleta.id, "2026", c1.id);
  await dominio.asignarClub(atleta.id, "2026", c2.id);
  assert.equal((await dominio.clubDeAtleta(atleta.id, "2026")).id, c2.id);
  assert.equal((await repos.pertenencias.listar()).length, 1);
});

test("ERROR: asignar club con atleta, club o temporada inexistentes o inválidos", async () => {
  const { dominio } = servicio();
  const atleta = await dominio.obtenerOCrearAtleta({ nombre: "Ana López", anioNacimiento: 1990 });
  const club = await dominio.obtenerOCrearClub("Uno");
  await assert.rejects(dominio.asignarClub("nada", "2026", club.id), rechaza("NO_ENCONTRADO"));
  await assert.rejects(dominio.asignarClub(atleta.id, "2026", "nada"), rechaza("NO_ENCONTRADO"));
  await assert.rejects(dominio.asignarClub(atleta.id, "26", club.id), rechaza("DATOS_INVALIDOS"));
});

test("crear prueba, obtenerla y listarlas ordenadas por fecha", async () => {
  const { dominio } = servicio();
  const tarde = await dominio.crearPrueba({ ...prueba, idExterno: "b", nombre: "Tarde", fecha: "2026-05-01" });
  await dominio.crearPrueba({ ...prueba, idExterno: "a", nombre: "Pronto", fecha: "2026-02-01" });
  await dominio.crearPrueba({ ...prueba, idExterno: "c", deporte: "triatlon", nombre: "Tri", fecha: "2026-03-01" });
  assert.equal(tarde.temporada, "2026");
  assert.equal((await dominio.obtenerPrueba(tarde.id)).nombre, "Tarde");
  assert.deepEqual((await dominio.listarPruebas({ deporte: "duatlon" })).map((p) => p.nombre), ["Pronto", "Tarde"]);
  assert.equal((await dominio.listarPruebas()).length, 3);
});

test("ERROR: prueba duplicada, deporte o fecha inválidos, inexistente", async () => {
  const { dominio } = servicio();
  await dominio.crearPrueba(prueba);
  await assert.rejects(dominio.crearPrueba(prueba), rechaza("DUPLICADO"));
  await assert.rejects(dominio.crearPrueba({ ...prueba, idExterno: "x", deporte: "natacion" }), rechaza("DATOS_INVALIDOS"));
  await assert.rejects(dominio.crearPrueba({ ...prueba, idExterno: "x", fecha: "15/02/2026" }), rechaza("DATOS_INVALIDOS"));
  await assert.rejects(dominio.crearPrueba({ ...prueba, idExterno: "" }), rechaza("DATOS_INVALIDOS"));
  await assert.rejects(dominio.obtenerPrueba("nada"), rechaza("NO_ENCONTRADO"));
});
