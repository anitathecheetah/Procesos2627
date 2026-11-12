// Importación de una clasificación (Excel) como una prueba con sus resultados.
// Solo administradores. Si algo falla a medias, se deshace lo creado para poder reintentar.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { leerResultados } from "./excelResultados.js";
import { normalizarNombre } from "./normalizacion.js";

// repos: { atletas, pruebas, resultados, ... }; dominio: servicio de dominio.js; usuarios: servicio de usuarios.
export function crearServicioImportacion({ repos, dominio, usuarios, log = { info() {} } }) {
  return {
    async importar(solicitanteId, meta = {}, buffer) {
      await usuarios.exigirAdministrador(solicitanteId);
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new ErrorLogica("DATOS_INVALIDOS", "Falta el archivo Excel");
      }
      const { resultados, descartadas } = await leerResultados(buffer);
      if (resultados.length === 0) throw new ErrorLogica("DATOS_INVALIDOS", "El Excel no contiene resultados válidos");

      // La prueba rechaza datos inválidos y también una prueba ya importada (mismo idExterno).
      const prueba = await dominio.crearPrueba(meta);
      const sexo = meta.sexo || undefined;

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
        for (const r of resultados) {
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
      log.info("Prueba importada", { prueba: prueba.id, importados, descartados: descartadas.length });
      return { prueba, importados, descartadas, revisar };
    },
  };
}
