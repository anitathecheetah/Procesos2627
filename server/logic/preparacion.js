// Preparación de una carrera (PBI-40): días que faltan, previsión del tiempo y material recomendado.
// Documentada en docs/preparacion.md.
import { ErrorLogica } from "./errores.js";
import { DIAS_DE_PREVISION } from "./meteo.js";

// Fecha de hoy (AAAA-MM-DD) en la hora de España, que es donde se corren estas carreras.
export const hoyEnEspana = (fecha = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(fecha);

export function diasHasta(fechaCarrera, hoy = hoyEnEspana()) {
  return Math.round((Date.parse(`${fechaCarrera}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

const buscar = (q) => `https://www.google.es/search?${new URLSearchParams({ q })}`;
const articulo = (nombre, motivo, consulta) => ({ nombre, motivo, enlace: buscar(consulta) });

// Reglas sencillas y explicadas, no una base de productos: dicen QUÉ conviene y por qué, y enlazan a una búsqueda
// para comparar reseñas actuales. No se citan productos ni valoraciones concretas porque no se pueden verificar aquí.
export function recomendarMaterial({ deporte, tiempo }) {
  const r = [];
  const ropa = deporte === "triatlon" ? "triatlón" : "duatlón";
  if (tiempo) {
    const { tMin, tMax, probLluvia, vientoKmh } = tiempo;
    if (tMin <= 8 || tMax <= 14) {
      r.push(articulo("Camiseta térmica o manga larga bajo el mono", `Mínima de ${tMin} °C: en la bici el viento enfría mucho más.`, `camiseta térmica ${ropa} manga larga`));
      r.push(articulo("Guantes finos y calcetines", "Con frío las manos y los pies son lo primero que se pierde.", "guantes ciclismo finos primavera"));
    }
    if (tMax >= 27) {
      r.push(articulo("Gorra o visera y crema solar resistente al agua", `Máxima de ${tMax} °C.`, "crema solar deportiva resistente al agua"));
      r.push(articulo("Sales o electrolitos y bidón extra", "Con calor se pierden muchas sales: hidratarse solo con agua no basta.", "sales electrolitos deporte resistencia"));
    }
    if (probLluvia != null && probLluvia >= 40) {
      r.push(articulo("Gafas con lente transparente y cortavientos ligero", `Probabilidad de lluvia del ${probLluvia}%.`, "cortavientos ligero impermeable ciclismo"));
    }
    if (vientoKmh != null && vientoKmh >= 30) {
      r.push(articulo("Revisar ruedas de perfil alto", `Viento de hasta ${vientoKmh} km/h: las ruedas altas desestabilizan la bici.`, "ruedas perfil bajo viento lateral triatlón"));
    }
  }
  r.push(articulo("Geles o barritas para la bici", "Practica la nutrición en los entrenos: no estrenes nada el día de la carrera.", "gel energético triatlón reseñas"));
  if (deporte === "triatlon") {
    r.push(articulo("Neopreno", "Comprueba en el reglamento si es obligatorio o está permitido según la temperatura del agua.", "neopreno triatlón reglamento temperatura agua"));
    r.push(articulo("Antiempañante para las gafas de natación", "Evita perder referencias en la natación.", "antiempañante gafas natación"));
  }
  return r;
}

export function crearServicioPreparacion({ repos, meteo, hoy = hoyEnEspana }) {
  return {
    async preparacion(id) {
      const c = await repos.convocatorias.buscarPorId(id);
      if (!c) throw new ErrorLogica("NO_ENCONTRADO", "La carrera no existe");
      const dias = diasHasta(c.fecha, hoy());
      const dentroDelPlazo = dias >= 0 && dias <= DIAS_DE_PREVISION;
      const tiempo = dentroDelPlazo ? await meteo.prevision(c.lugar, c.fecha) : null;
      return {
        carrera: { id: c.id, nombre: c.nombre, deporte: c.deporte, fecha: c.fecha, lugar: c.lugar },
        diasRestantes: dias,
        tiempo,
        sinPrevision: tiempo ? null
          : dias < 0 ? "La carrera ya se ha celebrado."
          : dias > DIAS_DE_PREVISION ? `La previsión aparece cuando faltan ${DIAS_DE_PREVISION} días o menos.`
          : !c.lugar ? "La carrera no tiene lugar indicado."
          : "No se ha podido obtener la previsión ahora mismo.",
        recomendaciones: dias < 0 ? [] : recomendarMaterial({ deporte: c.deporte, tiempo }),
      };
    },
  };
}
