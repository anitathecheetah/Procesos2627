// Texto de las probabilidades y rangos de la predicción. Sin DOM: se puede probar con node:test.

// 0.4321 → "43 %"; lo que no llega al 1 % se dice "<1 %" (no "0 %") y lo casi seguro ">99 %".
export function porcentaje(probabilidad) {
  if (!(probabilidad > 0)) return "0 %";
  if (probabilidad < 0.01) return "<1 %";
  if (probabilidad >= 1) return "100 %";
  if (probabilidad > 0.99) return ">99 %";
  return `${Math.round(probabilidad * 100)} %`;
}

// [3, 9] → "3–9"; [4, 4] → "4".
export const textoRango = ([desde, hasta]) => (desde === hasta ? String(desde) : `${desde}–${hasta}`);

// Diferencia entre la posición prevista y la real: "+2" (llegó 2 puestos mejor de lo previsto), "−1", "=".
export function textoDiferencia(prevista, real) {
  if (!Number.isInteger(real)) return "—";
  const d = prevista - real;
  return d === 0 ? "=" : d > 0 ? `+${d}` : `−${-d}`;
}
