// Contrato y persistencia contra MongoDB real. Solo se ejecutan si MONGODB_URI_PRUEBA está definida
// (en el CI hay un MongoDB de servicio; en local, apúntala a una base de pruebas).
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { conectarBaseDatos } from "../../server/data/conexion.js";
import { pruebasDeContrato } from "./contrato.js";

const URI = process.env.MONGODB_URI_PRUEBA;
const sinBd = { skip: URI ? false : "Define MONGODB_URI_PRUEBA para ejecutar las pruebas con MongoDB" };

// Cada prueba usa una base de datos propia, que se borra al terminar.
async function nuevaBd() {
  const nombre = `pruebas_${randomUUID().slice(0, 8)}`;
  const conexion = await conectarBaseDatos(URI, nombre);
  const limpiar = async () => {
    await conexion.cerrar();
    const c = new MongoClient(URI);
    await c.connect();
    await c.db(nombre).dropDatabase();
    await c.close();
  };
  return { nombre, conexion, limpiar };
}

pruebasDeContrato("mongodb", async () => {
  const { conexion, limpiar } = await nuevaBd();
  return { repo: conexion.repositorio, limpiar };
}, sinBd);

test("[mongodb] ERROR: un email repetido se rechaza por el índice único", sinBd, async () => {
  const { conexion, limpiar } = await nuevaBd();
  try {
    const u = { id: "u1", nombre: "Ana", email: "ana@correo.es", rol: "user", estado: "pendiente" };
    await conexion.repositorio.crear(u);
    await assert.rejects(conexion.repositorio.crear({ ...u, id: "u2" }));
  } finally { await limpiar(); }
});

test("[mongodb] los datos persisten tras cerrar y abrir otra conexión (reinicio)", sinBd, async () => {
  const { nombre, conexion, limpiar } = await nuevaBd();
  try {
    await conexion.repositorio.crear({ id: "u1", nombre: "Ana", email: "ana@correo.es", rol: "user", estado: "activo" });
    await conexion.repositorioSesiones.crear({ id: "s1", usuarioId: "u1", expira: Date.now() + 60000 });
    await conexion.cerrar();

    const otra = await conectarBaseDatos(URI, nombre);
    assert.equal((await otra.repositorio.buscarPorEmail("ana@correo.es")).id, "u1");
    assert.equal((await otra.repositorioSesiones.buscar("s1")).usuarioId, "u1");
    await otra.cerrar();
  } finally { await limpiar(); }
});
