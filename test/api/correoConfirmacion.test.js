// Registro -> correo (simulado) -> enlace -> cuenta activa -> login, de extremo a extremo por HTTP.
import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { crearApp } from "../../server/app.js";
import { crearNotificadorCorreo } from "../../server/logic/correo.js";

test("el correo de confirmación enviado al registrarse contiene un enlace que activa la cuenta", async () => {
  const transporte = nodemailer.createTransport({ jsonTransport: true });
  const enviados = [];
  const original = transporte.sendMail.bind(transporte);
  transporte.sendMail = async (m) => { enviados.push(m); return original(m); };

  const servidor = await new Promise((r) => {
    const notificar = crearNotificadorCorreo({ transporte, desde: "app@ejemplo.es", urlBase: "http://placeholder" });
    const s = crearApp({ secreto: "secreto-de-prueba", notificar }).listen(0, () => r(s));
  });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  try {
    const alta = await fetch(`${url}/api/usuarios`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: "Ana", email: "ana@correo.es", password: "Secreta1234" }) });
    assert.equal(alta.status, 201);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].to, "ana@correo.es");

    const login = (password) => fetch(`${url}/api/sesion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "ana@correo.es", password }) });
    assert.equal((await login("Secreta1234")).status, 403); // pendiente: aún no puede entrar

    const token = new URL(enviados[0].text.match(/https?:\/\/\S+/)[0]).searchParams.get("token");
    const confirmar = await fetch(`${url}/api/confirmar?token=${token}`, { redirect: "manual" });
    assert.equal(confirmar.status, 302);
    assert.equal((await login("Secreta1234")).status, 200);
  } finally { servidor.close(); servidor.closeAllConnections(); }
});
