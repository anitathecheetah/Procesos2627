// Cuenta atrás, previsión del tiempo y material recomendado (PBI-40).
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioMeteo, describirCodigo } from "../../server/logic/meteo.js";
import { crearServicioPreparacion, diasHasta, recomendarMaterial, hoyEnEspana } from "../../server/logic/preparacion.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";

const respuesta = (cuerpo, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => cuerpo });
function fetchFalso({ sitio = true, ok = true } = {}) {
  const llamadas = [];
  const f = async (url) => {
    llamadas.push(String(url));
    if (!ok) return respuesta({}, false);
    if (String(url).includes("geocoding")) return respuesta(sitio ? { results: [{ name: "Águilas", latitude: 37.4, longitude: -1.58 }] } : {});
    return respuesta({ daily: { time: ["2027-02-07"], weather_code: [61], temperature_2m_max: [13.6], temperature_2m_min: [4.2], precipitation_probability_max: [70], wind_speed_10m_max: [35.4] } });
  };
  f.llamadas = llamadas;
  return f;
}

test("diasHasta cuenta días naturales", () => {
  assert.equal(diasHasta("2027-02-07", "2027-02-07"), 0);
  assert.equal(diasHasta("2027-02-07", "2027-02-04"), 3);
  assert.equal(diasHasta("2027-02-07", "2027-02-10"), -3);
  assert.match(hoyEnEspana(), /^\d{4}-\d{2}-\d{2}$/);
});

test("meteo: localiza el lugar (sin el paréntesis) y resume la previsión", async () => {
  const f = fetchFalso();
  const t = await crearServicioMeteo({ fetchExterno: f }).prevision("Águilas (Murcia)", "2027-02-07");
  assert.deepEqual(t, { lugar: "Águilas", fecha: "2027-02-07", tMin: 4, tMax: 14, probLluvia: 70, vientoKmh: 35, descripcion: "Lluvia", fuente: "Open-Meteo" });
  assert.match(f.llamadas[0], /name=%C3%81guilas&/);
});

test("meteo: cachea y no rompe si el lugar no existe o el servicio falla", async () => {
  const f = fetchFalso();
  const m = crearServicioMeteo({ fetchExterno: f });
  await m.prevision("Águilas", "2027-02-07");
  await m.prevision("águilas", "2027-02-07");
  assert.equal(f.llamadas.length, 2, "geocodificación + previsión, una sola vez");
  assert.equal(await crearServicioMeteo({ fetchExterno: fetchFalso({ sitio: false }) }).prevision("Nowhere", "2027-02-07"), null);
  assert.equal(await crearServicioMeteo({ fetchExterno: fetchFalso({ ok: false }) }).prevision("Águilas", "2027-02-07"), null);
  assert.equal(await crearServicioMeteo({ fetchExterno: async () => { throw new Error("red"); } }).prevision("Águilas", "2027-02-07"), null);
  assert.equal(await m.prevision("  ", "2027-02-07"), null);
  assert.equal(describirCodigo(0), "Despejado");
  assert.equal(describirCodigo(95), "Tormenta");
});

test("material: térmica con frío, protección con calor, lluvia y viento", () => {
  const nombres = (tiempo, deporte = "duatlon") => recomendarMaterial({ deporte, tiempo }).map((a) => a.nombre);
  assert.ok(nombres({ tMin: 3, tMax: 12, probLluvia: 10, vientoKmh: 10 }).some((n) => /térmica/i.test(n)));
  assert.ok(!nombres({ tMin: 15, tMax: 24, probLluvia: 0, vientoKmh: 5 }).some((n) => /térmica/i.test(n)));
  assert.ok(nombres({ tMin: 20, tMax: 32, probLluvia: 0, vientoKmh: 5 }).some((n) => /solar/i.test(n)));
  assert.ok(nombres({ tMin: 12, tMax: 20, probLluvia: 80, vientoKmh: 5 }).some((n) => /cortavientos/i.test(n)));
  assert.ok(nombres({ tMin: 12, tMax: 20, probLluvia: 0, vientoKmh: 40 }).some((n) => /ruedas/i.test(n)));
  assert.ok(nombres(null).some((n) => /geles/i.test(n)), "sin tiempo, al menos la nutrición");
  assert.ok(nombres(null, "triatlon").some((n) => /neopreno/i.test(n)));
  assert.ok(!nombres(null, "duatlon").some((n) => /neopreno/i.test(n)));
  assert.ok(recomendarMaterial({ deporte: "duatlon", tiempo: null }).every((a) => a.enlace.startsWith("https://")));
});

function servicio(hoy, meteo) {
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  return { repos, servicio: crearServicioPreparacion({ repos, meteo, hoy: () => hoy }) };
}
const carrera = (fecha, lugar = "Águilas") => ({ id: "c1", nombre: "Duatlón Águilas", deporte: "duatlon", fecha, lugar, estado: "abierta" });
const meteoFalso = { prevision: async () => ({ tMin: 3, tMax: 12, probLluvia: 0, vientoKmh: 5, descripcion: "Despejado" }) };

test("preparación: dentro de 16 días trae tiempo y material; fuera, lo explica", async () => {
  const { repos, servicio: s } = servicio("2027-02-01", meteoFalso);
  await repos.convocatorias.crear(carrera("2027-02-07"));
  const p = await s.preparacion("c1");
  assert.equal(p.diasRestantes, 6);
  assert.equal(p.tiempo.tMax, 12);
  assert.ok(p.recomendaciones.some((a) => /térmica/i.test(a.nombre)));

  const lejos = servicio("2027-01-01", meteoFalso);
  await lejos.repos.convocatorias.crear(carrera("2027-02-07"));
  const l = await lejos.servicio.preparacion("c1");
  assert.equal(l.tiempo, null);
  assert.match(l.sinPrevision, /16 días/);
  assert.ok(l.recomendaciones.length > 0);

  const pasada = servicio("2027-03-01", meteoFalso);
  await pasada.repos.convocatorias.crear(carrera("2027-02-07"));
  const q = await pasada.servicio.preparacion("c1");
  assert.deepEqual([q.diasRestantes < 0, q.recomendaciones.length, q.sinPrevision], [true, 0, "La carrera ya se ha celebrado."]);
});

test("preparación: sin lugar o con el servicio caído sigue funcionando; carrera inexistente", async () => {
  const caido = servicio("2027-02-01", { prevision: async () => null });
  await caido.repos.convocatorias.crear(carrera("2027-02-07"));
  assert.match((await caido.servicio.preparacion("c1")).sinPrevision, /No se ha podido/);
  const sinLugar = servicio("2027-02-01", { prevision: async () => null });
  await sinLugar.repos.convocatorias.crear(carrera("2027-02-07", ""));
  assert.match((await sinLugar.servicio.preparacion("c1")).sinPrevision, /lugar/);
  await assert.rejects(() => caido.servicio.preparacion("nada"), (e) => e.codigo === "NO_ENCONTRADO");
});
