// Normalización de nombres y clave de identidad de los atletas.
// Los identificadores de la web de resultados son por prueba, no por persona; por eso un atleta
// se identifica por su nombre normalizado + su año de nacimiento.
import { ErrorLogica } from "./errores.js";

// "  Sánchez  Díaz (ESP), Jesús " -> "SANCHEZ DIAZ, JESUS"
export function normalizarNombre(texto) {
  if (typeof texto !== "string") return "";
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes y diéresis
    .replace(/\([^)]*\)/g, " ") // quita lo que va entre paréntesis
    .replace(/[^\p{L}\p{N},\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim()
    .toUpperCase();
}

export function validarAnioNacimiento(anio) {
  const n = Number(anio);
  const actual = new Date().getFullYear();
  if (!Number.isInteger(n) || n < 1900 || n > actual) {
    throw new ErrorLogica("DATOS_INVALIDOS", "El año de nacimiento no es válido");
  }
  return n;
}

// Clave única de un atleta: "SANCHEZ DIAZ, JESUS|1992".
export function claveAtleta(nombre, anioNacimiento) {
  const normalizado = normalizarNombre(nombre);
  if (normalizado === "") throw new ErrorLogica("DATOS_INVALIDOS", "El nombre del atleta es obligatorio");
  return `${normalizado}|${validarAnioNacimiento(anioNacimiento)}`;
}

// Clave de un club: sin tildes, mayúsculas y espacios simples.
export function claveClub(nombre) {
  const normalizado = normalizarNombre(nombre);
  if (normalizado === "") throw new ErrorLogica("DATOS_INVALIDOS", "El nombre del club es obligatorio");
  return normalizado;
}
