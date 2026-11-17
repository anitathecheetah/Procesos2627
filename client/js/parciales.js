// Nombres de los parciales de cada deporte y su texto para la clasificación. Sin DOM: se puede probar con node:test.
export const NOMBRES_PARCIALES = Object.freeze({
  duatlon: ["Carrera 1", "T1", "Bici", "T2", "Carrera 2"],
  triatlon: ["Natación", "T1", "Bici", "T2", "Carrera"],
});

// Texto de los parciales de un resultado, p. ej. "Natación 0:10:00 · T1 0:00:20 · …".
// Devuelve "" si no hay parciales fiables (abandono, fila revisada) o el deporte no se conoce.
export function describirParciales(deporte, parciales, formatearTiempo) {
  const nombres = NOMBRES_PARCIALES[deporte];
  if (!nombres || !Array.isArray(parciales) || parciales.length !== nombres.length) return "";
  return nombres.map((nombre, i) => `${nombre} ${formatearTiempo(parciales[i])}`).join(" · ");
}
