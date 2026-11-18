// Previsión del tiempo de una carrera (PBI-40) con Open-Meteo: gratuita y sin clave.
// Primero se localiza el lugar (geocodificación) y luego se pide la previsión diaria de esa fecha.
// Open-Meteo solo prevé unos 16 días; fuera de ese plazo o si el servicio falla se devuelve null (la app sigue funcionando).
const GEOCODIFICACION = "https://geocoding-api.open-meteo.com/v1/search";
const PREVISION = "https://api.open-meteo.com/v1/forecast";
export const DIAS_DE_PREVISION = 16;

// Códigos WMO que usa Open-Meteo: [desde, hasta, texto]. El primer tramo que contiene el código da el texto.
const DESCRIPCIONES = [
  [0, 0, "Despejado"], [1, 2, "Poco nuboso"], [3, 3, "Nublado"],
  [45, 45, "Niebla"], [48, 48, "Niebla"],
  [51, 57, "Llovizna"], [61, 67, "Lluvia"], [80, 82, "Lluvia"],
  [71, 77, "Nieve"], [85, 86, "Nieve"],
  [95, Infinity, "Tormenta"],
];
export const describirCodigo = (codigo) => DESCRIPCIONES.find(([desde, hasta]) => codigo >= desde && codigo <= hasta)?.[2] ?? "Variable";

export function crearServicioMeteo({ fetchExterno = globalThis.fetch, tiempoMaximoMs = 5000, duracionCacheMs = 3_600_000, ahora = () => Date.now() } = {}) {
  const cache = new Map();
  const pedir = async (url) => {
    const r = await fetchExterno(url, { signal: AbortSignal.timeout(tiempoMaximoMs) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  async function localizar(lugar) {
    // «Águilas (Murcia)» → se busca «Águilas»
    const nombre = lugar.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
    const datos = await pedir(`${GEOCODIFICACION}?${new URLSearchParams({ name: nombre, count: "1", language: "es" })}`);
    const sitio = datos.results?.[0];
    return sitio ? { latitud: sitio.latitude, longitud: sitio.longitude, nombre: sitio.name } : null;
  }

  return {
    // fecha AAAA-MM-DD. Devuelve null si no hay lugar, no se encuentra o falla el servicio.
    async prevision(lugar, fecha) {
      if (!lugar?.trim()) return null;
      const clave = `${lugar.toLowerCase()}|${fecha}`;
      const guardada = cache.get(clave);
      if (guardada && ahora() - guardada.momento < duracionCacheMs) return guardada.valor;
      try {
        const sitio = await localizar(lugar);
        if (!sitio) return null;
        const datos = await pedir(`${PREVISION}?${new URLSearchParams({
          latitude: String(sitio.latitud), longitude: String(sitio.longitud), timezone: "auto", start_date: fecha, end_date: fecha,
          daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
        })}`);
        const d = datos.daily;
        if (!d?.time?.length || d.temperature_2m_max?.[0] == null) return null;
        const valor = {
          lugar: sitio.nombre, fecha,
          tMin: Math.round(d.temperature_2m_min[0]), tMax: Math.round(d.temperature_2m_max[0]),
          probLluvia: d.precipitation_probability_max?.[0] ?? null,
          vientoKmh: d.wind_speed_10m_max?.[0] == null ? null : Math.round(d.wind_speed_10m_max[0]),
          descripcion: describirCodigo(d.weather_code?.[0]),
          fuente: "Open-Meteo",
        };
        cache.set(clave, { momento: ahora(), valor });
        return valor;
      } catch {
        return null; // sin tiempo, pero sin romper nada
      }
    },
  };
}
