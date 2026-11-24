// Próximas carreras (convocatorias), inscripciones de usuarios y lista de salida oficial (PBI-37 y PBI-38).
// El administrador crea la carrera; cada usuario con sesión puede apuntarse (indicando su nombre y sus dos apellidos) o desapuntarse mientras esté
// abierta. Antes de la carrera la federación publica la lista de salida; el administrador la sube (Excel), la
// carrera pasa a «cerrada» y se compara quién de los apuntados está de verdad en la lista. La predicción usa esa lista.
// Documentada en docs/convocatorias.md.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { DEPORTES } from "./catalogos.js";
import { leerListaSalida } from "./excelSalida.js";
import { esPosibleMenor } from "./importacion.js";
import { normalizarNombre } from "./normalizacion.js";
import { diasHasta } from "./preparacion.js";

// Neopreno según el reglamento de cada prueba (depende de la temperatura del agua y del aire y lo decide la
// organización): lo fija el administrador al crear la carrera. «por confirmar» mientras no se sepa.
export const REGLAS_NEOPRENO = Object.freeze(["obligatorio", "opcional", "prohibido", "por confirmar"]);

// Drafting (ir a rueda en el segmento de bici). Si está permitido, la bici debe ser de ruta: la de contrarreloj
// (con acoples) solo vale en pruebas sin drafting. Lo fija el administrador según el reglamento de la prueba.
export const REGLAS_DRAFTING = Object.freeze(["permitido", "prohibido", "por confirmar"]);

