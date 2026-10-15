// Pruebas HTTP de POST /api/prueba/password (VARIANTE-1).
import test from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../server/app.js";

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

const enviar = (url, cuerpo, tipo = "application/json") =>
  fetch(`${url}/api/prueba/password`, { method: "POST", headers: { "Content-Type": tipo }, body: cuerpo });

test("variante1: POST /api/prueba/password responde 200 con valida y errores (sin sesión)", async () => {
  const { url, cerrar } = await arrancar();
  try {
    let r = await enviar(url, JSON.stringify({ password: "abc1" }));
    assert.equal(r.status, 200);
    const cuerpo = await r.json();
    assert.equal(cuerpo.valida, false);
    assert.deepEqual([...cuerpo.errores].sort(), ["LONGITUD", "MAYUSCULA"]);

    r = await enviar(url, JSON.stringify({ password: "Abcdefgh12" }));
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { valida: true, errores: [] });
  } finally {
    cerrar();
  }
});

test("variante1: ERROR password ausente o de tipo incorrecto responde 400 {error}", async () => {
  const { url, cerrar } = await arrancar();
  try {
    for (const cuerpo of [{}, { password: 123 }, { password: null }, { password: ["a"] }]) {
      const r = await enviar(url, JSON.stringify(cuerpo));
      assert.equal(r.status, 400);
      assert.ok((await r.json()).error);
    }
  } finally {
    cerrar();
  }
});

test("variante1: ERROR un JSON mal formado responde 400 {error}, no 500", async () => {
  const { url, cerrar } = await arrancar();
  try {
    const r = await enviar(url, "{password:");
    assert.equal(r.status, 400);
    assert.ok((await r.json()).error);
  } finally {
    cerrar();
  }
});
