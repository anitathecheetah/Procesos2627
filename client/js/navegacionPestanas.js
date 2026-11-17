// Navegación con teclado entre pestañas (patrón WAI-ARIA). Sin DOM: se puede probar con node:test.
// Devuelve el índice de la pestaña a la que se pasa, o null si la tecla no navega.
export function indiceTrasTecla(actual, total, tecla) {
  if (total < 1) return null;
  if (tecla === "ArrowRight") return (actual + 1) % total;
  if (tecla === "ArrowLeft") return (actual - 1 + total) % total;
  if (tecla === "Home") return 0;
  if (tecla === "End") return total - 1;
  return null;
}
