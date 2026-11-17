// Próximas carreras (convocatorias) e inscripciones de usuarios (PBI-37 y PBI-38).
// El administrador crea la carrera; cada usuario con sesión puede apuntarse o desapuntarse mientras esté
// abierta. Cuando la federación publica el listado real y el administrador lo importa como una prueba, se
// vincula con la carrera (pasa a «celebrada») y se compara quién de los apuntados participó de verdad.
// Documentada en docs/convocatorias.md.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { DEPORTES, ESTADOS_RESULTADO } from "./catalogos.js";
import { normalizarNombre } from "./normalizacion.js";

export const ESTADOS_CONVOCATORIA = Object.freeze({ ABIERTA: "abierta", CELEBRADA: "celebrada" });
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function texto(valor, campo, { min = 0, max }) {
  const t = typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
  if (t.length < min || t.length > max) {
    throw new ErrorLogica("DATOS_INVALIDOS", min ? `${campo} debe tener entre ${min} y ${max} caracteres` : `${campo} no puede tener más de ${max} caracteres`);
  }
  return t;
}
function fechaValida(fecha) {
  if (typeof fecha !== "string" || !ISO.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) ||
      new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) !== fecha) {
    throw new ErrorLogica("DATOS_INVALIDOS", "La fecha debe tener el formato AAAA-MM-DD y existir");
  }
  return fecha;
}

// Las palabras del nombre del usuario deben aparecer todas en el nombre del atleta (da igual el orden, las
// tildes o si va «APELLIDOS, NOMBRE»). Hacen falta al menos 2 palabras para no confundir a cualquiera.
const palabras = (nombre) => normalizarNombre(nombre).replace(/,/g, " ").split(" ").filter(Boolean);
export function coincidenNombres(nombreUsuario, nombreAtleta) {
  const buscadas = palabras(nombreUsuario);
  const delAtleta = new Set(palabras(nombreAtleta));
  return buscadas.length >= 2 && buscadas.every((p) => delAtleta.has(p));
}

