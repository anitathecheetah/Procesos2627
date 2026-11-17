import test from "node:test";
import assert from "node:assert/strict";
import { textoDias, proximaCarreraApuntada, textoTiempo } from "../../client/js/cuentaAtras.js";

test("textoDias", () => {
  assert.deepEqual([0, 1, 5, -1, -4].map(textoDias), ["¡Es hoy!", "Mañana", "Faltan 5 días", "Fue ayer", "Hace 4 días"]);
  assert.equal(textoDias(undefined), "");
});
test("proximaCarreraApuntada elige la apuntada más cercana que no ha pasado", () => {
  const c = [
    { id: "a", apuntado: true, diasRestantes: 20 }, { id: "b", apuntado: true, diasRestantes: 4 },
    { id: "c", apuntado: false, diasRestantes: 1 }, { id: "d", apuntado: true, diasRestantes: -2 },
  ];
  assert.equal(proximaCarreraApuntada(c).id, "b");
  assert.equal(proximaCarreraApuntada([{ apuntado: false, diasRestantes: 3 }]), null);
});
test("textoTiempo", () => {
  assert.equal(textoTiempo({ descripcion: "Lluvia", tMin: 4, tMax: 14, probLluvia: 70, vientoKmh: 35 }), "Lluvia · 4–14 °C · lluvia 70% · viento 35 km/h");
  assert.equal(textoTiempo(null), "");
});
