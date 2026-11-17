// Cálculos sobre los parciales de una prueba: puestos por segmento, resumen, splits y CSV.
// Sin DOM: se puede probar con node:test. Los 5 segmentos son [natación o carrera 1, T1, bici, T2, carrera].
export const SEGMENTOS = 5;

// Tiempo del segmento i de una fila, o null si no es fiable (no terminó, parciales incompletos, valor ≤ 0).
export function tiempoDeSegmento(fila, i) {
  const t = fila.estado === "finalizado" && Array.isArray(fila.parciales) && fila.parciales.length === SEGMENTOS ? fila.parciales[i] : null;
  return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null;
}

// Puesto de cada tiempo entre los de su segmento: de menor a mayor; los empates comparten el mejor puesto.
function puestosDe(tiempos) {
  return tiempos.map((t) => (t === null ? null : 1 + tiempos.filter((o) => o !== null && o < t).length));
}

// Una fila por finalista: { id, nombre, club, dorsal, posicion, total, tiempos[5], puestos[5] } (null = sin dato).
export function construirSplits(clasificacion) {
  const finalistas = clasificacion.filter((f) => f.estado === "finalizado");
  const porSegmento = Array.from({ length: SEGMENTOS }, (_, i) => puestosDe(finalistas.map((f) => tiempoDeSegmento(f, i))));
  return finalistas.map((f, k) => ({
    id: f.atleta.id, nombre: f.atleta.nombre, club: f.club?.nombre ?? "", dorsal: f.dorsal, posicion: f.posicion,
    total: f.tiempoTotal, tiempos: Array.from({ length: SEGMENTOS }, (_, i) => tiempoDeSegmento(f, i)),
    puestos: porSegmento.map((p) => p[k]),
  }));
}

// columna: "posicion" | "nombre" | "club" | "total" | 0..4 (segmento). Lo que no tiene dato va siempre al final.
export function ordenarSplits(filas, columna = "posicion", descendente = false) {
  const valor = (f) => {
    if (columna === "nombre") return f.nombre;
    if (columna === "club") return f.club;
    if (columna === "total") return f.total;
    if (columna === "posicion") return f.posicion;
    return f.tiempos[columna];
  };
  const signo = descendente ? -1 : 1;
  return filas.map((f, k) => ({ f, k, v: valor(f) })).sort((a, b) => {
    const faltaA = a.v === null || a.v === undefined || a.v === "";
    const faltaB = b.v === null || b.v === undefined || b.v === "";
    if (faltaA || faltaB) return faltaA === faltaB ? a.k - b.k : faltaA ? 1 : -1;
    const c = typeof a.v === "string" ? a.v.localeCompare(b.v, "es") : a.v - b.v;
    return c * signo || a.k - b.k;
  }).map(({ f }) => f);
}

// Los n mejores tiempos del segmento i: [{ id, nombre, club, tiempo, puesto }].
export function mejoresDelSegmento(splits, i, n = 3) {
  return ordenarSplits(splits, i).filter((f) => f.tiempos[i] !== null).slice(0, n)
    .map((f) => ({ id: f.id, nombre: f.nombre, club: f.club, tiempo: f.tiempos[i], puesto: f.puestos[i] }));
}

// Resumen de la carrera: cuántos salieron y terminaron, tiempo medio de cada segmento y podio.
export function resumenCarrera(clasificacion) {
  const splits = construirSplits(clasificacion);
  const medias = Array.from({ length: SEGMENTOS }, (_, i) => {
    const validos = splits.map((f) => f.tiempos[i]).filter((t) => t !== null);
    return validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null;
  });
  return {
    salieron: clasificacion.filter((f) => f.estado !== "dns").length,
    finalizados: splits.length,
    medias,
    podio: ordenarSplits(splits, "posicion").slice(0, 3),
  };
}

const celdaCsv = (v) => {
  const texto = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
};
// CSV con ; (como lo abre Excel en español). formatear convierte segundos en texto.
export function csvSplits(nombres, filas, formatear) {
  const cabecera = ["Pos", "Dorsal", "Atleta", "Club", ...nombres.flatMap((n) => [n, `Puesto ${n}`]), "Total"];
  const lineas = filas.map((f) => [
    f.posicion, f.dorsal, f.nombre, f.club,
    ...f.tiempos.flatMap((t, i) => [t === null ? "" : formatear(t), f.puestos[i] ?? ""]),
    formatear(f.total),
  ]);
  return [cabecera, ...lineas].map((l) => l.map(celdaCsv).join(";")).join("\r\n");
}
