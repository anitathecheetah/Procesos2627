// Categoría de una prueba (p. ej. "elite-masculino"): etiqueta legible y sexo. Módulo puro, sin DOM.

// "elite-masculino" → "Élite masculino". Sin categoría devuelve "".
export function etiquetaCategoria(categoria) {
  const texto = String(categoria ?? "").trim().replaceAll("-", " ").replaceAll("_", " ");
  if (!texto) return "";
  const palabras = texto.split(/\s+/).map((p) => (p.toLowerCase() === "elite" ? "élite" : p));
  const frase = palabras.join(" ");
  return frase[0].toUpperCase() + frase.slice(1);
}

// "M", "F" o null si la categoría no lo dice (mixta o sin categoría).
export function sexoDeCategoria(categoria) {
  const texto = String(categoria ?? "");
  if (/femenin/i.test(texto)) return "F";
  if (/masculin/i.test(texto)) return "M";
  return null;
}

// Una prueba encaja con el sexo elegido ("" = todos); si no se sabe su sexo, se muestra siempre.
export function pruebaEncajaConSexo(prueba, sexo) {
  if (!sexo) return true;
  const sexoPrueba = prueba.sexo ?? sexoDeCategoria(prueba.categoria);
  return !sexoPrueba || sexoPrueba === sexo;
}

// "caceres duatlon · Élite femenino" (el nombre solo si no hay categoría).
export function nombreConCategoria(prueba) {
  const categoria = etiquetaCategoria(prueba.categoria);
  return categoria ? `${prueba.nombre} · ${categoria}` : prueba.nombre;
}
