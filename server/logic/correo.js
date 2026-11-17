// Envío del correo de confirmación de cuenta. Si el envío falla, el alta NO falla: se avisa en el log
// con el enlace de confirmación para poder recuperarlo (la cuenta ya está creada y pendiente).
import nodemailer from "nodemailer";

const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function enlaceDeConfirmacion(urlBase, token) {
  const enlace = new URL("/api/confirmar", urlBase);
  enlace.searchParams.set("token", token);
  return enlace.toString();
}

// transporte: objeto de nodemailer (createTransport). desde: remitente. urlBase: dirección pública de la app.
export function crearNotificadorCorreo({ transporte, desde, urlBase, log = { info() {}, error() {} } }) {
  return async (usuario, token) => {
    const enlace = enlaceDeConfirmacion(urlBase, token);
    try {
      await transporte.sendMail({
        from: desde,
        to: usuario.email,
        subject: "Confirma tu cuenta",
        text: `Hola ${usuario.nombre}:\n\nPara activar tu cuenta abre este enlace:\n${enlace}\n\nSi no has sido tú, ignora este correo.`,
        html: `<p>Hola ${escapar(usuario.nombre)}:</p><p>Para activar tu cuenta pulsa <a href="${escapar(enlace)}">este enlace</a>.</p><p>Si no has sido tú, ignora este correo.</p>`,
      });
      log.info("Correo de confirmación enviado", { id: usuario.id });
    } catch (error) {
      // Sin correo la cuenta queda pendiente; el enlace sigue disponible en el log para el administrador.
      log.error(`No se pudo enviar el correo de confirmación a ${usuario.email}: ${error.message}. Enlace: ${enlace}`);
    }
  };
}

// Construye el notificador con las variables SMTP_*. Devuelve null si falta alguna: entonces la app
// sigue escribiendo el enlace en el log, como antes.
//   SMTP_HOST, SMTP_PORT (por defecto 465), SMTP_USER, SMTP_PASS, SMTP_FROM (por defecto SMTP_USER), URL_PUBLICA
export function crearNotificadorDesdeEntorno(env, log) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, URL_PUBLICA } = env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !URL_PUBLICA) return null;
  const puerto = Number(env.SMTP_PORT) || 465;
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST, port: puerto, secure: puerto === 465, auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return crearNotificadorCorreo({ transporte, desde: env.SMTP_FROM || SMTP_USER, urlBase: URL_PUBLICA, log });
}
