// Ranking Elo por deporte. El recálculo recorre todas las pruebas por orden de fecha y es determinista:
// con los mismos resultados siempre da el mismo ranking. La fórmula está en docs/ranking-elo.md.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { DEPORTES, cuentaParaElo } from "./catalogos.js";
import { RATING_INICIAL, actualizarCarrera } from "./elo.js";

const TAMANO_MAXIMO = 100;
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
        ...(v.clubId ? { clubId: v.clubId } : {}), ...(sexoDe.get(atletaId) ? { sexo: sexoDe.get(atletaId) } : {}), ultimaFecha: v.ultimaFecha,
      })));
      await repos.historialElo.crearVarios(historial);
      log.info("Ranking recalculado", { deporte, pruebas: pruebasCalculadas, atletas: actual.size });
      return { deporte, pruebas: pruebasCalculadas, atletas: actual.size };
    },

    // Ranking paginado, de mayor a menor rating. minPruebas deja fuera a quien ha corrido pocas.
    async ranking(deporte, { pagina, tamano, minPruebas, sexo } = {}) {
      exigirDeporte(deporte);
      if (sexo && !SEXOS.includes(sexo)) throw new ErrorLogica("DATOS_INVALIDOS", "El sexo debe ser M o F");
      const p = entero(pagina, 1, "La página", 1);
      const t = entero(tamano, 50, "El tamaño", 1, TAMANO_MAXIMO);
      const minimo = entero(minPruebas, 1, "El mínimo de pruebas", 1);

      const todos = (await repos.ratings.listar({ deporte }))
        .filter((r) => r.pruebas >= minimo && (!sexo || r.sexo === sexo))
        .sort((a, b) => b.rating - a.rating || b.pruebas - a.pruebas || a.atletaId.localeCompare(b.atletaId));
      const desde = (p - 1) * t;
      const filas = await Promise.all(todos.slice(desde, desde + t).map(async (r, i) => {
        const [atleta, club] = await Promise.all([repos.atletas.buscarPorId(r.atletaId), r.clubId ? repos.clubes.buscarPorId(r.clubId) : null]);
        return {
          posicion: desde + i + 1,
          atleta: { id: atleta.id, nombre: atleta.nombre },
          club: club ? { id: club.id, nombre: club.nombre } : null,
          rating: Math.round(r.rating),
          pruebas: r.pruebas,
        };
      }));
      return { deporte, total: todos.length, pagina: p, tamano: t, filas };
    },
  };
}

export { RATING_INICIAL };
