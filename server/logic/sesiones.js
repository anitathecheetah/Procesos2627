// Lógica de sesiones: crear, resolver y cerrar. No sabe nada de cookies ni de HTTP.
import { randomBytes } from "node:crypto";

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export function crearServicioSesiones(repositorio, { duracionMs = SIETE_DIAS_MS, ahora = () => Date.now() } = {}) {
  return {
    duracionMs,

    // Abre una sesión para el usuario y devuelve su identificador (aleatorio e impredecible).
    async iniciar(usuarioId) {
      const id = randomBytes(32).toString("base64url");
      await repositorio.crear({ id, usuarioId, expira: ahora() + duracionMs });
      return id;
    },

    // Devuelve el id del usuario de una sesión válida, o null si no existe, caducó o se cerró.
    async resolver(id) {
      const sesion = id ? await repositorio.buscar(id) : null;
      if (!sesion) return null;
      if (sesion.expira <= ahora()) {
        await repositorio.eliminar(id);
        return null;
      }
      return sesion.usuarioId;
    },

    // Cierra la sesión: el identificador deja de valer en el servidor.
    async cerrar(id) {
      if (id) await repositorio.eliminar(id);
    },
  };
}
