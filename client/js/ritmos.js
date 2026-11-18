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

// Cada tipo de ritmo reúne lo que lo distingue: cómo se calcula, cómo se escribe, entre qué valores es creíble de media
// (de élite a popular) y cuál es el típico (para elegir el formato que mejor encaja con los tiempos).
// Añadir un tipo nuevo (p. ej. «remo») es añadir una entrada, sin tocar las funciones de abajo.
// nado: s/100 m · bici: km/h · carrera: s/km. «distancia» va en metros y «segundos» es el tiempo del segmento.
const TIPOS_DE_RITMO = Object.freeze({
  nado: {
    calcular: (segundos, distancia) => segundos / (distancia / 100),
    escribir: (v) => `${minutosSegundos(v)}/100 m`,
    realista: [50, 200],
    tipico: 85,
  },
  bici: {
    calcular: (segundos, distancia) => distancia / 1000 / (segundos / 3600),
    escribir: (v) => `${v.toFixed(1).replace(".", ",")} km/h`,
    realista: [18, 55],
    tipico: 36,
  },
  carrera: {
    calcular: (segundos, distancia) => segundos / (distancia / 1000),
    escribir: (v) => `${minutosSegundos(v)}/km`,
    realista: [150, 540],
    tipico: 230,
  },
});

// Tipo de ritmo de un segmento: "nado" | "bici" | "carrera" | null.
export function tipoDeRitmo(deporte, i) {
  if (!DISTANCIAS[deporte] || DISTANCIA_DEL_SEGMENTO[i] === null || DISTANCIA_DEL_SEGMENTO[i] === undefined) return null;
  if (i === 2) return "bici";
  return deporte === "triatlon" && i === 0 ? "nado" : "carrera";
}

// Valor numérico del ritmo: segundos por 100 m (nado), km/h (bici) o segundos por km (carrera). null si no se puede calcular.
export function ritmoNumerico(deporte, i, segundos, metros) {
  const tipo = tipoDeRitmo(deporte, i);
  if (!tipo || !Array.isArray(metros) || typeof segundos !== "number" || !(segundos > 0)) return null;
  const distancia = metros[DISTANCIA_DEL_SEGMENTO[i]];
  return distancia > 0 ? TIPOS_DE_RITMO[tipo].calcular(segundos, distancia) : null;
}

// Texto del ritmo ("1:17/100 m", "38,8 km/h", "3:23/km") o "" si no hay (transición, sin tiempo o sin distancias).
export function textoRitmo(deporte, i, segundos, metros) {
  const valor = ritmoNumerico(deporte, i, segundos, metros);
  return valor === null ? "" : TIPOS_DE_RITMO[tipoDeRitmo(deporte, i)].escribir(valor);
}

const SEGMENTOS_CON_RITMO = [0, 2, 4];

// ¿Los ritmos medios con estas distancias son creíbles? medias: tiempo medio de cada uno de los 5 segmentos.
// Sin datos o sin distancias no se puede decir nada y devuelve true.
export function ritmosRealistas(deporte, medias, metros) {
  return SEGMENTOS_CON_RITMO.every((i) => {
    const v = ritmoNumerico(deporte, i, medias?.[i], metros);
    if (v === null) return true;
    const [min, max] = TIPOS_DE_RITMO[tipoDeRitmo(deporte, i)].realista;
    return v >= min && v <= max;
  });
}

// El formato predefinido (clave) cuyos ritmos medios se parecen más a los típicos, o null si no hay medias.
export function sugerirDistancias(deporte, medias) {
  const presets = DISTANCIAS[deporte];
  if (!presets || !Array.isArray(medias)) return null;
  let mejor = null;
  for (const [clave, p] of Object.entries(presets)) {
    let desvio = 0;
    let datos = 0;
    for (const i of SEGMENTOS_CON_RITMO) {
      const v = ritmoNumerico(deporte, i, medias[i], p.metros);
      if (v === null) continue;
      datos++;
      desvio += Math.log(v / TIPOS_DE_RITMO[tipoDeRitmo(deporte, i)].tipico) ** 2;
    }
    if (datos && (mejor === null || desvio < mejor.desvio)) mejor = { clave, desvio };
  }
  return mejor?.clave ?? null;
}
