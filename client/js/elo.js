// Texto del cambio de Elo de un resultado. Sin DOM: se puede probar con node:test.
// elo: { antes, despues, cambio } o null si esa prueba no tiene Elo calculado (abandono, ranking sin recalcular...).
export function textoElo(elo) {
  if (!elo) return "";
  const signo = elo.cambio > 0 ? "+" : elo.cambio < 0 ? "−" : "±";
  return `${elo.antes} → ${elo.despues} (${signo}${Math.abs(elo.cambio)})`;
}
