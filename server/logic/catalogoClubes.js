// Catálogo de clubes del Ranking Nacional de Clubes de la FETRI (temporada 2026, 659 clubes, copiado de
// https://live.triatlon.org/Rankings/RkClub el 24/11/2026). Sirve para elegir club al solicitar ser director.
// Algunos clubes no tienen comunidad autónoma en la fuente: se dejan en blanco.
import { readFileSync } from "node:fs";
import { claveClub } from "./normalizacion.js";

export const PREFIJO_CATALOGO = "fetri:";

export function cargarCatalogoClubes(ruta = new URL("../data/clubes-fetri-2026.txt", import.meta.url)) {
  const vistos = new Set();
  const clubes = [];
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const [nombre, comunidad = ""] = linea.split("|").map((t) => t.trim());
    if (!nombre) continue;
    const clave = claveClub(nombre);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    clubes.push({ id: PREFIJO_CATALOGO + clave, clave, nombre, comunidad });
  }
  return clubes;
}
