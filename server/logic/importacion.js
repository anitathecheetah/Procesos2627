// Importación de una clasificación (Excel) como una prueba con sus resultados.
// Solo administradores. Si algo falla a medias, se deshace lo creado para poder reintentar.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { leerResultados } from "./excelResultados.js";
import { normalizarNombre } from "./normalizacion.js";

// Protección de menores: por defecto no se importa a quien pueda ser menor de edad en el año de la prueba.
// Se compara solo el año de nacimiento, así que se excluye también a quien cumple 18 ese año (lado prudente).
// Los menores se descartan antes de guardar nada: ni su nombre ni su año llegan a la base de datos ni al log.
export const MAYORIA_DE_EDAD = 18;
export const esPosibleMenor = (anioNacimiento, fechaPrueba) => Number(fechaPrueba.slice(0, 4)) - anioNacimiento <= MAYORIA_DE_EDAD;

// repos: { atletas, pruebas, resultados, ... }; dominio: servicio de dominio.js; usuarios: servicio de usuarios.
export function crearServicioImportacion({ repos, dominio, usuarios, log = { info() {} } }) {
  return {
    // meta.soloMayores (por defecto true): false permite importar también a los posibles menores.
    async importar(solicitanteId, { soloMayores = true, ...meta } = {}, buffer) {
      await usuarios.exigirAdministrador(solicitanteId);
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new ErrorLogica("DATOS_INVALIDOS", "Falta el archivo Excel");
      }
      const { resultados, descartadas } = await leerResultados(buffer);
      if (resultados.length === 0) throw new ErrorLogica("DATOS_INVALIDOS", "El Excel no contiene resultados válidos");

      // La prueba rechaza datos inválidos y también una prueba ya importada (mismo idExterno).
      const prueba = await dominio.crearPrueba(meta);
      const sexo = meta.sexo || undefined;

      const permitidos = soloMayores === false ? resultados : resultados.filter((r) => !esPosibleMenor(r.anioNacimiento, prueba.fecha));
      const menoresExcluidos = resultados.length - permitidos.length;
      if (permitidos.length === 0) {
        await repos.pruebas.eliminar(prueba.id);
        throw new ErrorLogica("DATOS_INVALIDOS", "El Excel solo contiene posibles menores de edad: no se importa nada");
      }

      // Nombres ya conocidos, para avisar de posibles homónimos con otro año de nacimiento.
      const aniosPorNombre = new Map();
      for (const a of await repos.atletas.listar()) {
        const nombre = normalizarNombre(a.nombre);
        aniosPorNombre.set(nombre, [...(aniosPorNombre.get(nombre) ?? []), a.anioNacimiento]);
      }

      const vistos = new Set();
      const revisar = [];
      let importados = 0;
      try {
        for (const r of permitidos) {
          const nombreNorm = normalizarNombre(r.nombre);
          const otrosAnios = (aniosPorNombre.get(nombreNorm) ?? []).filter((y) => y !== r.anioNacimiento);
          const atleta = await dominio.obtenerOCrearAtleta({ nombre: r.nombre, anioNacimiento: r.anioNacimiento, sexo });
          if (vistos.has(atleta.id)) {
            descartadas.push({ fila: null, motivo: `atleta repetido en el archivo: ${r.nombre}` });
            continue;
          }
          vistos.add(atleta.id);
          if (!aniosPorNombre.get(nombreNorm)?.includes(r.anioNacimiento)) {
            aniosPorNombre.set(nombreNorm, [...(aniosPorNombre.get(nombreNorm) ?? []), r.anioNacimiento]);
          }

          // Solo se marca para revisar lo dudoso; que se haya inferido DNF/DNS se guarda pero no es un problema.
          const motivos = r.avisos.filter((a) => !a.startsWith("estado inferido"));
          if (otrosAnios.length) motivos.push(`mismo nombre con otro año de nacimiento (${otrosAnios.join(", ")})`);

          let clubId;
          if (r.club) {
            const club = await dominio.obtenerOCrearClub(r.club);
            clubId = club.id;
            // El club de la temporada es el de la primera prueba en la que aparece; el de cada prueba va en el resultado.
            if (!(await dominio.clubDeAtleta(atleta.id, prueba.temporada))) {
              await dominio.asignarClub(atleta.id, prueba.temporada, club.id);
            }
          }

          await repos.resultados.crear({
            id: randomUUID(),
            pruebaId: prueba.id,
            atletaId: atleta.id,
            ...(clubId ? { clubId } : {}),
            ...(r.federacion ? { federacion: r.federacion } : {}),
            dorsal: r.dorsal,
            posicion: r.posicion,
            estado: r.estado,
            tiempoTotal: r.tiempoTotal,
            parciales: r.parciales,
            ...(r.invitado ? { invitado: true } : {}),
            ...(motivos.length ? { revisar: motivos } : {}),
          });
          importados++;
          if (motivos.length) revisar.push({ atleta: r.nombre, dorsal: r.dorsal, motivos });
        }
      } catch (e) {
        for (const x of await repos.resultados.listar({ pruebaId: prueba.id })) await repos.resultados.eliminar(x.id);
        await repos.pruebas.eliminar(prueba.id);
        throw e;
      }
      log.info("Prueba importada", { prueba: prueba.id, importados, descartados: descartadas.length, menoresExcluidos });
      return { prueba, importados, menoresExcluidos, descartadas, revisar };
    },

    // Elimina una prueba con sus resultados y sanciones (solo administradores). Los atletas y clubes que se
    // quedan sin ninguna otra prueba también se eliminan, con su rating e historial. Después hay que
    // recalcular el ranking del deporte para que los atletas que siguen no conserven puntos de esta prueba.
    async eliminarPrueba(solicitanteId, id) {
      await usuarios.exigirAdministrador(solicitanteId);
      const prueba = await repos.pruebas.buscarPorId(id);
      if (!prueba) throw new ErrorLogica("NO_ENCONTRADO", "La prueba no existe");

      const resultados = await repos.resultados.listar({ pruebaId: id });
      await repos.sanciones.eliminarPor({ pruebaId: id });
      await repos.historialElo.eliminarPor({ pruebaId: id });
      await repos.resultados.eliminarPor({ pruebaId: id });
      await repos.pruebas.eliminar(id);

      let atletasEliminados = 0;
      for (const atletaId of new Set(resultados.map((r) => r.atletaId))) {
        if ((await repos.resultados.listar({ atletaId })).length) continue; // sigue en otras pruebas
        await repos.ratings.eliminarPor({ atletaId });
        await repos.historialElo.eliminarPor({ atletaId });
        await repos.pertenencias.eliminarPor({ atletaId });
        await repos.atletas.eliminar(atletaId);
        atletasEliminados++;
      }
      let clubesEliminados = 0;
      for (const clubId of new Set(resultados.map((r) => r.clubId).filter(Boolean))) {
        const enUso = (await repos.resultados.listar({ clubId })).length || (await repos.pertenencias.listar({ clubId })).length;
        if (enUso) continue;
        await repos.clubes.eliminar(clubId);
        clubesEliminados++;
      }
      log.info("Prueba eliminada", { prueba: id, resultados: resultados.length, atletasEliminados, clubesEliminados });
      return { eliminada: id, idExterno: prueba.idExterno, deporte: prueba.deporte, resultados: resultados.length, atletasEliminados, clubesEliminados };
    },
  };
}
