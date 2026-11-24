// Directores de club (PBI-55): un usuario pide ser director de un club, el administrador lo aprueba y entonces ve
// estadísticas de los atletas de ese club. Solo se usan datos públicos de los resultados, nunca el perfil privado.
// Documentado en docs/directores-club.md.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { DEPORTES } from "./catalogos.js";
import { claveClub } from "./normalizacion.js";
import { PREFIJO_CATALOGO, cargarCatalogoClubes } from "./catalogoClubes.js";

export const ESTADOS_SOLICITUD = Object.freeze({ PENDIENTE: "pendiente", APROBADA: "aprobada", RECHAZADA: "rechazada" });
const nombreValido = (n) => {
  const t = typeof n === "string" ? n.trim().replace(/\s+/g, " ") : "";
  if (t.length < 3 || t.length > 80) throw new ErrorLogica("DATOS_INVALIDOS", "El nombre del club debe tener entre 3 y 80 caracteres");
  return t;
};

export function crearServicioDirectores({ repos, usuarios, dominio, catalogo = cargarCatalogoClubes(), log = { info() {} } }) {
  const vigente = async (usuarioId) =>
    (await repos.solicitudesClub.listar({ usuarioId })).find((s) => s.estado !== ESTADOS_SOLICITUD.RECHAZADA) ?? null;

  return {
    // Lista de clubes para elegir: los que ya existen en la app y los del catálogo de la FETRI que aún no están
    // (con id «fetri:…»), por orden alfabético. Un club del catálogo ya existente sale una sola vez.
    async clubes() {
      const existentes = await repos.clubes.listar();
      const claves = new Set(existentes.map((c) => claveClub(c.nombre)));
      const nuevos = catalogo.filter((c) => !claves.has(c.clave));
      return [...existentes.map(({ id, nombre }) => ({ id, nombre })), ...nuevos.map(({ id, nombre, comunidad }) => ({ id, nombre, ...(comunidad ? { comunidad } : {}) }))]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    },

    // Pide ser director: o bien `clubId` (de la lista) o bien `nombreClub` (si no aparece). Una a la vez por persona.
    async solicitar(usuarioId, { clubId, nombreClub } = {}) {
      if (!usuarioId) throw new ErrorLogica("NO_AUTENTICADO", "Inicia sesión");
      if ((clubId ? 1 : 0) + (nombreClub ? 1 : 0) !== 1) throw new ErrorLogica("DATOS_INVALIDOS", "Elige un club de la lista o escribe el nombre del tuyo");
      if (await vigente(usuarioId)) throw new ErrorLogica("DATOS_INVALIDOS", "Ya tienes una solicitud de director pendiente o aprobada");
      let club = null;
      let delCatalogo = null;
      if (clubId?.startsWith(PREFIJO_CATALOGO)) {
        delCatalogo = catalogo.find((c) => c.id === clubId);
        if (!delCatalogo) throw new ErrorLogica("NO_ENCONTRADO", "El club no existe");
        club = (await repos.clubes.listar()).find((c) => claveClub(c.nombre) === delCatalogo.clave) ?? null; // ya creado por una importación
      } else if (clubId) {
        club = await repos.clubes.buscarPorId(clubId);
        if (!club) throw new ErrorLogica("NO_ENCONTRADO", "El club no existe");
      }
      // Un club del catálogo no es «nuevo»: es oficial, se crea al aprobar si aún no existe en la app.
      const solicitud = {
        id: randomUUID(), usuarioId, estado: ESTADOS_SOLICITUD.PENDIENTE, creada: new Date().toISOString(),
        clubId: club?.id ?? null, nombreClub: club?.nombre ?? delCatalogo?.nombre ?? nombreValido(nombreClub), clubNuevo: !club && !delCatalogo,
      };
      await repos.solicitudesClub.crear(solicitud);
      log.info("Solicitud de director", { id: solicitud.id });
      return solicitud;
    },

    // Estado de mi solicitud (la última), o null.
    async miSolicitud(usuarioId) {
      const todas = await repos.solicitudesClub.listar({ usuarioId });
      return todas.sort((a, b) => b.creada.localeCompare(a.creada))[0] ?? null;
    },

    // Solo administrador: solicitudes pendientes con el nombre y el email de quien las pide.
    async pendientes(adminId) {
      await usuarios.exigirAdministrador(adminId);
      const lista = (await repos.solicitudesClub.listar({ estado: ESTADOS_SOLICITUD.PENDIENTE })).sort((a, b) => a.creada.localeCompare(b.creada));
      return Promise.all(lista.map(async (s) => ({ ...s, solicitante: await usuarios.datosPublicos(s.usuarioId) })));
    },

    // Solo administrador. aprobar=false rechaza. Al aprobar un club nuevo se crea (o se reutiliza si ya existe con ese
    // nombre); `clubId` une la solicitud a un club existente y `nombreClub` corrige el nombre de uno nuevo.
    async resolver(adminId, id, { aprobar, clubId, nombreClub } = {}) {
      await usuarios.exigirAdministrador(adminId);
      const s = await repos.solicitudesClub.buscarPorId(id);
      if (!s) throw new ErrorLogica("NO_ENCONTRADO", "La solicitud no existe");
      if (s.estado !== ESTADOS_SOLICITUD.PENDIENTE) throw new ErrorLogica("DATOS_INVALIDOS", "La solicitud ya está resuelta");
      if (aprobar !== true) {
        return repos.solicitudesClub.actualizar({ ...s, estado: ESTADOS_SOLICITUD.RECHAZADA, resueltaPor: adminId });
      }
      let club;
      if (clubId) {
        club = await repos.clubes.buscarPorId(clubId);
        if (!club) throw new ErrorLogica("NO_ENCONTRADO", "El club no existe");
      } else if (s.clubId) {
        club = await repos.clubes.buscarPorId(s.clubId);
      } else {
        club = await dominio.obtenerOCrearClub(nombreClub ? nombreValido(nombreClub) : s.nombreClub);
      }
      return repos.solicitudesClub.actualizar({ ...s, estado: ESTADOS_SOLICITUD.APROBADA, clubId: club.id, nombreClub: club.nombre, resueltaPor: adminId });
    },

    // Panel del club del director aprobado. Cualquier otra persona recibe 403.
    async panel(usuarioId) {
      const s = (await repos.solicitudesClub.listar({ usuarioId })).find((x) => x.estado === ESTADOS_SOLICITUD.APROBADA);
      if (!s) throw new ErrorLogica("PROHIBIDO", "No eres director de ningún club");
      const club = await repos.clubes.buscarPorId(s.clubId);
      if (!club) throw new ErrorLogica("NO_ENCONTRADO", "El club ya no existe");
      const resultados = await repos.resultados.listar({ clubId: club.id });
      const nombres = new Map();
      const nombreDe = async (atletaId) => {
        if (!nombres.has(atletaId)) nombres.set(atletaId, (await repos.atletas.buscarPorId(atletaId))?.nombre ?? "—");
        return nombres.get(atletaId);
      };
      const deportes = [];
      for (const deporte of DEPORTES) {
        const ratings = (await repos.ratings.listar({ deporte, clubId: club.id })).sort((a, b) => b.rating - a.rating);
        if (!ratings.length) continue;
        const top = await Promise.all(ratings.slice(0, 10).map(async (r) => ({ atletaId: r.atletaId, nombre: await nombreDe(r.atletaId), rating: Math.round(r.rating), pruebas: r.pruebas })));
        deportes.push({ deporte, atletas: ratings.length, mediaElo: Math.round(ratings.reduce((t, r) => t + r.rating, 0) / ratings.length), top });
      }
      const pruebas = new Set(resultados.map((r) => r.pruebaId));
      const atletas = new Set(resultados.map((r) => r.atletaId));
      return {
        club: { id: club.id, nombre: club.nombre },
        atletas: atletas.size,
        pruebas: pruebas.size,
        resultados: resultados.length,
        finalizados: resultados.filter((r) => r.estado === "finalizado").length,
        deportes,
        vacio: resultados.length === 0,
        aviso: resultados.length ? null : "Todavía no hay resultados con el nombre de este club. Aparecerán cuando se importen pruebas en las que figure con ese nombre.",
      };
    },
  };
}
