import test from "node:test";
import assert from "node:assert/strict";
import { crearAbridorClub } from "../../client/js/abrirClub.js";

const clubA = { id: "a", nombre: "Club A" };
const clubB = { id: "b", nombre: "Club B" };

function montar(cargar) {
  const registro = { pintado: [], fallos: [] };
  const abrir = crearAbridorClub({
    cargar,
    pintar: (datos, club) => registro.pintado.push([club.id, datos]),
    alFallar: (error, club) => registro.fallos.push([club.id, error.message]),
  });
  return { abrir, registro };
}

// Promesa que se resuelve o rechaza cuando el test lo decide.
function diferida() {
  let resolver; let rechazar;
  const promesa = new Promise((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

test("carga A bien y, si falla B, avisa de B (el detalle de A deja de ser el último)", async () => {
  const { abrir, registro } = montar(async (id) => {
    if (id === "b") throw new Error("sin conexión");
    return { club: id };
  });
  await abrir(clubA);
  await abrir(clubB);
  assert.deepEqual(registro.pintado, [["a", { club: "a" }]]);
  assert.deepEqual(registro.fallos, [["b", "sin conexión"]]);
});

test("una respuesta tardía del club anterior se descarta", async () => {
  const pendientes = { a: diferida(), b: diferida() };
  const { abrir, registro } = montar((id) => pendientes[id].promesa);
  const primera = abrir(clubA);
  const segunda = abrir(clubB);
  pendientes.b.resolver({ club: "b" });
  await segunda;
  pendientes.a.resolver({ club: "a" });
  await primera;
  assert.deepEqual(registro.pintado, [["b", { club: "b" }]]);
});

test("un fallo tardío del club anterior tampoco se muestra", async () => {
  const pendientes = { a: diferida(), b: diferida() };
  const { abrir, registro } = montar((id) => pendientes[id].promesa);
  const primera = abrir(clubA);
  const segunda = abrir(clubB);
  pendientes.b.resolver({ club: "b" });
  await segunda;
  pendientes.a.rechazar(new Error("tarde"));
  await primera;
  assert.deepEqual(registro.fallos, []);
});

test("descartarPendientes ignora lo que llegue después (p. ej. al cerrar sesión)", async () => {
  const d = diferida();
  const { abrir, registro } = montar(() => d.promesa);
  const en_curso = abrir(clubA);
  abrir.descartarPendientes();
  d.resolver({ club: "a" });
  await en_curso;
  assert.deepEqual(registro.pintado, []);
});
