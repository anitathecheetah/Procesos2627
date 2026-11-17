// Próximas carreras e inscripciones (PBI-37) y comparación con el listado real (PBI-38).
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioConvocatorias, coincidenNombres } from "../../server/logic/convocatorias.js";
import { crearServicioImportacion } from "../../server/logic/importacion.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearServicioUsuarios } from "../../server/logic/usuarios.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { crearExcel, finalista } from "../helpers/excelSintetico.js";

const codigo = (c) => (e) => e.codigo === c;
const cifrador = { cifrar: async (t) => `hash(${t})`, comparar: async (t, h) => h === `hash(${t})` };
const DATOS = { nombre: "Duatlón Águilas 2027", deporte: "duatlon", fecha: "2027-02-07", lugar: "Águilas (Murcia)" };

async function preparar() {
  const repositorio = crearRepositorioMemoria();
  const usuarios = crearServicioUsuarios(repositorio, { cifrador, emailAdmin: "admin@correo.es" });
  const registrar = async (nombre, email) => {
    const u = await usuarios.alta({ nombre, email, password: "ClaveSegura123" });
    await repositorio.actualizar({ ...(await repositorio.buscarPorId(u.id)), estado: "activo" });
    return u.id;
  };
  const admin = await registrar("Admin", "admin@correo.es");
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const importacion = crearServicioImportacion({ repos, dominio: crearServicioDominio(repos), usuarios });
  return { admin, registrar, repos, importacion, servicio: crearServicioConvocatorias({ repos, usuarios }) };
}

test("el administrador crea una carrera y aparece en el listado abierta y sin apuntados", async () => {
  const { admin, servicio } = await preparar();
  const c = await servicio.crear(admin, { ...DATOS, nombre: "  Duatlón   Águilas 2027 " });
  assert.equal(c.nombre, "Duatlón Águilas 2027");
  assert.equal(c.estado, "abierta");
  const lista = await servicio.listar();
  assert.deepEqual(lista.map((x) => [x.nombre, x.apuntados, x.estado]), [["Duatlón Águilas 2027", 0, "abierta"]]);
  assert.ok(!("creadaPor" in lista[0]) && !("apuntado" in lista[0]));
});

