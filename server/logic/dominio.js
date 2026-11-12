// Capa lógica del dominio deportivo: atletas, clubes, pertenencia a club por temporada y pruebas.
// No conoce Express ni la base de datos: recibe repositorios con el contrato de coleccionMemoria.js.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { claveAtleta, claveClub, validarAnioNacimiento } from "./normalizacion.js";
import { DEPORTES, TIPOS_PRUEBA } from "./catalogos.js";

const TEMPORADA_VALIDA = /^\d{4}$/;
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const SEXOS = ["M", "F"];

function exigirTemporada(temporada) {
  if (!TEMPORADA_VALIDA.test(String(temporada))) {
    throw new ErrorLogica("DATOS_INVALIDOS", "La temporada debe ser un año de cuatro cifras");
  }
  return String(temporada);
}

// repos: { atletas, clubes, pertenencias, pruebas }
export function crearServicioDominio(repos) {
  return {
    // Devuelve el atleta con ese nombre y año de nacimiento, creándolo si no existía.
    async obtenerOCrearAtleta({ nombre, anioNacimiento, sexo } = {}) {
      const clave = claveAtleta(nombre, anioNacimiento);
      if (sexo !== undefined && !SEXOS.includes(sexo)) throw new ErrorLogica("DATOS_INVALIDOS", "El sexo debe ser M o F");
      const existente = await repos.atletas.buscarUno({ clave });
      if (existente) return existente;
      return repos.atletas.crear({
        id: randomUUID(),
        clave,
        nombre: nombre.trim().replace(/\s+/g, " "),
        anioNacimiento: validarAnioNacimiento(anioNacimiento),
        ...(sexo ? { sexo } : {}),
      });
    },

    async obtenerOCrearClub(nombre) {
      const clave = claveClub(nombre);
      const existente = await repos.clubes.buscarUno({ clave });
      if (existente) return existente;
      return repos.clubes.crear({ id: randomUUID(), clave, nombre: nombre.trim().replace(/\s+/g, " ") });
    },

    // El club se guarda por temporada, no en el atleta: si ya tenía club ese año, se cambia.
    async asignarClub(atletaId, temporada, clubId) {
      const anio = exigirTemporada(temporada);
      if (!(await repos.atletas.buscarPorId(atletaId))) throw new ErrorLogica("NO_ENCONTRADO", "El atleta no existe");
      if (!(await repos.clubes.buscarPorId(clubId))) throw new ErrorLogica("NO_ENCONTRADO", "El club no existe");
      const actual = await repos.pertenencias.buscarUno({ atletaId, temporada: anio });
      if (actual) return repos.pertenencias.actualizar({ ...actual, clubId });
      return repos.pertenencias.crear({ id: randomUUID(), atletaId, temporada: anio, clubId });
    },

    // Club del atleta en una temporada (null si no consta).
    async clubDeAtleta(atletaId, temporada) {
      const p = await repos.pertenencias.buscarUno({ atletaId, temporada: exigirTemporada(temporada) });
      return p ? repos.clubes.buscarPorId(p.clubId) : null;
    },

    // idExterno: identificador de la prueba en la web de origen (evita importarla dos veces).
    async crearPrueba({ idExterno, nombre, deporte, tipo = "individual", fecha, categoria } = {}) {
      if (typeof idExterno !== "string" || idExterno.trim() === "") throw new ErrorLogica("DATOS_INVALIDOS", "El identificador de la prueba es obligatorio");
      if (typeof nombre !== "string" || nombre.trim() === "") throw new ErrorLogica("DATOS_INVALIDOS", "El nombre de la prueba es obligatorio");
      if (!DEPORTES.includes(deporte)) throw new ErrorLogica("DATOS_INVALIDOS", `El deporte debe ser uno de: ${DEPORTES.join(", ")}`);
      if (!TIPOS_PRUEBA.includes(tipo)) throw new ErrorLogica("DATOS_INVALIDOS", `El tipo debe ser uno de: ${TIPOS_PRUEBA.join(", ")}`);
      if (typeof fecha !== "string" || !FECHA_VALIDA.test(fecha) || Number.isNaN(Date.parse(fecha))) {
        throw new ErrorLogica("DATOS_INVALIDOS", "La fecha debe tener el formato AAAA-MM-DD");
      }
      if (await repos.pruebas.buscarUno({ idExterno: idExterno.trim() })) {
        throw new ErrorLogica("DUPLICADO", "La prueba ya está importada");
      }
      return repos.pruebas.crear({
        id: randomUUID(),
        idExterno: idExterno.trim(),
        nombre: nombre.trim(),
        deporte,
        tipo,
        fecha,
        temporada: fecha.slice(0, 4),
        ...(categoria ? { categoria } : {}),
      });
    },

    async obtenerPrueba(id) {
      const prueba = await repos.pruebas.buscarPorId(id);
      if (!prueba) throw new ErrorLogica("NO_ENCONTRADO", "La prueba no existe");
      return prueba;
    },

    // Pruebas de un deporte ordenadas por fecha (el Elo las recorre en este orden).
    async listarPruebas({ deporte } = {}) {
      const pruebas = await repos.pruebas.listar(deporte ? { deporte } : {});
      return pruebas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre));
    },
  };
}
