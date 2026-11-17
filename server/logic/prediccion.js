// Predicción de posiciones de una carrera a partir del Elo (PBI-26). Documentada en docs/prediccion.md.
//
// Modelo: el rendimiento de un atleta en un día es su Elo más un ruido de Gumbel de escala 400/ln(10).
// Con esa escala, la probabilidad de que A llegue antes que B es exactamente la de la fórmula Elo
// (1 / (1 + 10^((Rb − Ra) / 400))), así que la predicción es coherente con el ranking.
// Se simula la carrera muchas veces (con un generador con semilla: mismo dato, misma predicción)
// y se cuenta cuántas veces queda cada atleta en cada posición.
import { ErrorLogica } from "./errores.js";
import { DEPORTES, ESTADOS_RESULTADO } from "./catalogos.js";

export const SIMULACIONES_POR_DEFECTO = 5000;
export const SIMULACIONES_MAXIMAS = 20000;
export const ATLETAS_POR_DEFECTO = 100; // solo sin prueba base: cuántos del ranking
export const ATLETAS_MAXIMOS = 300;
const ATLETAS_MAXIMOS_BASE = 500; // con prueba base entran todos los participantes; esto solo protege al servidor
const SEMILLA = 2027;
const ESCALA_GUMBEL = 400 / Math.LN10;

// Generador pseudoaleatorio determinista (mulberry32): devuelve números en [0, 1).
export function generador(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const redondear = (x, decimales = 3) => Math.round(x * 10 ** decimales) / 10 ** decimales;

// participantes: [{ id, rating }]. Devuelve, por participante y en el mismo orden de entrada:
// { id, posicionMedia, probVictoria, probPodio, probTop10, rango: [p10, p90] }.
export function simular(participantes, { simulaciones = SIMULACIONES_POR_DEFECTO, semilla = SEMILLA } = {}) {
  const n = participantes.length;
  if (n < 2) throw new ErrorLogica("DATOS_INVALIDOS", "Hacen falta al menos 2 atletas con ranking para predecir una carrera");
  const azar = generador(semilla);
  // veces[i][p] = en cuántas simulaciones el atleta i terminó en la posición p (0 = primero).
  const veces = participantes.map(() => new Uint32Array(n));
  const rendimiento = new Float64Array(n);
  const orden = Array.from({ length: n }, (_, i) => i);
  for (let s = 0; s < simulaciones; s++) {
    for (let i = 0; i < n; i++) rendimiento[i] = participantes[i].rating - ESCALA_GUMBEL * Math.log(-Math.log(azar() || Number.MIN_VALUE));
    orden.sort((a, b) => rendimiento[b] - rendimiento[a]);
    for (let p = 0; p < n; p++) veces[orden[p]][p]++;
  }
  return participantes.map((participante, i) => {
    const h = veces[i];
    const acumulado = (hasta) => h.slice(0, Math.min(hasta, n)).reduce((a, b) => a + b, 0) / simulaciones;
    const percentil = (q) => { // primera posición (1..n) cuya frecuencia acumulada alcanza q
      let suma = 0;
      for (let p = 0; p < n; p++) { suma += h[p]; if (suma / simulaciones >= q) return p + 1; }
      return n;
    };
    const media = h.reduce((suma, v, p) => suma + v * (p + 1), 0) / simulaciones;
    return {
      id: participante.id,
      posicionMedia: redondear(media, 1),
      probVictoria: redondear(acumulado(1)),
      probPodio: redondear(acumulado(3)),
      probTop10: redondear(acumulado(10)),
      rango: [percentil(0.1), percentil(0.9)],
    };
  });
}

function entero(valor, porDefecto, nombre, minimo, maximo) {
  if (valor === undefined || valor === "") return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < minimo || n > maximo) throw new ErrorLogica("DATOS_INVALIDOS", `${nombre} debe ser un entero entre ${minimo} y ${maximo}`);
  return n;
}

