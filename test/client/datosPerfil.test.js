import test from "node:test";
import assert from "node:assert/strict";
import { perfilDesdeFormulario, formularioDesdePerfil, textoEdad } from "../../client/js/datosPerfil.js";

test("formulario → perfil: agrupa zapatillas, neopreno y bicis; descarta bicis vacías", () => {
  const p = perfilDesdeFormulario({ club: "C", tri_carrera: "a", dua_carrera1: "b", dua_carrera2: "c", neo_modelo: "m", neo_tipo: "corto", bici1_nombre: "Canyon", bici1_tipo: "mtb", bici2_nombre: " " });
  assert.equal(p.zapatillas.triatlon.carrera, "a");
  assert.deepEqual(p.zapatillas.duatlon, { carrera1: "b", carrera2: "c", ciclismo: "" });
  assert.deepEqual(p.neopreno, { modelo: "m", tipo: "corto" });
  assert.deepEqual(p.bicis, [{ nombre: "Canyon", tipo: "mtb" }]);
});

test("perfil → formulario y vuelta: no pierde datos", () => {
  const p = perfilDesdeFormulario({ nombre: "Ana", alturaCm: "170", tri_ciclismo: "Giro", bici1_nombre: "Canyon", bici1_tipo: "ruta", bici3_nombre: "Orbea", bici3_tipo: "mtb" });
  const f = formularioDesdePerfil({ ...p, bicis: p.bicis, edad: null });
  assert.equal(f.bici2_nombre, "Orbea"); // las bicis se compactan: sin huecos vacíos
  assert.equal(f.bici3_nombre, "");
  assert.deepEqual(perfilDesdeFormulario(f), p);
});

test("textoEdad", () => { assert.equal(textoEdad(25), "25 años"); assert.equal(textoEdad(null), ""); });
