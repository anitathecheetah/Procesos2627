// Catálogos cerrados del dominio: deportes, estados de un resultado y códigos de sanción.
export const DEPORTES = Object.freeze(["duatlon", "triatlon"]);
export const TIPOS_PRUEBA = Object.freeze(["individual", "liga"]);

// Estado de un atleta en una prueba. Solo FINALIZADO cuenta para el Elo (se guardan todos).
export const ESTADOS_RESULTADO = Object.freeze({
  FINALIZADO: "finalizado",
  DNF: "dnf", // no terminó
  DNS: "dns", // no salió
  DQ: "dq", // descalificado
});

// Equivalencias de textos que aparecen en las clasificaciones.
const ALIAS_ESTADO = {
  FIN: "finalizado", FINISHED: "finalizado", FINALIZADO: "finalizado", "": "finalizado",
  DNF: "dnf", ABANDONO: "dnf", RET: "dnf",
  DNS: "dns", NP: "dns",
  DQ: "dq", DSQ: "dq", DESCALIFICADO: "dq",
};
export function estadoDesdeTexto(texto) {
  const clave = String(texto ?? "").trim().toUpperCase();
  return ALIAS_ESTADO[clave] ?? null;
}
export const cuentaParaElo = (estado) => estado === ESTADOS_RESULTADO.FINALIZADO;

// Acciones del acta de sanciones.
export const ACCIONES_SANCION = Object.freeze({
  DSQ: "Descalificar",
  ST: "Sanción por tiempo",
});

// Infracciones del acta.
export const INFRACCIONES_SANCION = Object.freeze({
  LM: "Montar antes de la línea",
  OTH: "Otras infracciones",
});

export const esAccionSancion = (c) => Object.hasOwn(ACCIONES_SANCION, c);
export const esInfraccionSancion = (c) => Object.hasOwn(INFRACCIONES_SANCION, c);

// Comunidades autónomas. OJO: no es de dónde es el atleta, sino la federación autonómica en la que sacó su LICENCIA
// federativa. El Excel de la federación la trae en la columna FEDERACION como un código corto (p. ej. «MAD»). `alias` recoge otras formas habituales de escribirlo.
// Se guarda el código tal cual viene y la comunidad se deduce al consultar: corregir este catálogo no obliga a reimportar.
export const COMUNIDADES = Object.freeze([
  { nombre: "Andalucía", codigo: "AND", alias: ["ANDALUCIA"] },
  { nombre: "Aragón", codigo: "ARA", alias: ["ARAGON"] },
  { nombre: "Asturias", codigo: "AST", alias: ["ASTU", "PRINCIPADO DE ASTURIAS"] },
  { nombre: "Illes Balears", codigo: "BAL", alias: ["IB", "BALEARES", "ISLAS BALEARES"] },
  { nombre: "Canarias", codigo: "CAN", alias: ["CNA", "CNR", "ICA", "ISLAS CANARIAS"] },
  { nombre: "Cantabria", codigo: "CNT", alias: ["CANT", "CTB"] },
  { nombre: "Castilla-La Mancha", codigo: "CLM", alias: ["CM", "CASTILLA LA MANCHA"] },
  { nombre: "Castilla y León", codigo: "CYL", alias: ["CL", "CLE", "CASTILLA Y LEON"] },
  { nombre: "Cataluña", codigo: "CAT", alias: ["CATALUNYA", "CATALUNA"] },
  { nombre: "Comunitat Valenciana", codigo: "VAL", alias: ["CV", "CVA", "VALENCIA", "COMUNIDAD VALENCIANA", "COMUNITAT VALENCIANA"] },
  { nombre: "Extremadura", codigo: "EXT", alias: ["EXTR"] },
  { nombre: "Galicia", codigo: "GAL", alias: [] },
  { nombre: "Comunidad de Madrid", codigo: "MAD", alias: ["MADRID", "COMUNIDAD DE MADRID"] },
  { nombre: "Región de Murcia", codigo: "MUR", alias: ["MURCIA", "REGION DE MURCIA"] },
  { nombre: "Navarra", codigo: "NAV", alias: ["NA", "COMUNIDAD FORAL DE NAVARRA"] },
  { nombre: "País Vasco", codigo: "PV", alias: ["PVA", "EUS", "EUSK", "EUSKADI", "PAIS VASCO"] },
  { nombre: "La Rioja", codigo: "RIO", alias: ["LR", "LRI", "RIOJA", "LA RIOJA"] },
  { nombre: "Ceuta", codigo: "CEU", alias: [] },
  { nombre: "Melilla", codigo: "MEL", alias: [] },
]);

const clave = (t) => String(t ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase();
const PORCLAVE = new Map(COMUNIDADES.flatMap((c) => [c.codigo, c.nombre, ...c.alias].map((a) => [clave(a), c])));

// La comunidad que corresponde a un código de federación (o a su nombre), o null si no se reconoce.
export const comunidadDeFederacion = (texto) => PORCLAVE.get(clave(texto)) ?? null;
// Código tal cual viene en el Excel, limpio y en mayúsculas ("" si no hay).
export const codigoFederacion = (texto) => clave(texto);
// Texto para mostrar: el nombre de la comunidad, o el código tal cual si no se reconoce; null si no hay.
export const nombreComunidad = (federacion) => (federacion ? (comunidadDeFederacion(federacion)?.nombre ?? federacion) : null);
