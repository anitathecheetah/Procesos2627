import test from "node:test";
import assert from "node:assert/strict";
import { esperado, actualizarCarrera, RATING_INICIAL, K } from "../../server/logic/elo.js";

const casi = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} no es ${b}`);
const carrera = (...ids) => ids.map((atletaId, i) => ({ atletaId, posicion: i + 1 }));

test("la probabilidad esperada: 50% con igual rating, 64% con 100 puntos de ventaja y simétrica", () => {
  casi(esperado(1500, 1500), 0.5);
  casi(esperado(1600, 1500), 0.640064956, 1e-6);
  casi(esperado(1600, 1500) + esperado(1500, 1600), 1);
});

test("dos iguales: el ganador sube K/2 y el perdedor baja K/2", () => {
  const r = actualizarCarrera(new Map(), carrera("a", "b"));
  casi(r.get("a").despues, RATING_INICIAL + K / 2);
  casi(r.get("b").despues, RATING_INICIAL - K / 2);
});

test("gana el favorito: sube poco; gana el no favorito: sube mucho", () => {
  const ratings = new Map([["fav", 1700], ["otro", 1500]]);
  const favoritoGana = actualizarCarrera(ratings, carrera("fav", "otro"));
  const sorpresa = actualizarCarrera(ratings, carrera("otro", "fav"));
  const subeFav = favoritoGana.get("fav").despues - 1700;
  const subeSorpresa = sorpresa.get("otro").despues - 1500;
  assert.ok(subeFav > 0 && subeFav < K / 2);
  assert.ok(subeSorpresa > K / 2);
  casi(subeFav + subeSorpresa, K); // los dos escenarios son complementarios
});

test("empate (misma posición): entre iguales no cambia nada; con distinto rating el de menos sube", () => {
  const igual = actualizarCarrera(new Map(), [{ atletaId: "a", posicion: 1 }, { atletaId: "b", posicion: 1 }]);
  casi(igual.get("a").despues, RATING_INICIAL);
  const desigual = actualizarCarrera(new Map([["a", 1600]]), [{ atletaId: "a", posicion: 1 }, { atletaId: "b", posicion: 1 }]);
  assert.ok(desigual.get("a").despues < 1600 && desigual.get("b").despues > 1500);
});

test("el sistema conserva los puntos: la suma de cambios en una carrera es 0", () => {
  const ratings = new Map([["a", 1650], ["b", 1480], ["c", 1500], ["d", 1390]]);
  const r = actualizarCarrera(ratings, carrera("c", "a", "d", "b"));
  const suma = [...r.values()].reduce((s, x) => s + (x.despues - x.antes), 0);
  casi(suma, 0);
});

test("con 100 participantes el cambio de cada atleta sigue acotado por K", () => {
  const grande = actualizarCarrera(new Map(), carrera(...Array.from({ length: 100 }, (_, i) => `a${i}`)));
  assert.ok(grande.get("a0").despues - RATING_INICIAL <= K);
  assert.ok(grande.get("a99").despues - RATING_INICIAL >= -K);
});

test("el orden de los participantes en la lista no cambia el resultado", () => {
  const lista = carrera("a", "b", "c", "d");
  const x = actualizarCarrera(new Map(), lista);
  const y = actualizarCarrera(new Map(), [...lista].reverse());
  for (const id of ["a", "b", "c", "d"]) casi(x.get(id).despues, y.get(id).despues);
});

test("ERROR/límite: con menos de 2 participantes no hay duelos y no cambia nada", () => {
  assert.equal(actualizarCarrera(new Map(), []).size, 0);
  assert.equal(actualizarCarrera(new Map(), carrera("solo")).size, 0);
});
