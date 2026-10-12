// Cookies de sesión firmadas con HMAC-SHA256. El secreto viene de una variable de entorno.
import { createHmac, timingSafeEqual } from "node:crypto";

export const NOMBRE_COOKIE = "sesion";

const firma = (valor, secreto) => createHmac("sha256", secreto).update(valor).digest("base64url");

export const firmar = (valor, secreto) => `${valor}.${firma(valor, secreto)}`;

// Devuelve el valor original si la firma es correcta; null si no.
export function verificar(firmado, secreto) {
  if (typeof firmado !== "string") return null;
  const i = firmado.lastIndexOf(".");
  if (i < 1) return null;
  const valor = firmado.slice(0, i);
  const recibida = Buffer.from(firmado.slice(i + 1));
  const esperada = Buffer.from(firma(valor, secreto));
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada) ? valor : null;
}

export function leerCookie(req, nombre) {
  for (const parte of (req.headers.cookie ?? "").split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave === nombre) return resto.join("=");
  }
  return null;
}

// Cabecera Set-Cookie. HttpOnly: el JavaScript del navegador no puede leerla.
export function crearCookie(valor, { maxAgeSegundos, seguro }) {
  return [
    `${NOMBRE_COOKIE}=${valor}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSegundos}`,
    ...(seguro ? ["Secure"] : []),
  ].join("; ");
}

export const borrarCookie = (opciones) => crearCookie("", { ...opciones, maxAgeSegundos: 0 });
