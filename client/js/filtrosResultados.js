// Filtros y orden de la clasificación de una prueba. Sin DOM: se puede probar con node:test.
import { tiempoDeSegmento } from "./segmentos.js";

const normalizar = (texto) => String(texto ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const contieneTodas = (texto, buscado) => {
  const t = normalizar(texto);
  return normalizar(buscado).split(/\s+/).filter(Boolean).every((palabra) => t.includes(palabra));
};
const tiempoDe = tiempoDeSegmento;

// comunidad: nombre exacto de la comunidad de la licencia federativa (no es de dónde es el atleta).
// atleta y club: texto libre (todas las palabras, sin tildes ni mayúsculas).
// orden: "posicion" (el de la clasificación) o el índice 0..4 del parcial por el que ordenar, de menor a mayor tiempo.
// Quien no tiene ese parcial (abandono, parciales incompletos) va al final.
export function filtrarClasificacion(clasificacion, { atleta = "", club = "", comunidad = "", orden = "posicion" } = {}) {
  const filas = clasificacion.filter((f) =>
    (!normalizar(atleta) || contieneTodas(f.atleta.nombre, atleta)) &&
    (!normalizar(club) || contieneTodas(f.club?.nombre ?? "", club)) &&
    (!comunidad || f.comunidad === comunidad));
  const i = Number(orden);
  if (orden === "posicion" || !Number.isInteger(i) || i < 0 || i > 4) return filas;
  return filas
    .map((f, k) => ({ f, k, t: tiempoDe(f, i) }))
    .sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || a.k - b.k)
    .map(({ f }) => f);
}

// ¿Esta fila tiene el mejor tiempo del parcial i? (mejores = mejoresSegmentos de la API)
export function esMejorSegmento(mejores, i, fila) {
  return Boolean(mejores?.[i]?.atletas.some((a) => a.id === fila.atleta.id)) && tiempoDe(fila, i) === mejores[i].tiempo;
}
