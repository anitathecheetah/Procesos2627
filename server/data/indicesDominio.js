// Índices de las colecciones del dominio. Los `unico` son las mismas reglas que
// `UNICOS_DOMINIO` impone en memoria, para que ambos repositorios se comporten igual.
export const UNICOS_DOMINIO = {
  atletas: [["clave"]],
  clubes: [["clave"]],
  pertenencias: [["atletaId", "temporada"]],
  pruebas: [["idExterno"]],
  resultados: [["pruebaId", "atletaId"]],
  sanciones: [],
  ratings: [["deporte", "atletaId"]],
  historialElo: [["deporte", "atletaId", "pruebaId"]],
  convocatorias: [],
  inscripciones: [["convocatoriaId", "usuarioId"]],
  salida: [["convocatoriaId", "atletaId"]], // lista de salida oficial de cada carrera
};

export const INDICES_DOMINIO = Object.fromEntries(
  Object.entries({
    atletas: [],
    clubes: [],
    pertenencias: [{ campos: ["clubId", "temporada"] }],
    pruebas: [{ campos: ["deporte", "fecha"] }],
    resultados: [{ campos: ["atletaId"] }, { campos: ["pruebaId", "posicion"] }],
    sanciones: [{ campos: ["pruebaId", "dorsal"] }],
    ratings: [{ campos: ["deporte", "rating"] }],
    historialElo: [{ campos: ["atletaId", "fecha"] }, { campos: ["pruebaId"] }],
    convocatorias: [{ campos: ["estado", "fecha"] }],
    inscripciones: [{ campos: ["usuarioId"] }],
    salida: [],
  }).map(([nombre, extra]) => [
    nombre,
    [...UNICOS_DOMINIO[nombre].map((campos) => ({ campos, unico: true })), ...extra],
  ]),
);
