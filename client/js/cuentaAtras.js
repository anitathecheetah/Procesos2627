// Textos de la cuenta atrás y de la previsión (PBI-40). Sin DOM, para poder probarlos.
export function textoDias(dias) {
  if (!Number.isInteger(dias)) return "";
  if (dias === 0) return "¡Es hoy!";
  if (dias === 1) return "Mañana";
  if (dias > 1) return `Faltan ${dias} días`;
  return dias === -1 ? "Fue ayer" : `Hace ${-dias} días`;
}

// La carrera abierta y futura (o de hoy) más próxima en la que está apuntada la persona, o null.
export function proximaCarreraApuntada(carreras) {
  return carreras
    .filter((c) => c.apuntado && Number.isInteger(c.diasRestantes) && c.diasRestantes >= 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)[0] ?? null;
}

export function textoTiempo(t) {
  if (!t) return "";
  const partes = [`${t.descripcion}`, `${t.tMin}–${t.tMax} °C`];
  if (t.probLluvia != null) partes.push(`lluvia ${t.probLluvia}%`);
  if (t.vientoKmh != null) partes.push(`viento ${t.vientoKmh} km/h`);
  return partes.join(" · ");
}
