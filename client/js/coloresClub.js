// Estilo del punto de color de un club a partir de sus colores (CSS). Sin DOM, para poder probarlo.
// Un color → fondo liso; varios → franjas verticales del mismo ancho.
export function fondoDeColores(colores) {
  const lista = (colores ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  if (!lista.length) return null;
  if (lista.length === 1) return lista[0];
  const paso = 100 / lista.length;
  return `linear-gradient(90deg, ${lista.map((c, i) => `${c} ${i * paso}% ${(i + 1) * paso}%`).join(", ")})`;
}
