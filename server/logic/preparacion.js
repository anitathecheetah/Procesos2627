// Preparación de una carrera (PBI-40): días que faltan, previsión del tiempo y material recomendado.
// Documentada en docs/preparacion.md.
import { ErrorLogica } from "./errores.js";
import { DIAS_DE_PREVISION } from "./meteo.js";
import { evaluarBici } from "./bicis.js";

// Fecha de hoy (AAAA-MM-DD) en la hora de España, que es donde se corren estas carreras.
export const hoyEnEspana = (fecha = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(fecha);

export function diasHasta(fechaCarrera, hoy = hoyEnEspana()) {
  return Math.round((Date.parse(`${fechaCarrera}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

const buscar = (q) => `https://www.google.es/search?${new URLSearchParams({ q })}`;
const articulo = (nombre, motivo, consulta) => ({ nombre, motivo, enlace: buscar(consulta) });

// Reglas sencillas y explicadas, no una base de productos: dicen QUÉ conviene y por qué, y enlazan a una búsqueda
// para comparar reseñas actuales. No se citan productos ni valoraciones concretas porque no se pueden verificar aquí.
// Cada regla dice cuándo se aplica y qué artículos aporta; el orden de la lista es el orden de las recomendaciones.
// Para añadir una recomendación basta con añadir una regla. `tiempo` es null si no hay previsión.
const REGLAS = [
  {
    aplica: ({ tiempo: t }) => t && (t.tMin <= 8 || t.tMax <= 14),
    articulos: ({ deporte, tiempo: t }) => [
      articulo("Camiseta térmica o manga larga bajo el mono", `Mínima de ${t.tMin} °C: en la bici el viento enfría mucho más.`, `camiseta térmica ${nombreDeporte(deporte)} manga larga`),
      articulo("Guantes finos y calcetines", "Con frío las manos y los pies son lo primero que se pierde.", "guantes ciclismo finos primavera"),
    ],
  },
  {
    aplica: ({ tiempo: t }) => t && t.tMax >= 27,
    articulos: ({ tiempo: t }) => [
      articulo("Gorra o visera y crema solar resistente al agua", `Máxima de ${t.tMax} °C.`, "crema solar deportiva resistente al agua"),
      articulo("Sales o electrolitos y bidón extra", "Con calor se pierden muchas sales: hidratarse solo con agua no basta.", "sales electrolitos deporte resistencia"),
    ],
  },
  {
    aplica: ({ tiempo: t }) => t && t.probLluvia != null && t.probLluvia >= 40,
    articulos: ({ tiempo: t }) => [articulo("Gafas con lente transparente y cortavientos ligero", `Probabilidad de lluvia del ${t.probLluvia}%.`, "cortavientos ligero impermeable ciclismo")],
  },
  {
    aplica: ({ tiempo: t }) => t && t.vientoKmh != null && t.vientoKmh >= 30,
    articulos: ({ tiempo: t }) => [articulo("Revisar ruedas de perfil alto", `Viento de hasta ${t.vientoKmh} km/h: las ruedas altas desestabilizan la bici.`, "ruedas perfil bajo viento lateral triatlón")],
  },
  {
    aplica: () => true,
    articulos: () => [articulo("Geles o barritas para la bici", "Practica la nutrición en los entrenos: no estrenes nada el día de la carrera.", "gel energético triatlón reseñas")],
  },
  {
    aplica: ({ deporte }) => deporte === "triatlon",
    articulos: ({ neopreno }) => [
      NEOPRENO[neopreno in NEOPRENO ? neopreno : "por confirmar"],
      articulo("Antiempañante para las gafas de natación", "Evita perder referencias en la natación.", "antiempañante gafas natación"),
    ].filter(Boolean),
  },
];
// Qué decir del neopreno según lo que haya fijado el administrador para esa carrera. No se dan umbrales de
// temperatura: dependen del reglamento y de la decisión de la organización el mismo día.
const NEOPRENO = {
  obligatorio: articulo("Neopreno (obligatorio en esta carrera)", "La organización lo exige: sin él no podrás tomar la salida.", "neopreno triatlón"),
  opcional: articulo("Neopreno (opcional en esta carrera)", "Puedes elegir. Decide con la temperatura del agua que confirme la organización; si lo llevas, pruébalo antes en aguas abiertas.", "neopreno triatlón"),
  prohibido: null, // no se recomienda comprar ni llevar nada: se avisa en la propia preparación
  "por confirmar": articulo("Neopreno (por confirmar)", "Aún no se sabe si será obligatorio, opcional o prohibido: depende de la temperatura del agua y del aire. Mira el reglamento y el aviso de la organización.", "neopreno triatlón reglamento temperatura agua"),
};
const nombreDeporte = (deporte) => (deporte === "triatlon" ? "triatlón" : "duatlón");

export function recomendarMaterial({ deporte, tiempo, neopreno }) {
  const contexto = { deporte, tiempo, neopreno };
  return REGLAS.filter((regla) => regla.aplica(contexto)).flatMap((regla) => regla.articulos(contexto));
}

async function materialDelUsuario(repos, carrera, usuarioId) {
  const inscripcion = await repos.inscripciones.buscarUno({ convocatoriaId: carrera.id, usuarioId });
  const perfil = await repos.perfiles.buscarPorId(usuarioId);
  const bicis = (perfil?.bicis ?? []).map((b) => ({ nombre: b.nombre, tipo: b.tipo, ...evaluarBici(b, carrera) }));
  return { inscrito: Boolean(inscripcion), bici: inscripcion?.bici ?? null, bicis };
}

export function crearServicioPreparacion({ repos, meteo, hoy = hoyEnEspana }) {
  return {
    // `usuarioId` (opcional) añade el material del usuario: si está apuntado, qué bici ha elegido y cuáles de las suyas valen.
    async preparacion(id, usuarioId) {
      const c = await repos.convocatorias.buscarPorId(id);
      if (!c) throw new ErrorLogica("NO_ENCONTRADO", "La carrera no existe");
      const dias = diasHasta(c.fecha, hoy());
      const dentroDelPlazo = dias >= 0 && dias <= DIAS_DE_PREVISION;
      const tiempo = dentroDelPlazo ? await meteo.prevision(c.lugar, c.fecha) : null;
      return {
        carrera: { id: c.id, nombre: c.nombre, deporte: c.deporte, fecha: c.fecha, lugar: c.lugar, neopreno: c.neopreno ?? null, drafting: c.drafting ?? "por confirmar", cross: Boolean(c.cross) },
        diasRestantes: dias,
        tiempo,
        sinPrevision: tiempo ? null
          : dias < 0 ? "La carrera ya se ha celebrado."
          : dias > DIAS_DE_PREVISION ? `La previsión aparece cuando faltan ${DIAS_DE_PREVISION} días o menos.`
          : !c.lugar ? "La carrera no tiene lugar indicado."
          : "No se ha podido obtener la previsión ahora mismo.",
        material: usuarioId ? await materialDelUsuario(repos, c, usuarioId) : null,
        recomendaciones: dias < 0 ? [] : recomendarMaterial({ deporte: c.deporte, tiempo, neopreno: c.neopreno }),
      };
    },
  };
}
