// Consultas públicas de pruebas, clasificaciones y atletas. Solo lectura.
import { ErrorLogica } from "./errores.js";
import { normalizarNombre } from "./normalizacion.js";
import { DEPORTES, ESTADOS_RESULTADO } from "./catalogos.js";

const MAX_BUSQUEDA = 50;
const ORDEN_ESTADO = { [ESTADOS_RESULTADO.FINALIZADO]: 0, [ESTADOS_RESULTADO.DQ]: 1, [ESTADOS_RESULTADO.DNF]: 2, [ESTADOS_RESULTADO.DNS]: 3 };

// Busca por id con caché para no repetir lecturas dentro de una misma consulta.
function conCache(buscar) {
  const memoria = new Map();
  return async (id) => {
    if (!id) return null;
    if (!memoria.has(id)) memoria.set(id, buscar(id));
    return memoria.get(id);
  };
}
const resumenClub = (c) => (c ? { id: c.id, nombre: c.nombre } : null);
const resumenSanciones = (lista) => lista.map(({ pares, observaciones }) => ({ pares, ...(observaciones ? { observaciones } : {}) }));

export function crearServicioConsulta({ repos }) {
  return {
    // Pruebas más recientes primero. Filtros opcionales: deporte, temporada.
    async listarPruebas({ deporte, temporada } = {}) {
      if (deporte && !DEPORTES.includes(deporte)) {
        throw new ErrorLogica("DATOS_INVALIDOS", `El deporte debe ser uno de: ${DEPORTES.join(", ")}`);
      }
      if (temporada && !/^\d{4}$/.test(temporada)) throw new ErrorLogica("DATOS_INVALIDOS", "La temporada debe ser un año de cuatro cifras");
      const filtro = { ...(deporte ? { deporte } : {}), ...(temporada ? { temporada } : {}) };
      const pruebas = await repos.pruebas.listar(filtro);
      const conParticipantes = await Promise.all(
        pruebas.map(async (p) => ({ ...p, participantes: (await repos.resultados.listar({ pruebaId: p.id })).length })),
      );
      return conParticipantes.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre));
    },

    // Prueba con su clasificación: finalistas por posición y después descalificados, abandonos y no salidos.
    async detallePrueba(id) {
      const prueba = await repos.pruebas.buscarPorId(id);
      if (!prueba) throw new ErrorLogica("NO_ENCONTRADO", "La prueba no existe");
      const [resultados, sanciones] = await Promise.all([repos.resultados.listar({ pruebaId: id }), repos.sanciones.listar({ pruebaId: id })]);
      const atleta = conCache((i) => repos.atletas.buscarPorId(i));
      const club = conCache((i) => repos.clubes.buscarPorId(i));

      const clasificacion = await Promise.all(resultados.map(async (r) => {
        const a = await atleta(r.atletaId);
        return {
          resultadoId: r.id,
          posicion: r.posicion,
          estado: r.estado,
          dorsal: r.dorsal,
          tiempoTotal: r.tiempoTotal,
          parciales: r.parciales,
          ...(r.invitado ? { invitado: true } : {}),
          ...(r.revisar ? { revisar: r.revisar } : {}),
          atleta: { id: a.id, nombre: a.nombre, anioNacimiento: a.anioNacimiento },
          club: resumenClub(await club(r.clubId)),
          sanciones: resumenSanciones(sanciones.filter((s) => s.resultadoId === r.id)),
        };
      }));
      clasificacion.sort((x, y) =>
        (ORDEN_ESTADO[x.estado] ?? 9) - (ORDEN_ESTADO[y.estado] ?? 9) ||
        (x.posicion ?? Infinity) - (y.posicion ?? Infinity) ||
        String(x.dorsal).localeCompare(String(y.dorsal), "es", { numeric: true }),
      );
      return { prueba, clasificacion };
    },

    // Búsqueda por nombre: todas las palabras escritas deben aparecer, sin importar tildes, mayúsculas ni el orden.
    async buscarAtletas(q) {
      const palabras = normalizarNombre(q).split(" ").filter(Boolean);
      if (palabras.join("").length < 2) throw new ErrorLogica("DATOS_INVALIDOS", "Escribe al menos 2 letras para buscar");
      const todos = await repos.atletas.listar();
      return todos
        .filter((a) => {
          const nombre = normalizarNombre(a.nombre);
          return palabras.every((p) => nombre.includes(p));
        })
        .sort((a, b) => normalizarNombre(a.nombre).localeCompare(normalizarNombre(b.nombre)) || a.anioNacimiento - b.anioNacimiento)
        .slice(0, MAX_BUSQUEDA)
        .map(({ id, nombre, anioNacimiento, sexo }) => ({ id, nombre, anioNacimiento, ...(sexo ? { sexo } : {}) }));
    },

    // Ficha del atleta: clubes por temporada e historial de resultados (más recientes primero) con sus sanciones.
    async fichaAtleta(id) {
      const atleta = await repos.atletas.buscarPorId(id);
      if (!atleta) throw new ErrorLogica("NO_ENCONTRADO", "El atleta no existe");
      const [pertenencias, resultados, sanciones] = await Promise.all([
        repos.pertenencias.listar({ atletaId: id }),
        repos.resultados.listar({ atletaId: id }),
        repos.sanciones.listar({ atletaId: id }),
      ]);
      const club = conCache((i) => repos.clubes.buscarPorId(i));
      const prueba = conCache((i) => repos.pruebas.buscarPorId(i));

      const clubes = await Promise.all(pertenencias.map(async (p) => ({ temporada: p.temporada, club: resumenClub(await club(p.clubId)) })));
      const historial = await Promise.all(resultados.map(async (r) => {
        const p = await prueba(r.pruebaId);
        return {
          pruebaId: r.pruebaId,
          prueba: { nombre: p.nombre, fecha: p.fecha, deporte: p.deporte, tipo: p.tipo },
          posicion: r.posicion,
          estado: r.estado,
          dorsal: r.dorsal,
          tiempoTotal: r.tiempoTotal,
          club: resumenClub(await club(r.clubId)),
          sanciones: resumenSanciones(sanciones.filter((s) => s.resultadoId === r.id)),
        };
      }));
      historial.sort((a, b) => b.prueba.fecha.localeCompare(a.prueba.fecha));

      // Elo por deporte: rating actual y su evolución prueba a prueba (si ya se ha calculado el ranking).
      const elo = [];
      for (const deporte of DEPORTES) {
        const rating = await repos.ratings.buscarUno({ atletaId: id, deporte });
        if (!rating) continue;
        const pasos = (await repos.historialElo.listar({ atletaId: id, deporte })).sort((a, b) => a.fecha.localeCompare(b.fecha));
        elo.push({
          deporte,
          rating: Math.round(rating.rating),
          pruebas: rating.pruebas,
          historial: await Promise.all(pasos.map(async (h) => ({
            pruebaId: h.pruebaId, prueba: (await prueba(h.pruebaId)).nombre, fecha: h.fecha, posicion: h.posicion,
            participantes: h.participantes, antes: Math.round(h.ratingAntes), despues: Math.round(h.ratingDespues),
          }))),
        });
      }
      return {
        atleta: { id: atleta.id, nombre: atleta.nombre, anioNacimiento: atleta.anioNacimiento, ...(atleta.sexo ? { sexo: atleta.sexo } : {}) },
        clubes: clubes.sort((a, b) => b.temporada.localeCompare(a.temporada)),
        resultados: historial,
        elo,
      };
    },
  };
}
