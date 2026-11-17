// Previsión del tiempo de una carrera (PBI-40) con Open-Meteo: gratuita y sin clave.
// Primero se localiza el lugar (geocodificación) y luego se pide la previsión diaria de esa fecha.
// Open-Meteo solo prevé unos 16 días; fuera de ese plazo o si el servicio falla se devuelve null (la app sigue funcionando).
const GEOCODIFICACION = "https://geocoding-api.open-meteo.com/v1/search";
const PREVISION = "https://api.open-meteo.com/v1/forecast";
export const DIAS_DE_PREVISION = 16;

// Códigos WMO que usa Open-Meteo.
export function describirCodigo(codigo) {
  if (codigo === 0) return "Despejado";
  if (codigo <= 2) return "Poco nuboso";
  if (codigo === 3) return "Nublado";
  if (codigo === 45 || codigo === 48) return "Niebla";
  if (codigo >= 51 && codigo <= 57) return "Llovizna";
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return "Lluvia";
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return "Nieve";
  if (codigo >= 95) return "Tormenta";
  return "Variable";
}

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
