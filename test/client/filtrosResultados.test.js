// Filtros y orden de la clasificación por atleta, club y tiempo de cada segmento (no usa DOM).
import test from "node:test";
import assert from "node:assert/strict";
import { filtrarClasificacion, esMejorSegmento } from "../../client/js/filtrosResultados.js";

const f = (id, nombre, club, parciales, estado = "finalizado") => ({ estado, parciales, atleta: { id, nombre }, club: club ? { nombre: club } : null });
const clasificacion = [
  f("1", "Ana López", "Club Águilas", [600, 30, 1900, 25, 1080]),
  f("2", "Beto Ruiz", "Club Mérida", [540, 20, 1950, 30, 1100]),
  f("3", "Carla Gómez", null, null),
  f("4", "Dani Soto", "Club Águilas", [560, 25, 1800, 20, 1000], "dnf"),
];
const ids = (filas) => filas.map((x) => x.atleta.id);

test("sin filtros devuelve la clasificación tal cual", () => {
  assert.deepEqual(ids(filtrarClasificacion(clasificacion)), ["1", "2", "3", "4"]);
});

test("filtra por atleta sin importar tildes, mayúsculas ni el orden de las palabras", () => {
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { atleta: "LOPEZ ana" })), ["1"]);
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { atleta: "gomez" })), ["3"]);
});

test("filtra por club (y quien no tiene club no coincide)", () => {
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { club: "aguilas" })), ["1", "4"]);
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { club: "club", atleta: "ana" })), ["1"]);
});

test("ordena por el tiempo de un segmento y deja al final a quien no tiene parciales o no terminó", () => {
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { orden: "0" })), ["2", "1", "3", "4"]); // natación
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { orden: "2" })), ["1", "2", "3", "4"]); // bici
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { orden: "3" })), ["1", "2", "3", "4"]); // T2: el DNF no cuenta
});

test("un orden desconocido deja el de la clasificación y no modifica la lista original", () => {
  assert.deepEqual(ids(filtrarClasificacion(clasificacion, { orden: "9" })), ["1", "2", "3", "4"]);
  filtrarClasificacion(clasificacion, { orden: "0" });
  assert.deepEqual(ids(clasificacion), ["1", "2", "3", "4"]);
});

test("marca al que tiene el mejor tiempo del segmento", () => {
  const mejores = [{ tiempo: 540, atletas: [{ id: "2" }] }, null, { tiempo: 1900, atletas: [{ id: "1" }] }, null, null];
  assert.equal(esMejorSegmento(mejores, 0, clasificacion[1]), true);
  assert.equal(esMejorSegmento(mejores, 0, clasificacion[0]), false);
  assert.equal(esMejorSegmento(mejores, 1, clasificacion[1]), false);
  assert.equal(esMejorSegmento(mejores, 2, clasificacion[0]), true);
  assert.equal(esMejorSegmento(undefined, 0, clasificacion[0]), false);
});
