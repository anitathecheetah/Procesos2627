// Pruebas de integración de la API con peticiones HTTP reales (node:test).
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";

// Arranca la app en un puerto libre y devuelve la URL base y una función para cerrarla.
async function arrancar() {
  const servidor = await new Promise((resolver) => {
    const s = crearApp().listen(0, () => resolver(s));
  });
  const { port } = servidor.address();
  return {
    url: `http://127.0.0.1:${port}`,
    cerrar: () => {
      servidor.close();
      servidor.closeAllConnections();
    },
  };
}

test("GET /api/salud responde 200 con {estado: 'ok'}", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const respuesta = await fetch(`${url}/api/salud`);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { estado: "ok" });
  } finally {
    cerrar();
  }
});

test("una ruta de la API que no existe responde 404 en JSON {error, codigo}", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const respuesta = await fetch(`${url}/api/no-existe`);
    assert.equal(respuesta.status, 404);
    const cuerpo = await respuesta.json();
    assert.equal(cuerpo.codigo, "NO_ENCONTRADO");
    assert.ok(cuerpo.error);
  } finally {
    cerrar();
  }
});
