// Ranking Elo por deporte. El recálculo recorre todas las pruebas por orden de fecha y es determinista:
// con los mismos resultados siempre da el mismo ranking. La fórmula está en docs/ranking-elo.md.
import { conColores } from "./coloresClubes.js";
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { DEPORTES, COMUNIDADES, cuentaParaElo, nombreComunidad } from "./catalogos.js";
import { RATING_INICIAL, actualizarCarrera } from "./elo.js";

const TAMANO_MAXIMO = 100;
const MEJORES_POR_DEFECTO = 5; // cuántos atletas de un club cuentan para su nota
const MINIMO_ATLETAS_POR_DEFECTO = 3; // un club con menos atletas con ranking no aparece
const SEXOS = ["M", "F"];

function exigirDeporte(deporte) {
  if (!DEPORTES.includes(deporte)) throw new ErrorLogica("DATOS_INVALIDOS", `El deporte debe ser uno de: ${DEPORTES.join(", ")}`);
  return deporte;
}
function entero(valor, porDefecto, nombre, minimo, maximo = Infinity) {
  if (valor === undefined || valor === "") return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < minimo || n > maximo) {
    throw new ErrorLogica("DATOS_INVALIDOS", `${nombre} debe ser un entero entre ${minimo} y ${maximo === Infinity ? "∞" : maximo}`);
  }
  return n;
}