export const ESTADOS_CONVOCATORIA = Object.freeze({ ABIERTA: "abierta", CERRADA: "cerrada" }); // cerrada = con lista de salida oficial
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function texto(valor, campo, { min = 0, max }) {
  const t = typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
  if (t.length < min || t.length > max) {
    throw new ErrorLogica("DATOS_INVALIDOS", min ? `${campo} debe tener entre ${min} y ${max} caracteres` : `${campo} no puede tener más de ${max} caracteres`);
  }
  return t;
}
function reglaNeopreno(valor, deporte) {
  if (deporte !== "triatlon") return null; // en duatlón no hay natación
  const regla = valor || "por confirmar";
  if (!REGLAS_NEOPRENO.includes(regla)) throw new ErrorLogica("DATOS_INVALIDOS", `El neopreno debe ser uno de: ${REGLAS_NEOPRENO.join(", ")}`);
  return regla;
}
function reglaDrafting(valor) {
  const regla = valor || "por confirmar";
  if (!REGLAS_DRAFTING.includes(regla)) throw new ErrorLogica("DATOS_INVALIDOS", `El drafting debe ser uno de: ${REGLAS_DRAFTING.join(", ")}`);
  return regla;
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

export function crearServicioConvocatorias({ repos, usuarios, dominio, log = { info() {} } }) {
  async function buscar(id) {
    const c = await repos.convocatorias.buscarPorId(id);
    if (!c) throw new ErrorLogica("NO_ENCONTRADO", "La carrera no existe");
    return c;
  }

  // La lista de salida de una carrera con los datos del atleta y su club.
  async function participantesDe(convocatoriaId) {
    const filas = await repos.salida.listar({ convocatoriaId });
    return Promise.all(filas.map(async (p) => ({
      atleta: await repos.atletas.buscarPorId(p.atletaId),
      club: p.clubId ? await repos.clubes.buscarPorId(p.clubId) : null,
      dorsal: p.dorsal ?? null,
    })));
  }

  // Compara los apuntados con la lista de salida oficial.
  async function calcularAsistencia(convocatoria) {
    const participantes = await participantesDe(convocatoria.id);
    const usados = new Set();
    const apuntados = (await repos.inscripciones.listar({ convocatoriaId: convocatoria.id }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((i) => {
        const coincidencia = participantes.find((p) => !usados.has(p.atleta.id) && coincidenNombres(i.nombre, p.atleta.nombre));
        if (coincidencia) usados.add(coincidencia.atleta.id);
        return {
          usuarioId: i.usuarioId, nombre: i.nombre, enLista: Boolean(coincidencia),
          ...(coincidencia ? { atleta: { id: coincidencia.atleta.id, nombre: coincidencia.atleta.nombre }, dorsal: coincidencia.dorsal } : {}),
        };
      });
    return {
      convocatoria: { id: convocatoria.id, nombre: convocatoria.nombre, fecha: convocatoria.fecha },
      participantes: participantes.length,
      enLista: apuntados.filter((a) => a.enLista).length,
      noEnLista: apuntados.filter((a) => !a.enLista).length,
      sinApuntarse: participantes.length - usados.size,
      apuntados,
    };
  }

  return {
    // Crea una carrera futura (solo administradores).
    async crear(solicitanteId, { nombre, deporte, fecha, lugar, neopreno, drafting, cross } = {}) {
      await usuarios.exigirAdministrador(solicitanteId);
      if (!DEPORTES.includes(deporte)) throw new ErrorLogica("DATOS_INVALIDOS", `El deporte debe ser uno de: ${DEPORTES.join(", ")}`);
      const c = {
        id: randomUUID(),
        nombre: texto(nombre, "El nombre", { min: 3, max: 100 }),
        deporte,
        fecha: fechaValida(fecha),
        lugar: texto(lugar ?? "", "El lugar", { max: 100 }),
        neopreno: reglaNeopreno(neopreno, deporte),
        drafting: reglaDrafting(drafting),
        cross: [true, "true", "on"].includes(cross), // modalidad cross: se corre con bici de montaña (MTB)
        estado: ESTADOS_CONVOCATORIA.ABIERTA,
        creadaPor: solicitanteId,
      };
      await repos.convocatorias.crear(c);
      log.info("Carrera creada", { id: c.id, fecha: c.fecha });
      return { ...c, apuntados: 0 };
    },

    // Público. Las abiertas primero (la más próxima arriba), luego las cerradas (la más próxima arriba también).
    // Con usuarioId añade `apuntado` (si esa persona está apuntada). Solo cuenta apuntados, no los nombra.
    async listar({ usuarioId } = {}) {
      const todas = await repos.convocatorias.listar();
      const filas = await Promise.all(todas.map(async ({ creadaPor: _c, ...c }) => {
        const inscritos = await repos.inscripciones.listar({ convocatoriaId: c.id });
        const enLista = (await repos.salida.listar({ convocatoriaId: c.id })).length;
        return { ...c, diasRestantes: diasHasta(c.fecha), apuntados: inscritos.length, participantes: enLista, ...(usuarioId ? { apuntado: inscritos.some((i) => i.usuarioId === usuarioId) } : {}) };
      }));
      const abiertas = (c) => c.estado === ESTADOS_CONVOCATORIA.ABIERTA;
      return filas.sort((a, b) => (abiertas(b) - abiertas(a)) || a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, "es"));
    },

    // Borra la carrera y sus inscripciones (solo administradores).
    async eliminar(solicitanteId, id) {
      await usuarios.exigirAdministrador(solicitanteId);
      await buscar(id);
      await repos.inscripciones.eliminarPor({ convocatoriaId: id });
      await repos.salida.eliminarPor({ convocatoriaId: id });
      await repos.convocatorias.eliminar(id);
      log.info("Carrera eliminada", { id });
    },

    // El usuario de la sesión se apunta con su nombre y sus dos apellidos (así se le reconoce después en la lista
    // de salida oficial). Si ya estaba apuntado, se actualiza el nombre y no se duplica.
    async apuntarse(usuarioId, id, nombreCompleto) {
      if (!usuarioId) throw new ErrorLogica("NO_AUTENTICADO", "Inicia sesión para apuntarte");
      await usuarios.obtener(usuarioId);
      const c = await buscar(id);
      const nombre = texto(nombreCompleto, "El nombre", { min: 1, max: 100 });
      if (palabras(nombre).length < 3) throw new ErrorLogica("DATOS_INVALIDOS", "Indica tu nombre y tus dos apellidos para apuntarte");
      if (c.estado !== ESTADOS_CONVOCATORIA.ABIERTA) throw new ErrorLogica("DATOS_INVALIDOS", "La carrera ya tiene lista de salida oficial y no admite inscripciones");
      const previa = await repos.inscripciones.buscarUno({ convocatoriaId: id, usuarioId });
      if (!previa) await repos.inscripciones.crear({ id: randomUUID(), convocatoriaId: id, usuarioId, nombre });
      else if (previa.nombre !== nombre) await repos.inscripciones.actualizar({ ...previa, nombre });
    },

    // El usuario de la sesión deja de ir. Si no estaba apuntado, no pasa nada.
    async desapuntarse(usuarioId, id) {
      if (!usuarioId) throw new ErrorLogica("NO_AUTENTICADO", "Inicia sesión para desapuntarte");
      const c = await buscar(id);
      if (c.estado !== ESTADOS_CONVOCATORIA.ABIERTA) throw new ErrorLogica("DATOS_INVALIDOS", "La carrera ya tiene lista de salida oficial y no admite cambios de inscripción");
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

    // Sube la lista de salida oficial (Excel de la federación; solo administradores). Sustituye a la anterior si la
    // había. La carrera pasa a «cerrada». Como al importar resultados, por defecto no entran posibles menores de
    // edad (se descartan antes de guardar nada). `sexo` (M o F) se aplica a todos los atletas nuevos del archivo.
    async cargarListaSalida(solicitanteId, id, buffer, { sexo, soloMayores = true } = {}) {
      await usuarios.exigirAdministrador(solicitanteId);
      const c = await buscar(id);
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new ErrorLogica("DATOS_INVALIDOS", "Falta el archivo Excel");
      if (sexo && !["M", "F"].includes(sexo)) throw new ErrorLogica("DATOS_INVALIDOS", "El sexo debe ser M o F");
      const { participantes, descartadas } = await leerListaSalida(buffer);
      const permitidos = soloMayores === false ? participantes : participantes.filter((p) => !esPosibleMenor(p.anioNacimiento, c.fecha));
      const menoresExcluidos = participantes.length - permitidos.length;
      if (!permitidos.length) throw new ErrorLogica("DATOS_INVALIDOS", "El Excel no contiene participantes válidos (o solo posibles menores de edad)");

      const vistos = new Set();
      const nuevos = [];
      for (const p of permitidos) {
        const atleta = await dominio.obtenerOCrearAtleta({ nombre: p.nombre, anioNacimiento: p.anioNacimiento, sexo: sexo || undefined });
        if (vistos.has(atleta.id)) { descartadas.push({ fila: null, motivo: `atleta repetido en el archivo: ${p.nombre}` }); continue; }
        vistos.add(atleta.id);
        const club = p.club ? await dominio.obtenerOCrearClub(p.club) : null;
        nuevos.push({ id: randomUUID(), convocatoriaId: id, atletaId: atleta.id, ...(club ? { clubId: club.id } : {}), ...(p.dorsal ? { dorsal: p.dorsal } : {}) });
      }
      await repos.salida.eliminarPor({ convocatoriaId: id });
      await repos.salida.crearVarios(nuevos);
      await repos.convocatorias.actualizar({ ...c, estado: ESTADOS_CONVOCATORIA.CERRADA });
      log.info("Lista de salida cargada", { id, participantes: nuevos.length, menoresExcluidos });
      return { participantes: nuevos.length, menoresExcluidos, descartadas, asistencia: await calcularAsistencia(c) };
    },

    // Lista de salida oficial (pública, como la publica la federación): atleta, club y dorsal.
    async listaSalida(id) {
      await buscar(id);
      return (await participantesDe(id))
        .map(({ atleta, club, dorsal }) => ({ atleta: { id: atleta.id, nombre: atleta.nombre }, club: club ? { id: club.id, nombre: club.nombre } : null, dorsal }))
        .sort((a, b) => a.atleta.nombre.localeCompare(b.atleta.nombre, "es"));
    },

    // Quién de los apuntados está en la lista de salida oficial (solo administradores).
    async asistencia(solicitanteId, id) {
      await usuarios.exigirAdministrador(solicitanteId);
      const c = await buscar(id);
      if (c.estado !== ESTADOS_CONVOCATORIA.CERRADA) throw new ErrorLogica("DATOS_INVALIDOS", "Todavía no has subido la lista de salida de esta carrera");
      return calcularAsistencia(c);
    },
  };
}
