// Ritmos de cada segmento a partir de su tiempo y de las distancias de la prueba. Sin DOM: se puede probar con node:test.
// Natación: min/100 m · bici: km/h · carrera: min/km. T1 y T2 no tienen ritmo.
// Las distancias son [natación o carrera 1, bici, carrera] en metros. Los segmentos son [nat/c1, T1, bici, T2, carrera].
export const DISTANCIAS = Object.freeze({
  triatlon: {
    supersprint: { nombre: "Súper sprint (300 m · 8 km · 2,5 km)", metros: [300, 8000, 2500] },
    sprint: { nombre: "Sprint (750 m · 20 km · 5 km)", metros: [750, 20000, 5000] },
    estandar: { nombre: "Estándar / olímpica (1,5 km · 40 km · 10 km)", metros: [1500, 40000, 10000] },
  },
  duatlon: {
    sprint: { nombre: "Sprint (5 km · 20 km · 2,5 km)", metros: [5000, 20000, 2500] },
    estandar: { nombre: "Estándar (10 km · 40 km · 5 km)", metros: [10000, 40000, 5000] },
  },
});
export const DISTANCIA_POR_DEFECTO = Object.freeze({ triatlon: "estandar", duatlon: "sprint" });
export const PERSONALIZADA = "personalizada";

// Qué distancia (índice en `metros`) corresponde a cada segmento; null = transición, sin ritmo.
const DISTANCIA_DEL_SEGMENTO = [0, null, 1, null, 2];

// Distancias en metros de una elección, o null si no es válida. personalizadas: [metros, metros, metros].
export function distanciasDe(deporte, clave, personalizadas) {
  if (clave === PERSONALIZADA) {
    const m = Array.isArray(personalizadas) ? personalizadas.map(Number) : [];
    return m.length === 3 && m.every((x) => Number.isFinite(x) && x > 0) ? m : null;
  }
  return DISTANCIAS[deporte]?.[clave]?.metros ?? null;
}

// Los ritmos en min:seg se truncan al segundo (así lo hace también Split Lab).
const minutosSegundos = (segundos) => {
  const total = Math.floor(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

// Tipo de ritmo de un segmento: "nado" | "bici" | "carrera" | null.
export function tipoDeRitmo(deporte, i) {
  if (!DISTANCIAS[deporte] || DISTANCIA_DEL_SEGMENTO[i] === null || DISTANCIA_DEL_SEGMENTO[i] === undefined) return null;
  if (i === 2) return "bici";
  return deporte === "triatlon" && i === 0 ? "nado" : "carrera";
}

// Texto del ritmo ("1:17/100 m", "38,8 km/h", "3:23/km") o "" si no hay (transición, sin tiempo o sin distancias).
export function textoRitmo(deporte, i, segundos, metros) {
  const tipo = tipoDeRitmo(deporte, i);
  if (!tipo || !Array.isArray(metros) || typeof segundos !== "number" || !(segundos > 0)) return "";
  const distancia = metros[DISTANCIA_DEL_SEGMENTO[i]];
  if (!(distancia > 0)) return "";
  if (tipo === "nado") return `${minutosSegundos(segundos / (distancia / 100))}/100 m`;
  if (tipo === "bici") return `${(distancia / 1000 / (segundos / 3600)).toFixed(1).replace(".", ",")} km/h`;
  return `${minutosSegundos(segundos / (distancia / 1000))}/km`;
}