export function crearServicioRanking({ repos, usuarios, log = { info() {} } }) {
  return {
    // Recalcula desde cero el ranking de un deporte (solo administradores).
    async recalcular(solicitanteId, deporte) {
      await usuarios.exigirAdministrador(solicitanteId);
      exigirDeporte(deporte);

      const pruebas = (await repos.pruebas.listar({ deporte }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.idExterno.localeCompare(b.idExterno));

      const sexoDe = new Map((await repos.atletas.listar()).map((a) => [a.id, a.sexo]));
      const actual = new Map(); // atletaId -> { rating, pruebas, clubId, ultimaFecha }
      const historial = [];
      let pruebasCalculadas = 0;
      for (const prueba of pruebas) {
        const participantes = (await repos.resultados.listar({ pruebaId: prueba.id }))
          .filter((r) => cuentaParaElo(r.estado) && Number.isInteger(r.posicion))
          .sort((a, b) => a.posicion - b.posicion || a.atletaId.localeCompare(b.atletaId));
        const cambios = actualizarCarrera(
          new Map([...actual].map(([id, v]) => [id, v.rating])),
          participantes.map((r) => ({ atletaId: r.atletaId, posicion: r.posicion })),
        );
        if (!cambios.size) continue; // menos de 2 que puntúen: la prueba no mueve a nadie
        pruebasCalculadas++;
        for (const r of participantes) {
          const { antes, despues } = cambios.get(r.atletaId);
          const previo = actual.get(r.atletaId);
          actual.set(r.atletaId, {
            rating: despues,
            pruebas: (previo?.pruebas ?? 0) + 1,
            clubId: r.clubId ?? previo?.clubId,
            federacion: r.federacion ?? previo?.federacion,
            ultimaFecha: prueba.fecha,
          });
          historial.push({
            id: randomUUID(), deporte, atletaId: r.atletaId, pruebaId: prueba.id, fecha: prueba.fecha,
            posicion: r.posicion, participantes: participantes.length, ratingAntes: antes, ratingDespues: despues,
          });
        }
      }

      await repos.ratings.eliminarPor({ deporte });
      await repos.historialElo.eliminarPor({ deporte });
      await repos.ratings.crearVarios([...actual].map(([atletaId, v]) => ({
        id: randomUUID(), deporte, atletaId, rating: v.rating, pruebas: v.pruebas,
        ...(v.clubId ? { clubId: v.clubId } : {}), ...(v.federacion ? { federacion: v.federacion } : {}), ...(sexoDe.get(atletaId) ? { sexo: sexoDe.get(atletaId) } : {}), ultimaFecha: v.ultimaFecha,
      })));
      await repos.historialElo.crearVarios(historial);
      log.info("Ranking recalculado", { deporte, pruebas: pruebasCalculadas, atletas: actual.size });
      return { deporte, pruebas: pruebasCalculadas, atletas: actual.size };
    },

    // Ranking paginado, de mayor a menor rating. minPruebas deja fuera a quien ha corrido pocas.
    async ranking(deporte, { pagina, tamano, minPruebas, sexo, comunidad } = {}) {
      exigirDeporte(deporte);
      if (comunidad && !COMUNIDADES.some((c) => c.nombre === comunidad)) throw new ErrorLogica("DATOS_INVALIDOS", "La comunidad autónoma no existe");
      if (sexo && !SEXOS.includes(sexo)) throw new ErrorLogica("DATOS_INVALIDOS", "El sexo debe ser M o F");
      const p = entero(pagina, 1, "La página", 1);
      const t = entero(tamano, 50, "El tamaño", 1, TAMANO_MAXIMO);
      const minimo = entero(minPruebas, 1, "El mínimo de pruebas", 1);

      const todos = (await repos.ratings.listar({ deporte }))
        .filter((r) => r.pruebas >= minimo && (!sexo || r.sexo === sexo) && (!comunidad || nombreComunidad(r.federacion) === comunidad))
        .sort((a, b) => b.rating - a.rating || b.pruebas - a.pruebas || a.atletaId.localeCompare(b.atletaId));
      const desde = (p - 1) * t;
      const filas = await Promise.all(todos.slice(desde, desde + t).map(async (r, i) => {
        const [atleta, club] = await Promise.all([repos.atletas.buscarPorId(r.atletaId), r.clubId ? repos.clubes.buscarPorId(r.clubId) : null]);
        return {
          posicion: desde + i + 1,
          atleta: { id: atleta.id, nombre: atleta.nombre },
          club: club ? conColores({ id: club.id, nombre: club.nombre }) : null,
          comunidad: nombreComunidad(r.federacion),
          rating: Math.round(r.rating),
          pruebas: r.pruebas,
        };
      }));
      return { deporte, total: todos.length, pagina: p, tamano: t, filas };
    },

    // Ranking de clubes de un deporte: la nota de un club es la media del Elo de sus mejores atletas
    // (por defecto los 5 mejores). Cada atleta cuenta en el club con el que corrió su última prueba.
    // Los clubes con menos de `minAtletas` atletas con ranking no aparecen: así no gana un club
    // con un solo atleta fuerte. Se calcula al consultar a partir del ranking de atletas ya recalculado.
    async rankingClubes(deporte, { pagina, tamano, sexo, mejores, minAtletas } = {}) {
      exigirDeporte(deporte);
      if (sexo && !SEXOS.includes(sexo)) throw new ErrorLogica("DATOS_INVALIDOS", "El sexo debe ser M o F");
      const p = entero(pagina, 1, "La página", 1);
      const t = entero(tamano, 50, "El tamaño", 1, TAMANO_MAXIMO);
      const cuentan = entero(mejores, MEJORES_POR_DEFECTO, "El número de mejores atletas", 1, 20);
      const minimo = entero(minAtletas, MINIMO_ATLETAS_POR_DEFECTO, "El mínimo de atletas", 1);

      const porClub = new Map(); // clubId -> ratings de sus atletas
      for (const r of await repos.ratings.listar({ deporte })) {
        if (!r.clubId || (sexo && r.sexo !== sexo)) continue;
        porClub.set(r.clubId, [...(porClub.get(r.clubId) ?? []), r]);
      }
      const clubes = [];
      for (const [clubId, atletas] of porClub) {
        if (atletas.length < minimo) continue;
        const top = atletas.sort((a, b) => b.rating - a.rating || a.atletaId.localeCompare(b.atletaId)).slice(0, cuentan);
        clubes.push({ clubId, atletas: atletas.length, top, rating: top.reduce((suma, r) => suma + r.rating, 0) / top.length });
      }
      clubes.sort((a, b) => b.rating - a.rating || b.atletas - a.atletas || a.clubId.localeCompare(b.clubId));

      const desde = (p - 1) * t;
      const filas = await Promise.all(clubes.slice(desde, desde + t).map(async (c, i) => {
        const club = await repos.clubes.buscarPorId(c.clubId);
        return {
          posicion: desde + i + 1,
          club: conColores({ id: club.id, nombre: club.nombre }),
          rating: Math.round(c.rating),
          atletas: c.atletas,
          mejores: await Promise.all(c.top.map(async (r) => ({ id: r.atletaId, nombre: (await repos.atletas.buscarPorId(r.atletaId)).nombre, rating: Math.round(r.rating) }))),
        };
      }));
      return { deporte, total: clubes.length, pagina: p, tamano: t, mejores: cuentan, minAtletas: minimo, filas };
    },
  };
}

export { RATING_INICIAL };