export function crearServicioConvocatorias({ repos, usuarios, log = { info() {} } }) {
  async function buscar(id) {
    const c = await repos.convocatorias.buscarPorId(id);
    if (!c) throw new ErrorLogica("NO_ENCONTRADO", "La carrera no existe");
    return c;
  }

  // Compara los apuntados con los participantes de la prueba vinculada.
  async function calcularAsistencia(convocatoria) {
    const prueba = await repos.pruebas.buscarPorId(convocatoria.pruebaId);
    const resultados = (await repos.resultados.listar({ pruebaId: prueba.id })).filter((r) => r.estado !== ESTADOS_RESULTADO.DNS);
    const participantes = await Promise.all(resultados.map(async (r) => ({ resultado: r, atleta: await repos.atletas.buscarPorId(r.atletaId) })));
    const usados = new Set();
    const apuntados = (await repos.inscripciones.listar({ convocatoriaId: convocatoria.id }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((i) => {
        const coincidencia = participantes.find((p) => !usados.has(p.atleta.id) && coincidenNombres(i.nombre, p.atleta.nombre));
        if (coincidencia) usados.add(coincidencia.atleta.id);
        return {
          usuarioId: i.usuarioId, nombre: i.nombre, participo: Boolean(coincidencia),
          ...(coincidencia ? { atleta: { id: coincidencia.atleta.id, nombre: coincidencia.atleta.nombre }, estado: coincidencia.resultado.estado, posicion: coincidencia.resultado.posicion } : {}),
        };
      });
    return {
      convocatoria: { id: convocatoria.id, nombre: convocatoria.nombre, fecha: convocatoria.fecha },
      prueba: { id: prueba.id, nombre: prueba.nombre, fecha: prueba.fecha },
      participantes: participantes.length,
      participaron: apuntados.filter((a) => a.participo).length,
      noParticiparon: apuntados.filter((a) => !a.participo).length,
      sinApuntarse: participantes.length - usados.size,
      apuntados,
    };
  }

  return {
    // Crea una carrera futura (solo administradores).
    async crear(solicitanteId, { nombre, deporte, fecha, lugar } = {}) {
      await usuarios.exigirAdministrador(solicitanteId);
      if (!DEPORTES.includes(deporte)) throw new ErrorLogica("DATOS_INVALIDOS", `El deporte debe ser uno de: ${DEPORTES.join(", ")}`);
      const c = {
        id: randomUUID(),
        nombre: texto(nombre, "El nombre", { min: 3, max: 100 }),
        deporte,
        fecha: fechaValida(fecha),
        lugar: texto(lugar ?? "", "El lugar", { max: 100 }),
        estado: ESTADOS_CONVOCATORIA.ABIERTA,
        creadaPor: solicitanteId,
      };
      await repos.convocatorias.crear(c);
      log.info("Carrera creada", { id: c.id, fecha: c.fecha });
      return { ...c, apuntados: 0 };
    },

    // Público. Las abiertas primero (la más próxima arriba), luego las celebradas (la más reciente arriba).
    // Con usuarioId añade `apuntado` (si esa persona está apuntada). Solo cuenta apuntados, no los nombra.
    async listar({ usuarioId } = {}) {
      const todas = await repos.convocatorias.listar();
      const filas = await Promise.all(todas.map(async ({ creadaPor: _c, ...c }) => {
        const inscritos = await repos.inscripciones.listar({ convocatoriaId: c.id });
        return { ...c, apuntados: inscritos.length, ...(usuarioId ? { apuntado: inscritos.some((i) => i.usuarioId === usuarioId) } : {}) };
      }));
      const abiertas = (c) => c.estado === ESTADOS_CONVOCATORIA.ABIERTA;
      return filas.sort((a, b) => (abiertas(b) - abiertas(a)) || (abiertas(a) ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha)) || a.nombre.localeCompare(b.nombre, "es"));
    },

    // Borra la carrera y sus inscripciones (solo administradores).
    async eliminar(solicitanteId, id) {
      await usuarios.exigirAdministrador(solicitanteId);
      await buscar(id);
      await repos.inscripciones.eliminarPor({ convocatoriaId: id });
      await repos.convocatorias.eliminar(id);
      log.info("Carrera eliminada", { id });
    },

    // El usuario de la sesión se apunta. Si ya lo estaba, no pasa nada.
    async apuntarse(usuarioId, id) {
      if (!usuarioId) throw new ErrorLogica("NO_AUTENTICADO", "Inicia sesión para apuntarte");
      const usuario = await usuarios.obtener(usuarioId);
      const c = await buscar(id);
      if (c.estado !== ESTADOS_CONVOCATORIA.ABIERTA) throw new ErrorLogica("DATOS_INVALIDOS", "La carrera ya no admite inscripciones");
      if (!(await repos.inscripciones.buscarUno({ convocatoriaId: id, usuarioId }))) {
        await repos.inscripciones.crear({ id: randomUUID(), convocatoriaId: id, usuarioId, nombre: usuario.nombre });
      }
    },

    // El usuario de la sesión deja de ir. Si no estaba apuntado, no pasa nada.
    async desapuntarse(usuarioId, id) {
      if (!usuarioId) throw new ErrorLogica("NO_AUTENTICADO", "Inicia sesión para desapuntarte");
      const c = await buscar(id);
      if (c.estado !== ESTADOS_CONVOCATORIA.ABIERTA) throw new ErrorLogica("DATOS_INVALIDOS", "La carrera ya no admite cambios de inscripción");
      await repos.inscripciones.eliminarPor({ convocatoriaId: id, usuarioId });
    },

    // Quiénes se han apuntado: nombre, sin email (solo administradores).
    async apuntados(solicitanteId, id) {
      await usuarios.exigirAdministrador(solicitanteId);
      await buscar(id);
      return (await repos.inscripciones.listar({ convocatoriaId: id }))
        .map(({ usuarioId, nombre }) => ({ usuarioId, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    },

    // Vincula la carrera con la prueba importada del listado real (solo administradores). La carrera pasa a
    // «celebrada» y devuelve la asistencia. Se puede volver a vincular con otra prueba si se importó mal.
    async vincularListado(solicitanteId, id, pruebaId) {
      await usuarios.exigirAdministrador(solicitanteId);
      const c = await buscar(id);
      const prueba = typeof pruebaId === "string" ? await repos.pruebas.buscarPorId(pruebaId) : null;
      if (!prueba) throw new ErrorLogica("NO_ENCONTRADO", "La prueba no existe: importa antes el listado real");
      if (prueba.deporte !== c.deporte) throw new ErrorLogica("DATOS_INVALIDOS", `La prueba es de ${prueba.deporte} y la carrera de ${c.deporte}`);
      const actualizada = { ...c, estado: ESTADOS_CONVOCATORIA.CELEBRADA, pruebaId: prueba.id };
      await repos.convocatorias.actualizar(actualizada);
      log.info("Carrera vinculada al listado real", { id, pruebaId: prueba.id });
      return calcularAsistencia(actualizada);
    },

    // Asistencia de una carrera ya vinculada (solo administradores).
    async asistencia(solicitanteId, id) {
      await usuarios.exigirAdministrador(solicitanteId);
      const c = await buscar(id);
      if (!c.pruebaId) throw new ErrorLogica("DATOS_INVALIDOS", "Todavía no hay listado real vinculado a esta carrera");
      return calcularAsistencia(c);
    },
  };
}
