import test from "node:test";
import assert from "node:assert/strict";
import { evaluarBici } from "../../server/logic/bicis.js";
import { crearServicioPreparacion, recomendarMaterial } from "../../server/logic/preparacion.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";

test("evaluarBici: cross → MTB; fuera de cross no hay MTB; contrarreloj solo sin drafting", () => {
  assert.deepEqual(evaluarBici({ tipo: "mtb" }, { cross: true }), { valida: true });
  assert.equal(evaluarBici({ tipo: "ruta" }, { cross: true }).valida, false);
  assert.equal(evaluarBici({ tipo: "contrarreloj" }, { cross: true }).valida, false);
  assert.equal(evaluarBici({ tipo: "mtb" }, { drafting: "prohibido" }).valida, false);
  assert.equal(evaluarBici({ tipo: "ruta" }, { drafting: "permitido" }).valida, true);
  assert.equal(evaluarBici({ tipo: "contrarreloj" }, { drafting: "permitido" }).valida, false);
  assert.deepEqual(evaluarBici({ tipo: "contrarreloj" }, { drafting: "prohibido" }), { valida: true });
  const dudosa = evaluarBici({ tipo: "contrarreloj" }, { drafting: "por confirmar" });
  assert.ok(dudosa.valida && /reglamento/.test(dudosa.aviso));
  assert.equal(evaluarBici({ tipo: "contrarreloj" }, {}).valida, true); // sin dato = por confirmar
});

test("las recomendaciones ya no hablan de la bici: se elige en «Mi bici»", () => {
  for (const deporte of ["duatlon", "triatlon"]) {
    assert.ok(!recomendarMaterial({ deporte, tiempo: null }).some((a) => /^Bici/.test(a.nombre)));
  }
});

test("preparación: sin sesión no hay material; con sesión salen las bicis con su validez y la elegida", async () => {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  await repos.convocatorias.crear({ id: "c1", nombre: "Duatlón", deporte: "duatlon", fecha: "2027-02-07", lugar: "Águilas", drafting: "permitido", cross: false, estado: "abierta" });
  await repos.perfiles.crear({ id: "u1", usuarioId: "u1", bicis: [{ nombre: "Ruta", tipo: "ruta" }, { nombre: "CRI", tipo: "contrarreloj" }] });
  const s = crearServicioPreparacion({ repos, meteo: { prevision: async () => null }, hoy: () => "2026-11-24" });
  assert.equal((await s.preparacion("c1")).material, null);
  assert.deepEqual((await s.preparacion("c1", "u1")).material, {
    inscrito: false, bici: null,
    bicis: [{ nombre: "Ruta", tipo: "ruta", valida: true }, { nombre: "CRI", tipo: "contrarreloj", valida: false, motivo: "con drafting no se permite la bici de contrarreloj" }],
  });
  await repos.inscripciones.crear({ id: "i1", convocatoriaId: "c1", usuarioId: "u1", nombre: "A B C", bici: { nombre: "Ruta", tipo: "ruta" } });
  const m = (await s.preparacion("c1", "u1")).material;
  assert.deepEqual([m.inscrito, m.bici], [true, { nombre: "Ruta", tipo: "ruta" }]);
});
