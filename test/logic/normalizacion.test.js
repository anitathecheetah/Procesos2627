import test from "node:test";
import assert from "node:assert/strict";
import { normalizarNombre, claveAtleta, claveClub } from "../../server/logic/normalizacion.js";
import { estadoDesdeTexto, cuentaParaElo, esAccionSancion, esInfraccionSancion } from "../../server/logic/catalogos.js";
import { ErrorLogica } from "../../server/logic/errores.js";

test("normalizarNombre quita tildes, paréntesis y espacios, y pasa a mayúsculas", () => {
  assert.equal(normalizarNombre("  Jesús  Narro   Miñano "), "JESUS NARRO MINANO");
  assert.equal(normalizarNombre("Sánchez Díaz (ESP), Álvaro"), "SANCHEZ DIAZ, ALVARO");
});

test("normalizarNombre de algo que no es texto devuelve cadena vacía", () => {
  assert.equal(normalizarNombre(undefined), "");
  assert.equal(normalizarNombre(42), "");
});

test("la clave de atleta es igual con distinta escritura y distinta con otro año", () => {
  assert.equal(claveAtleta("Jesús Narro", 1990), claveAtleta("JESUS  NARRO", "1990"));
  assert.notEqual(claveAtleta("Jesús Narro", 1990), claveAtleta("Jesús Narro", 1991));
  assert.equal(claveAtleta("Jesús Narro", 1990), "JESUS NARRO|1990");
});

test("ERROR: nombre vacío o año inválido se rechazan", () => {
  assert.throws(() => claveAtleta("   ", 1990), (e) => e instanceof ErrorLogica && e.codigo === "DATOS_INVALIDOS");
  assert.throws(() => claveAtleta("Ana", "abc"), (e) => e.codigo === "DATOS_INVALIDOS");
  assert.throws(() => claveAtleta("Ana", 1800), (e) => e.codigo === "DATOS_INVALIDOS");
  assert.throws(() => claveClub(""), (e) => e.codigo === "DATOS_INVALIDOS");
});

test("la clave de club ignora tildes y mayúsculas", () => {
  assert.equal(claveClub("Deporama Triatlón  Soriano"), claveClub("DEPORAMA TRIATLON SORIANO"));
});

test("estadoDesdeTexto reconoce DNF, DNS, DSQ/DQ y vacío; desconocidos devuelven null", () => {
  assert.equal(estadoDesdeTexto("DNF"), "dnf");
  assert.equal(estadoDesdeTexto(" dns "), "dns");
  assert.equal(estadoDesdeTexto("DSQ"), "dq");
  assert.equal(estadoDesdeTexto("DQ"), "dq");
  assert.equal(estadoDesdeTexto(""), "finalizado");
  assert.equal(estadoDesdeTexto("???"), null);
});

test("solo los finalizados cuentan para el Elo", () => {
  assert.equal(cuentaParaElo("finalizado"), true);
  for (const e of ["dnf", "dns", "dq"]) assert.equal(cuentaParaElo(e), false);
});

test("catálogo de sanciones", () => {
  assert.ok(esAccionSancion("DSQ") && esAccionSancion("ST"));
  assert.ok(esInfraccionSancion("LM") && esInfraccionSancion("OTH"));
  assert.ok(!esAccionSancion("XX") && !esInfraccionSancion("toString"));
});
