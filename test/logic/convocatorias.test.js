// Próximas carreras e inscripciones (PBI-37) y lista de salida oficial (PBI-38).
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioConvocatorias, coincidenNombres } from "../../server/logic/convocatorias.js";
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
  const dominio = crearServicioDominio(repos);
  const salida = (nombres, { anio = 1990 } = {}) => crearExcel(nombres.map((n, i) => finalista(n, anio, "Club Uno", i + 1, i + 1, "00:50:00")));
  return { admin, registrar, repos, salida, servicio: crearServicioConvocatorias({ repos, usuarios, dominio }) };
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

test("coincidenNombres: orden, tildes y formato «APELLIDOS, NOMBRE»; exige al menos 2 palabras", () => {
  assert.equal(coincidenNombres("Ana Rodríguez", "RODRIGUEZ MARTIN, ANA"), true);
  assert.equal(coincidenNombres("rodriguez ana", "Ana Rodríguez Martín"), true);
  assert.equal(coincidenNombres("Ana", "Ana Rodríguez"), false, "una sola palabra no basta");
  assert.equal(coincidenNombres("Ana Pérez", "Ana Rodríguez"), false);
  assert.equal(coincidenNombres("Ana Rodrí", "Ana Rodríguez"), false, "palabras completas");
});

test("ERROR: apuntarse exige sesión y una carrera abierta que exista; con lista de salida ya no admite cambios", async () => {
  const { admin, registrar, servicio, salida } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  const eva = await registrar("Eva Gil", "eva@correo.es");
  await assert.rejects(servicio.apuntarse(undefined, c.id), codigo("NO_AUTENTICADO"));
  await assert.rejects(servicio.apuntarse(eva, "no-existe"), codigo("NO_ENCONTRADO"));
  await servicio.apuntarse(eva, c.id);
  await servicio.cargarListaSalida(admin, c.id, await salida(["Eva Gil"]));
  await assert.rejects(servicio.apuntarse(await registrar("Raúl Soto", "raul@correo.es"), c.id), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.desapuntarse(eva, c.id), codigo("DATOS_INVALIDOS"));
});

test("el listado ordena primero las abiertas (la más próxima arriba) y luego las cerradas", async () => {
  const { admin, servicio, salida } = await preparar();
  await servicio.crear(admin, { ...DATOS, nombre: "Lejana", fecha: "2027-06-01" });
  await servicio.crear(admin, { ...DATOS, nombre: "Cercana", fecha: "2027-02-07" });
  const cerrada = await servicio.crear(admin, { ...DATOS, nombre: "Con lista", fecha: "2027-01-01" });
  await servicio.cargarListaSalida(admin, cerrada.id, await salida(["Eva Gil"]));
  const lista = await servicio.listar();
  assert.deepEqual(lista.map((c) => c.nombre), ["Cercana", "Lejana", "Con lista"]);
  assert.deepEqual(lista.map((c) => c.participantes), [0, 0, 1]);
});

test("subir la lista de salida: cierra la carrera y la compara con los apuntados", async () => {
  const { admin, registrar, servicio, salida } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  for (const [n, e] of [["Ana Rodríguez", "ana@c.es"], ["Beto Ruiz", "beto@c.es"], ["Carla Gil", "carla@c.es"]]) await servicio.apuntarse(await registrar(n, e), c.id);
  const r = await servicio.cargarListaSalida(admin, c.id, await salida(["RODRIGUEZ MARTIN, ANA", "Carla Gil", "Dani Soto"]), { sexo: "F" });
  assert.deepEqual([r.participantes, r.menoresExcluidos, r.descartadas.length], [3, 0, 0]);
  const a = r.asistencia;
  assert.deepEqual([a.participantes, a.enLista, a.noEnLista, a.sinApuntarse], [3, 2, 1, 1]);
  assert.deepEqual(a.apuntados.map((x) => [x.nombre, x.enLista]), [["Ana Rodríguez", true], ["Beto Ruiz", false], ["Carla Gil", true]]);
  assert.equal(a.apuntados[0].atleta.nombre, "RODRIGUEZ MARTIN, ANA");
  assert.equal(a.apuntados[0].dorsal, "1");
  assert.deepEqual(await servicio.asistencia(admin, c.id), a, "consultar después da lo mismo");
  assert.equal((await servicio.listar())[0].estado, "cerrada");
});

test("la lista de salida es pública y se puede volver a subir (sustituye a la anterior)", async () => {
  const { admin, servicio, salida } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  await servicio.cargarListaSalida(admin, c.id, await salida(["Ana Uno", "Beto Dos"]));
  await servicio.cargarListaSalida(admin, c.id, await salida(["Carla Tres"]));
  const lista = await servicio.listaSalida(c.id);
  assert.deepEqual(lista.map((p) => [p.atleta.nombre, p.club.nombre, p.dorsal]), [["Carla Tres", "Club Uno", "1"]]);
  assert.ok(!("anioNacimiento" in lista[0].atleta), "no se publica el año de nacimiento");
});

test("los posibles menores no entran en la lista de salida (ni se guardan)", async () => {
  const { admin, servicio, salida, repos } = await preparar();
  const c = await servicio.crear(admin, DATOS); // carrera en 2027: los nacidos en 2009 o después son posibles menores
  const r = await servicio.cargarListaSalida(admin, c.id, await crearExcel([
    finalista("Mayor Adulto", 1990, "Club", 1, 1, "00:50:00"), finalista("Joven Promesa", 2010, "Club", 2, 2, "00:51:00"),
  ]));
  assert.deepEqual([r.participantes, r.menoresExcluidos], [1, 1]);
  assert.equal((await repos.atletas.listar()).some((a) => a.nombre === "Joven Promesa"), false, "su nombre no llega a la base de datos");
  await assert.rejects(servicio.cargarListaSalida(admin, c.id, await salida(["Solo Joven"], { anio: 2012 })), codigo("DATOS_INVALIDOS"));
});

test("ERROR: subir la lista exige admin, un Excel válido y una carrera que exista; la asistencia exige haberla subido", async () => {
  const { admin, registrar, servicio, salida } = await preparar();
  const c = await servicio.crear(admin, DATOS);
  const eva = await registrar("Eva Gil", "eva@correo.es");
  await assert.rejects(servicio.asistencia(admin, c.id), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.cargarListaSalida(eva, c.id, await salida(["Ana Uno"])), codigo("PROHIBIDO"));
  await assert.rejects(servicio.asistencia(eva, c.id), codigo("PROHIBIDO"));
  await assert.rejects(servicio.cargarListaSalida(admin, "no-existe", await salida(["Ana Uno"])), codigo("NO_ENCONTRADO"));
  await assert.rejects(servicio.cargarListaSalida(admin, c.id, Buffer.alloc(0)), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.cargarListaSalida(admin, c.id, Buffer.from("no es un excel")), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.cargarListaSalida(admin, c.id, await salida(["Ana Uno"]), { sexo: "X" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.listaSalida("no-existe"), codigo("NO_ENCONTRADO"));
});
