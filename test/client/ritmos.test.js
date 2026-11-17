// Ritmos por segmento: min/100 m en natación, km/h en bici y min/km en carrera (no usa DOM).
import test from "node:test";
import assert from "node:assert/strict";
import { DISTANCIAS, distanciasDe, textoRitmo, tipoDeRitmo, PERSONALIZADA } from "../../client/js/ritmos.js";

const ESTANDAR_TRI = DISTANCIAS.triatlon.estandar.metros;

test("natación en triatlón: min por 100 m, truncado al segundo (1500 m en 19:16 → 1:17/100 m)", () => {
  assert.equal(textoRitmo("triatlon", 0, 19 * 60 + 16, ESTANDAR_TRI), "1:17/100 m");
  assert.equal(textoRitmo("triatlon", 0, 19 * 60 + 8, ESTANDAR_TRI), "1:16/100 m");
});

test("bici: km/h (40 km en 1:04:53 → 37,0 km/h)", () => {
  assert.equal(textoRitmo("triatlon", 2, 3893, ESTANDAR_TRI), "37,0 km/h");
  assert.equal(textoRitmo("duatlon", 2, 1800, DISTANCIAS.duatlon.sprint.metros), "40,0 km/h");
});

test("carrera: min por km (10 km en 33:51 → 3:23/km)", () => {
  assert.equal(textoRitmo("triatlon", 4, 33 * 60 + 51, ESTANDAR_TRI), "3:23/km");
});

test("en duatlón las dos carreras se miden en min/km, cada una con su distancia", () => {
  const sprint = DISTANCIAS.duatlon.sprint.metros; // 5 km · 20 km · 2,5 km
  assert.equal(textoRitmo("duatlon", 0, 15 * 60, sprint), "3:00/km");
  assert.equal(textoRitmo("duatlon", 4, 600, sprint), "4:00/km");
  assert.equal(tipoDeRitmo("duatlon", 0), "carrera");
  assert.equal(tipoDeRitmo("triatlon", 0), "nado");
});

test("las transiciones, los tiempos no válidos y la falta de distancias no tienen ritmo", () => {
  assert.equal(textoRitmo("triatlon", 1, 30, ESTANDAR_TRI), "");
  assert.equal(textoRitmo("triatlon", 3, 30, ESTANDAR_TRI), "");
  assert.equal(textoRitmo("triatlon", 2, null, ESTANDAR_TRI), "");
  assert.equal(textoRitmo("triatlon", 2, 0, ESTANDAR_TRI), "");
  assert.equal(textoRitmo("triatlon", 2, 3000, null), "");
  assert.equal(textoRitmo("aquatlon", 0, 600, ESTANDAR_TRI), "", "deporte desconocido");
});

test("distanciasDe: predefinidas y personalizadas válidas o no", () => {
  assert.deepEqual(distanciasDe("triatlon", "sprint"), [750, 20000, 5000]);
  assert.equal(distanciasDe("duatlon", "supersprint"), null, "ese formato no existe en duatlón");
  assert.deepEqual(distanciasDe("triatlon", PERSONALIZADA, ["400", 10000, "2500"]), [400, 10000, 2500]);
  assert.equal(distanciasDe("triatlon", PERSONALIZADA, [400, 0, 2500]), null);
  assert.equal(distanciasDe("triatlon", PERSONALIZADA, [400, 10000]), null);
  assert.equal(distanciasDe("triatlon", PERSONALIZADA), null);
});
