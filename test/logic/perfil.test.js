// Perfil y material del atleta (PBI-42) y regla del neopreno de cada carrera.
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioPerfil, edadEn } from "../../server/logic/perfil.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { recomendarMaterial } from "../../server/logic/preparacion.js";
import { crearServicioConvocatorias } from "../../server/logic/convocatorias.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";

const codigo = (c) => (e) => e.codigo === c;
const repos = () => Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
const servicio = () => crearServicioPerfil({ repos: repos(), hoy: () => "2026-11-24" });

test("sin guardar nada devuelve un perfil vacío con dos huecos de zapatillas de duatlón", async () => {
  const p = await servicio().obtener("u1");
  assert.deepEqual(p.zapatillas.duatlon, { carrera1: "", carrera2: "", ciclismo: "" });
  assert.deepEqual(p.zapatillas.triatlon, { carrera: "", ciclismo: "" });
  assert.equal(p.edad, null);
  assert.deepEqual(p.bicis, []);
});

test("guarda y devuelve el perfil con la edad calculada; cada usuario solo ve el suyo", async () => {
  const s = servicio();
  const guardado = await s.guardar("u1", {
    nombre: " Ana ", apellidos: "López   Pérez", club: "Triatlón Albacete", fechaNacimiento: "2000-11-25", alturaCm: "168,5", pesoKg: 58,
    zapatillas: { triatlon: { carrera: "Nike Vaporfly", ciclismo: "Giro" }, duatlon: { carrera1: "A", carrera2: "B", ciclismo: "C" } },
    neopreno: { modelo: "Orca", tipo: "integral" },
    bicis: [{ nombre: "Canyon Speedmax", tipo: "contrarreloj" }, { nombre: "  ", tipo: "ruta" }],
  });
  assert.equal(guardado.nombre, "Ana");
  assert.equal(guardado.apellidos, "López Pérez");
  assert.equal(guardado.edad, 25); // cumple 26 mañana
  assert.equal(guardado.alturaCm, 168.5);
  assert.deepEqual(guardado.bicis, [{ nombre: "Canyon Speedmax", tipo: "contrarreloj" }]);
  assert.deepEqual(await s.obtener("u1"), guardado);
  assert.equal((await s.obtener("u2")).club, "");
  await s.guardar("u1", { club: "Otro" }); // sustituye al anterior
  assert.equal((await s.obtener("u1")).zapatillas.duatlon.carrera2, "");
  await s.eliminar("u1");
  assert.equal((await s.obtener("u1")).club, "");
});

test("edadEn cuenta los años cumplidos", () => {
  assert.equal(edadEn("2000-11-24", "2026-11-24"), 26);
  assert.equal(edadEn("2000-11-25", "2026-11-24"), 25);
  assert.equal(edadEn("", "2026-11-24"), null);
});

test("ERROR: datos inválidos", async () => {
  const s = servicio();
  for (const datos of [
    { fechaNacimiento: "2030-01-01" }, { fechaNacimiento: "2000-02-30" }, { fechaNacimiento: "ayer" },
    { alturaCm: 20 }, { alturaCm: "alto" }, { pesoKg: 500 },
    { neopreno: { tipo: "largo" } }, { bicis: [{ nombre: "x", tipo: "patinete" }] },
    { bicis: Array.from({ length: 6 }, (_, i) => ({ nombre: `b${i}` })) },
    { club: "x".repeat(81) }, { zapatillas: { duatlon: { carrera1: "x".repeat(61) } } },
  ]) await assert.rejects(s.guardar("u1", datos), codigo("DATOS_INVALIDOS"), JSON.stringify(datos));
});

test("recomendarMaterial: el neopreno depende de la regla de la carrera", () => {
  const nombre = (neopreno) => recomendarMaterial({ deporte: "triatlon", tiempo: null, neopreno }).filter((a) => a.nombre.startsWith("Neopreno")).map((a) => a.nombre);
  assert.deepEqual(nombre("obligatorio"), ["Neopreno (obligatorio en esta carrera)"]);
  assert.deepEqual(nombre("opcional"), ["Neopreno (opcional en esta carrera)"]);
  assert.deepEqual(nombre("prohibido"), []);
  assert.deepEqual(nombre("por confirmar"), ["Neopreno (por confirmar)"]);
  assert.deepEqual(nombre(undefined), ["Neopreno (por confirmar)"]);
  assert.ok(!recomendarMaterial({ deporte: "duatlon", tiempo: null }).some((a) => a.nombre.startsWith("Neopreno")));
});

test("convocatorias: el administrador fija la regla del neopreno (solo triatlón)", async () => {
  const r = repos();
  const usuarios = { exigirAdministrador: async () => {} };
  const s = crearServicioConvocatorias({ repos: r, usuarios, dominio: crearServicioDominio(r) });
  const base = { nombre: "Triatlón de prueba", fecha: "2027-06-06", lugar: "Pantano" };
  assert.equal((await s.crear("a", { ...base, deporte: "triatlon" })).neopreno, "por confirmar");
  assert.equal((await s.crear("a", { ...base, deporte: "triatlon", neopreno: "prohibido" })).neopreno, "prohibido");
  assert.equal((await s.crear("a", { ...base, deporte: "duatlon", neopreno: "obligatorio" })).neopreno, null);
  await assert.rejects(s.crear("a", { ...base, deporte: "triatlon", neopreno: "quizá" }), codigo("DATOS_INVALIDOS"));
});

test("recomendarMaterial: con drafting solo bici de ruta; sin drafting también contrarreloj", () => {
  const bici = (drafting) => recomendarMaterial({ deporte: "duatlon", tiempo: null, drafting }).find((a) => a.nombre.startsWith("Bici")).nombre;
  assert.match(bici("permitido"), /de ruta \(con drafting\)/);
  assert.match(bici("prohibido"), /contrarreloj/);
  assert.match(bici(undefined), /por confirmar/);
});

test("convocatorias: el administrador fija el drafting", async () => {
  const r = repos();
  const s = crearServicioConvocatorias({ repos: r, usuarios: { exigirAdministrador: async () => {} }, dominio: crearServicioDominio(r) });
  const base = { nombre: "Duatlón de prueba", deporte: "duatlon", fecha: "2027-06-06" };
  assert.equal((await s.crear("a", base)).drafting, "por confirmar");
  assert.equal((await s.crear("a", { ...base, drafting: "permitido" })).drafting, "permitido");
  await assert.rejects(s.crear("a", { ...base, drafting: "a veces" }), codigo("DATOS_INVALIDOS"));
});

test("cross: la bici recomendada es la MTB y la carrera lo guarda", async () => {
  assert.match(recomendarMaterial({ deporte: "triatlon", tiempo: null, drafting: "permitido", cross: true }).find((a) => a.nombre.startsWith("Bici")).nombre, /MTB/);
  const r = repos();
  const s = crearServicioConvocatorias({ repos: r, usuarios: { exigirAdministrador: async () => {} }, dominio: crearServicioDominio(r) });
  const base = { nombre: "Duatlón cross de prueba", deporte: "duatlon", fecha: "2027-06-06" };
  assert.equal((await s.crear("a", base)).cross, false);
  assert.equal((await s.crear("a", { ...base, cross: "on" })).cross, true);
});
