// Pruebas del correo de confirmación con envío SIMULADO (jsonTransport): no sale ningún correo real.
import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { crearNotificadorCorreo, crearNotificadorDesdeEntorno, enlaceDeConfirmacion } from "../../server/logic/correo.js";

const URL_BASE = "https://app.ejemplo.es";
const usuario = { id: "u1", nombre: "Ana", email: "ana@correo.es" };
const registro = () => { const mensajes = []; return { mensajes, log: { info: (m) => mensajes.push(["info", m]), error: (m) => mensajes.push(["error", m]) } }; };

test("el enlace de confirmación usa la URL pública y codifica el token", () => {
  assert.equal(enlaceDeConfirmacion(URL_BASE, "abc-123"), "https://app.ejemplo.es/api/confirmar?token=abc-123");
  assert.equal(enlaceDeConfirmacion("https://app.ejemplo.es/", "a b&c"), "https://app.ejemplo.es/api/confirmar?token=a+b%26c");
});

test("envía un correo al usuario con el enlace, en texto y en HTML", async () => {
  const transporte = nodemailer.createTransport({ jsonTransport: true });
  const enviados = [];
  const original = transporte.sendMail.bind(transporte);
  transporte.sendMail = async (m) => { enviados.push(m); return original(m); };
  await crearNotificadorCorreo({ transporte, desde: "App <app@ejemplo.es>", urlBase: URL_BASE })(usuario, "tok-1");
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, "ana@correo.es");
  assert.equal(enviados[0].from, "App <app@ejemplo.es>");
  assert.match(enviados[0].subject, /Confirma/);
  assert.match(enviados[0].text, /https:\/\/app\.ejemplo\.es\/api\/confirmar\?token=tok-1/);
  assert.match(enviados[0].html, /href="https:\/\/app\.ejemplo\.es\/api\/confirmar\?token=tok-1"/);
});

test("el nombre del usuario se escapa en el HTML del correo", async () => {
  const transporte = nodemailer.createTransport({ jsonTransport: true });
  let html = "";
  transporte.sendMail = async (m) => { html = m.html; };
  await crearNotificadorCorreo({ transporte, desde: "a@b.es", urlBase: URL_BASE })({ ...usuario, nombre: '<img src=x onerror="alert(1)">' }, "t");
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;img/);
});

test("ERROR: si el envío falla no se lanza error y el enlace queda en el log", async () => {
  const { mensajes, log } = registro();
  const transporte = { sendMail: async () => { throw new Error("SMTP caído"); } };
  await crearNotificadorCorreo({ transporte, desde: "a@b.es", urlBase: URL_BASE, log })(usuario, "tok-9");
  const error = mensajes.find(([nivel]) => nivel === "error")[1];
  assert.match(error, /SMTP caído/);
  assert.match(error, /ana@correo\.es/);
  assert.match(error, /token=tok-9/);
});

test("sin todas las variables SMTP_* y URL_PUBLICA no hay notificador (se usa el log)", () => {
  assert.equal(crearNotificadorDesdeEntorno({}), null);
  assert.equal(crearNotificadorDesdeEntorno({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" }), null); // falta URL_PUBLICA
  assert.equal(crearNotificadorDesdeEntorno({ SMTP_HOST: "h", SMTP_USER: "u", URL_PUBLICA: URL_BASE }), null); // falta SMTP_PASS
});

test("con todas las variables se crea el notificador (sin conectar todavía)", () => {
  const f = crearNotificadorDesdeEntorno({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "u@gmail.com", SMTP_PASS: "p", URL_PUBLICA: URL_BASE });
  assert.equal(typeof f, "function");
});
