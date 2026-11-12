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