test("ERROR: solo el administrador crea o borra carreras; los datos se validan", async () => {
  const { admin, registrar, servicio } = await preparar();
  const usuario = await registrar("Eva Gil", "eva@correo.es");
  await assert.rejects(servicio.crear(usuario, DATOS), codigo("PROHIBIDO"));
  await assert.rejects(servicio.crear(undefined, DATOS), codigo("NO_AUTENTICADO"));
  await assert.rejects(servicio.crear(admin, { ...DATOS, nombre: "ab" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.crear(admin, { ...DATOS, deporte: "natacion" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.crear(admin, { ...DATOS, fecha: "07/02/2027" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.crear(admin, { ...DATOS, fecha: "2027-02-31" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.crear(admin, { ...DATOS, lugar: "x".repeat(101) }), codigo("DATOS_INVALIDOS"));
  const c = await servicio.crear(admin, DATOS);
  await assert.rejects(servicio.eliminar(usuario, c.id), codigo("PROHIBIDO"));
});

test("apuntarse y desapuntarse: se cuenta una vez por persona y se refleja en `apuntado`", async () => {
  const { admin, registrar, servicio } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  const eva = await registrar("Eva Gil", "eva@correo.es");
  const raul = await registrar("Raúl Soto", "raul@correo.es");
  await servicio.apuntarse(eva, c.id);
  await servicio.apuntarse(eva, c.id); // repetir no duplica
  await servicio.apuntarse(raul, c.id);
  let [fila] = await servicio.listar({ usuarioId: eva });
  assert.equal(fila.apuntados, 2);
  assert.equal(fila.apuntado, true);
  await servicio.desapuntarse(eva, c.id);
  await servicio.desapuntarse(eva, c.id); // repetir no falla
  [fila] = await servicio.listar({ usuarioId: eva });
  assert.deepEqual([fila.apuntados, fila.apuntado], [1, false]);
});

test("ERROR: apuntarse exige sesión y una carrera abierta que exista", async () => {
  const { admin, registrar, servicio, repos, importacion } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  const eva = await registrar("Eva Gil", "eva@correo.es");
  await assert.rejects(servicio.apuntarse(undefined, c.id), codigo("NO_AUTENTICADO"));
  await assert.rejects(servicio.apuntarse(eva, "no-existe"), codigo("NO_ENCONTRADO"));
  const prueba = (await importacion.importar(admin, { idExterno: "1", nombre: "Real", deporte: "duatlon", fecha: "2027-02-07" },
    await crearExcel([finalista("Eva Gil", 1995, "Club", 1, 1, "00:50:00")]))).prueba;
  await servicio.vincularListado(admin, c.id, prueba.id);
  await assert.rejects(servicio.apuntarse(eva, c.id), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.desapuntarse(eva, c.id), codigo("DATOS_INVALIDOS"));
  assert.equal((await repos.convocatorias.buscarPorId(c.id)).estado, "celebrada");
});

test("solo el administrador ve quién se apuntó, y sin el email", async () => {
  const { admin, registrar, servicio } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  const eva = await registrar("Eva Gil", "eva@correo.es");
  await servicio.apuntarse(eva, c.id);
  assert.deepEqual(await servicio.apuntados(admin, c.id), [{ usuarioId: eva, nombre: "Eva Gil" }]);
  await assert.rejects(servicio.apuntados(eva, c.id), codigo("PROHIBIDO"));
});

test("borrar una carrera borra también sus inscripciones", async () => {
  const { admin, registrar, servicio, repos } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  await servicio.apuntarse(await registrar("Eva Gil", "eva@correo.es"), c.id);
  await servicio.eliminar(admin, c.id);
  assert.deepEqual(await servicio.listar(), []);
  assert.deepEqual(await repos.inscripciones.listar(), []);
  await assert.rejects(servicio.eliminar(admin, c.id), codigo("NO_ENCONTRADO"));
});

test("el listado ordena primero las abiertas (la más próxima arriba) y luego las celebradas", async () => {
  const { admin, servicio, importacion } = await preparar();
  const lejana = await servicio.crear(admin, { ...DATOS, nombre: "Lejana", fecha: "2027-06-01" });
  await servicio.crear(admin, { ...DATOS, nombre: "Cercana", fecha: "2027-02-07" });
  const vieja = await servicio.crear(admin, { ...DATOS, nombre: "Vieja", fecha: "2026-01-01" });
  const prueba = (await importacion.importar(admin, { idExterno: "1", nombre: "Real", deporte: "duatlon", fecha: "2026-01-01" },
    await crearExcel([finalista("Eva Gil", 1995, "Club", 1, 1, "00:50:00")]))).prueba;
  await servicio.vincularListado(admin, vieja.id, prueba.id);
  assert.deepEqual((await servicio.listar()).map((c) => c.nombre), ["Cercana", "Lejana", "Vieja"]);
  assert.ok(lejana.id);
});

test("coincidenNombres: orden, tildes y formato «APELLIDOS, NOMBRE»; exige al menos 2 palabras", () => {
  assert.equal(coincidenNombres("Ana Rodríguez", "RODRIGUEZ MARTIN, ANA"), true);
  assert.equal(coincidenNombres("rodriguez ana", "Ana Rodríguez Martín"), true);
  assert.equal(coincidenNombres("Ana", "Ana Rodríguez"), false, "una sola palabra no basta");
  assert.equal(coincidenNombres("Ana Pérez", "Ana Rodríguez"), false);
  assert.equal(coincidenNombres("Ana Rodrí", "Ana Rodríguez"), false, "palabras completas");
});

test("vincular el listado real: quién de los apuntados participó, quién no y cuántos corrieron sin apuntarse", async () => {
  const { admin, registrar, servicio, importacion } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  for (const [n, e] of [["Ana Rodríguez", "ana@c.es"], ["Beto Ruiz", "beto@c.es"], ["Carla Gil", "carla@c.es"]]) await servicio.apuntarse(await registrar(n, e), c.id);
  const prueba = (await importacion.importar(admin, { idExterno: "1", nombre: "Águilas real", deporte: "duatlon", fecha: "2027-02-07" },
    await crearExcel([
      finalista("RODRIGUEZ MARTIN, ANA", 1995, "Club Uno", 1, 1, "00:50:00"),
      finalista("Carla Gil", 1992, "Club Dos", 2, 2, "00:51:00"),
      finalista("Dani Soto", 1990, "Club Dos", 3, 3, "00:52:00"),
    ]))).prueba;
  const r = await servicio.vincularListado(admin, c.id, prueba.id);
  assert.deepEqual([r.participantes, r.participaron, r.noParticiparon, r.sinApuntarse], [3, 2, 1, 1]);
  assert.deepEqual(r.apuntados.map((a) => [a.nombre, a.participo]), [["Ana Rodríguez", true], ["Beto Ruiz", false], ["Carla Gil", true]]);
  assert.equal(r.apuntados[0].atleta.nombre, "RODRIGUEZ MARTIN, ANA");
  assert.equal(r.apuntados[0].posicion, 1);
  assert.deepEqual(await servicio.asistencia(admin, c.id), r, "consultar después da lo mismo");
});

test("ERROR: vincular exige admin, una prueba que exista y del mismo deporte; asistencia exige haber vinculado", async () => {
  const { admin, registrar, servicio, importacion } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  const eva = await registrar("Eva Gil", "eva@correo.es");
  await assert.rejects(servicio.asistencia(admin, c.id), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.vincularListado(eva, c.id, "x"), codigo("PROHIBIDO"));
  await assert.rejects(servicio.vincularListado(admin, c.id, "no-existe"), codigo("NO_ENCONTRADO"));
  await assert.rejects(servicio.vincularListado(admin, c.id), codigo("NO_ENCONTRADO"));
  const tri = (await importacion.importar(admin, { idExterno: "9", nombre: "Tri", deporte: "triatlon", fecha: "2027-02-07" },
    await crearExcel([finalista("Eva Gil", 1995, "Club", 1, 1, "00:50:00")]))).prueba;
  await assert.rejects(servicio.vincularListado(admin, c.id, tri.id), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.asistencia(eva, c.id), codigo("PROHIBIDO"));
});