export function crearServicioPrediccion({ repos }) {
  return {
    // Predice la clasificación de una carrera de `deporte`.
    //  - base: id de una prueba anterior; sus participantes son la lista de salida (p. ej. Águilas 2026).
    //    Con base entran TODOS los participantes (no se recorta la lista).
    //    Sin base, la lista de salida son los `maximo` mejores del ranking (filtrados por `sexo`): es solo una aproximación.
    //  - retrospectiva (solo con base): usa el Elo que tenía cada atleta ANTES de esa prueba y añade el
    //    resultado real, para comparar la predicción con lo que pasó.
    // El Elo sale del último recálculo del ranking.
    async predecir(deporte, { base, sexo, maximo, simulaciones, retrospectiva } = {}) {
      if (!DEPORTES.includes(deporte)) throw new ErrorLogica("DATOS_INVALIDOS", `El deporte debe ser uno de: ${DEPORTES.join(", ")}`);
      if (sexo && !["M", "F"].includes(sexo)) throw new ErrorLogica("DATOS_INVALIDOS", "El sexo debe ser M o F");
      const sims = entero(simulaciones, SIMULACIONES_POR_DEFECTO, "Las simulaciones", 100, SIMULACIONES_MAXIMAS);
      const tope = entero(maximo, ATLETAS_POR_DEFECTO, "El máximo de atletas", 2, ATLETAS_MAXIMOS);
      const retro = retrospectiva === true || retrospectiva === "true";
      if (retro && !base) throw new ErrorLogica("DATOS_INVALIDOS", "La comparación con el resultado real necesita una prueba base");

      let prueba = null;
      let candidatos; // [{ atletaId, rating, clubId, real }]
      if (base) {
        prueba = await repos.pruebas.buscarPorId(base);
        if (!prueba) throw new ErrorLogica("NO_ENCONTRADO", "La prueba no existe");
        if (prueba.deporte !== deporte) throw new ErrorLogica("DATOS_INVALIDOS", `La prueba base es de ${prueba.deporte}, no de ${deporte}`);
        const resultados = (await repos.resultados.listar({ pruebaId: base })).filter((r) => r.estado !== ESTADOS_RESULTADO.DNS);
        const ratings = retro
          ? new Map((await repos.historialElo.listar({ pruebaId: base })).map((h) => [h.atletaId, h.ratingAntes]))
          : new Map((await repos.ratings.listar({ deporte })).map((r) => [r.atletaId, r.rating]));
        candidatos = resultados.filter((r) => ratings.has(r.atletaId))
          .map((r) => ({ atletaId: r.atletaId, rating: ratings.get(r.atletaId), clubId: r.clubId, real: retro && r.estado === ESTADOS_RESULTADO.FINALIZADO ? r.posicion : null }));
      } else {
        candidatos = (await repos.ratings.listar({ deporte })).filter((r) => !sexo || r.sexo === sexo)
          .map((r) => ({ atletaId: r.atletaId, rating: r.rating, clubId: r.clubId, real: null }));
      }
      candidatos.sort((a, b) => b.rating - a.rating || a.atletaId.localeCompare(b.atletaId));
      candidatos = candidatos.slice(0, base ? ATLETAS_MAXIMOS_BASE : tope);

      const estadisticas = simular(candidatos.map((c) => ({ id: c.atletaId, rating: c.rating })), { simulaciones: sims });
      const filas = await Promise.all(candidatos.map(async (c, i) => {
        const [atleta, club] = await Promise.all([repos.atletas.buscarPorId(c.atletaId), c.clubId ? repos.clubes.buscarPorId(c.clubId) : null]);
        const { id: _id, ...numeros } = estadisticas[i];
        return {
          atleta: { id: atleta.id, nombre: atleta.nombre },
          club: club ? { id: club.id, nombre: club.nombre } : null,
          rating: Math.round(c.rating),
          ...numeros,
          ...(retro ? { posicionReal: c.real } : {}),
        };
      }));
      filas.sort((a, b) => a.posicionMedia - b.posicionMedia || b.rating - a.rating || a.atleta.id.localeCompare(b.atleta.id));
      filas.forEach((f, i) => { f.posicionPrevista = i + 1; });

      return {
        deporte,
        simulaciones: sims,
        retrospectiva: retro,
        base: prueba ? { id: prueba.id, nombre: prueba.nombre, fecha: prueba.fecha } : null,
        ...(retro ? errorDePrediccion(filas) : {}),
        filas,
      };
    },
  };
}

// Cuánto se equivocó la predicción: diferencia media (en puestos) entre la posición prevista y la real,
// solo entre quienes terminaron. Las posiciones reales se reordenan 1..k entre esos atletas para que
// los que no terminaron no desplacen a nadie.
function errorDePrediccion(filas) {
  const terminaron = filas.filter((f) => Number.isInteger(f.posicionReal));
  if (!terminaron.length) return { errorMedio: null };
  const previstas = [...terminaron].sort((a, b) => a.posicionPrevista - b.posicionPrevista);
  const reales = [...terminaron].sort((a, b) => a.posicionReal - b.posicionReal);
  const suma = terminaron.reduce((s, f) => s + Math.abs(previstas.indexOf(f) - reales.indexOf(f)), 0);
  return { errorMedio: redondear(suma / terminaron.length, 1) };
}
