// Pruebas unitarias del servicio de sesiones (sin HTTP).
import test from "node:test";
import assert from "node:assert/strict";
import { crearRepositorioSesionesMemoria } from "../../server/data/repositorioSesionesMemoria.js";
import { crearServicioSesiones } from "../../server/logic/sesiones.js";

test("una sesión iniciada se resuelve al usuario", async () => {
  const sesiones = crearServicioSesiones(crearRepositorioSesionesMemoria());
  const id = await sesiones.iniciar("u1");
  assert.equal(await sesiones.resolver(id), "u1");
});

test("cerrar la sesión la invalida", async () => {
  const sesiones = crearServicioSesiones(crearRepositorioSesionesMemoria());
  const id = await sesiones.iniciar("u1");
  await sesiones.cerrar(id);
  assert.equal(await sesiones.resolver(id), null);
});

test("ERROR: una sesión caducada o desconocida no se resuelve", async () => {
  let reloj = 1000;
  const sesiones = crearServicioSesiones(crearRepositorioSesionesMemoria(), { duracionMs: 100, ahora: () => reloj });
  const id = await sesiones.iniciar("u1");
  reloj += 101;
  assert.equal(await sesiones.resolver(id), null);
  assert.equal(await sesiones.resolver("inventada"), null);
  assert.equal(await sesiones.resolver(undefined), null);
});
