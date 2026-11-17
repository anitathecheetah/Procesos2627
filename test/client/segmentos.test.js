// Puestos por segmento, resumen, orden de splits y CSV (no usa DOM).
import test from "node:test";
import assert from "node:assert/strict";
import { tiempoDeSegmento, construirSplits, ordenarSplits, mejoresDelSegmento, resumenCarrera, csvSplits } from "../../client/js/segmentos.js";
import { indiceTrasTecla } from "../../client/js/navegacionPestanas.js";

const f = (id, nombre, posicion, parciales, total, estado = "finalizado", club = "C") =>
  ({ estado, posicion, parciales, tiempoTotal: total, dorsal: id, atleta: { id, nombre }, club: club ? { nombre: club } : null });
const clasificacion = [
  f("1", "Ana", 1, [600, 30, 1900, 25, 1080], 3635),
  f("2", "Beto", 2, [540, 20, 1950, 30, 1100], 3640),
  f("3", "Carla", 3, [600, 25, 1900, 20, 1200], 3745, "finalizado", null),
  f("4", "Dani", null, [560, 25], null, "dnf"),
  f("5", "Eva", null, null, null, "dns"),
  f("6", "Fran", 4, null, 3800), // finalista con parciales incompletos
];

test("tiempoDeSegmento solo devuelve tiempos fiables de finalistas", () => {
  assert.equal(tiempoDeSegmento(clasificacion[0], 2), 1900);
  assert.equal(tiempoDeSegmento(clasificacion[3], 0), null, "abandono");
  assert.equal(tiempoDeSegmento(clasificacion[5], 0), null, "sin parciales");
  assert.equal(tiempoDeSegmento(f("x", "X", 1, [0, 1, 2, 3, 4], 10), 0), null, "cero no es un tiempo");
});

test("construirSplits da una fila por finalista con el puesto en cada segmento (empates comparten puesto)", () => {
  const s = construirSplits(clasificacion);
  assert.deepEqual(s.map((x) => x.nombre), ["Ana", "Beto", "Carla", "Fran"]);
  assert.deepEqual(s[0].puestos, [2, 3, 1, 2, 1]); // natación: Beto 540 < Ana=Carla 600; T1: Beto 20 < Carla 25 < Ana 30
  assert.deepEqual(s[2].puestos, [2, 2, 1, 1, 3]); // Carla empata con Ana en natación y bici
  assert.deepEqual(s[3].puestos, [null, null, null, null, null]);
  assert.equal(s[2].club, "");
});

test("ordenarSplits ordena por columna, en ambos sentidos, y deja sin dato al final", () => {
  const s = construirSplits(clasificacion);
  const nombres = (x) => x.map((r) => r.nombre);
  assert.deepEqual(nombres(ordenarSplits(s, 0)), ["Beto", "Ana", "Carla", "Fran"]);
  assert.deepEqual(nombres(ordenarSplits(s, 0, true)), ["Ana", "Carla", "Beto", "Fran"]);
  assert.deepEqual(nombres(ordenarSplits(s, "nombre", true)), ["Fran", "Carla", "Beto", "Ana"]);
  assert.deepEqual(nombres(ordenarSplits(s, "total")), ["Ana", "Beto", "Carla", "Fran"]);
  assert.deepEqual(nombres(ordenarSplits(s, "posicion")), ["Ana", "Beto", "Carla", "Fran"]);
  assert.deepEqual(nombres(ordenarSplits(s, "club")).at(-1), "Carla", "el club vacío va al final");
});

test("mejoresDelSegmento devuelve los n mejores con su puesto", () => {
  const m = mejoresDelSegmento(construirSplits(clasificacion), 0, 2);
  assert.deepEqual(m.map((x) => [x.nombre, x.tiempo, x.puesto]), [["Beto", 540, 1], ["Ana", 600, 2]]);
});

test("resumenCarrera: salidos, finalizados, medias y podio", () => {
  const r = resumenCarrera(clasificacion);
  assert.equal(r.salieron, 5, "el DNS no salió");
  assert.equal(r.finalizados, 4);
  assert.deepEqual(r.medias.map((m) => m && Math.round(m)), [580, 25, 1917, 25, 1127]);
  assert.deepEqual(r.podio.map((p) => p.nombre), ["Ana", "Beto", "Carla"]);
  assert.deepEqual(resumenCarrera([]).medias, [null, null, null, null, null]);
});

test("csvSplits usa ; , escapa comillas y trae cabecera con los segmentos", () => {
  const filas = [{ ...construirSplits(clasificacion)[0], nombre: 'Ana "la Rápida"; López' }];
  const csv = csvSplits(["Nat", "T1", "Bici", "T2", "Carrera"], filas, (s) => `${s}s`).split("\r\n");
  assert.equal(csv[0], "Pos;Dorsal;Atleta;Club;Nat;Puesto Nat;T1;Puesto T1;Bici;Puesto Bici;T2;Puesto T2;Carrera;Puesto Carrera;Total");
  assert.ok(csv[1].includes('"Ana ""la Rápida""; López"'));
  assert.ok(csv[1].endsWith("3635s"));
});

test("las flechas, Inicio y Fin navegan entre pestañas", () => {
  assert.equal(indiceTrasTecla(0, 4, "ArrowRight"), 1);
  assert.equal(indiceTrasTecla(3, 4, "ArrowRight"), 0);
  assert.equal(indiceTrasTecla(0, 4, "ArrowLeft"), 3);
  assert.equal(indiceTrasTecla(2, 4, "Home"), 0);
  assert.equal(indiceTrasTecla(1, 4, "End"), 3);
  assert.equal(indiceTrasTecla(1, 4, "a"), null);
  assert.equal(indiceTrasTecla(0, 0, "ArrowRight"), null);
});
