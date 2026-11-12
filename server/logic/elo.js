// Fórmula Elo para carreras con muchos participantes. Funciones puras: sin base de datos ni reloj.
// Documentada en docs/ranking-elo.md.
export const RATING_INICIAL = 1500;
export const K = 32;
const ESCALA = 400;

// Probabilidad de que A gane a B.
export const esperado = (ratingA, ratingB) => 1 / (1 + 10 ** ((ratingB - ratingA) / ESCALA));

// Una carrera = un duelo de cada participante contra cada otro, ganado por quien llegó antes
// (misma posición = empate). Para que una carrera pese lo mismo con 20 que con 100 participantes,
// cada duelo vale K / (n - 1). Todos los cambios se calculan con los ratings de ANTES de la carrera.
//
//   ratings: Map atletaId -> rating actual (quien no esté, parte de RATING_INICIAL)
//   participantes: [{ atletaId, posicion }] solo los que puntúan (finalizados)
// Devuelve Map atletaId -> { antes, despues } o un Map vacío si hay menos de 2 participantes.
export function actualizarCarrera(ratings, participantes, { k = K } = {}) {
  const n = participantes.length;
  if (n < 2) return new Map();
  const antes = new Map(participantes.map((p) => [p.atletaId, ratings.get(p.atletaId) ?? RATING_INICIAL]));
  const cambio = new Map(participantes.map((p) => [p.atletaId, 0]));
  const kDuelo = k / (n - 1);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = participantes[i];
      const b = participantes[j];
      const real = a.posicion < b.posicion ? 1 : a.posicion > b.posicion ? 0 : 0.5;
      const e = esperado(antes.get(a.atletaId), antes.get(b.atletaId));
      cambio.set(a.atletaId, cambio.get(a.atletaId) + kDuelo * (real - e));
      cambio.set(b.atletaId, cambio.get(b.atletaId) + kDuelo * ((1 - real) - (1 - e)));
    }
  }
  return new Map(participantes.map((p) => [p.atletaId, { antes: antes.get(p.atletaId), despues: antes.get(p.atletaId) + cambio.get(p.atletaId) }]));
}
