// Capa lógica: reglas de gestión de usuarios. No conoce Express ni la base de datos.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Quita del usuario lo que nunca debe salir hacia fuera.
function publico({ id, nombre, email, rol, estado }) {
  return { id, nombre, email, rol, estado };
}

export function crearServicioUsuarios(repositorio) {
  return {
    // Alta local: el usuario queda pendiente de confirmar el email.
    async alta({ nombre, email } = {}) {
      if (typeof nombre !== "string" || nombre.trim() === "") {
        throw new ErrorLogica("DATOS_INVALIDOS", "El nombre es obligatorio");
      }
      if (typeof email !== "string" || !EMAIL_VALIDO.test(email.trim())) {
        throw new ErrorLogica("DATOS_INVALIDOS", "El email no es válido");
      }
      const emailNormalizado = email.trim().toLowerCase();
      if (await repositorio.buscarPorEmail(emailNormalizado)) {
        throw new ErrorLogica("EMAIL_DUPLICADO", "Ya existe un usuario con ese email");
      }
      const usuario = await repositorio.crear({
        id: randomUUID(),
        nombre: nombre.trim(),
        email: emailNormalizado,
        rol: "user",
        estado: "pendiente",
      });
      return publico(usuario);
    },

    // Listado: solo administradores.
    async listar(solicitanteId) {
      await exigirAdmin(repositorio, solicitanteId);
      return (await repositorio.listar()).map(publico);
    },

    // Consultar si un usuario está activo (confirmado y no eliminado): solo administradores.
    async usuarioActivo(solicitanteId, id) {
      await exigirAdmin(repositorio, solicitanteId);
      const usuario = await repositorio.buscarPorId(id);
      if (!usuario) throw new ErrorLogica("NO_ENCONTRADO", "El usuario no existe");
      return { id: usuario.id, activo: usuario.estado === "activo" };
    },

    // Eliminación lógica: la puede hacer un administrador o el propio usuario.
    async eliminar(solicitanteId, id) {
      const solicitante = await identificar(repositorio, solicitanteId);
      if (solicitante.rol !== "admin" && solicitante.id !== id) {
        throw new ErrorLogica("PROHIBIDO", "Solo puedes eliminar tu propio usuario");
      }
      const usuario = await repositorio.buscarPorId(id);
      if (!usuario) throw new ErrorLogica("NO_ENCONTRADO", "El usuario no existe");
      await repositorio.actualizar({ ...usuario, estado: "eliminado" });
    },
  };
}

// Un solicitante eliminado deja de estar identificado.
async function identificar(repositorio, solicitanteId) {
  const solicitante = solicitanteId ? await repositorio.buscarPorId(solicitanteId) : null;
  if (!solicitante || solicitante.estado === "eliminado") {
    throw new ErrorLogica("NO_AUTENTICADO", "Debes identificarte");
  }
  return solicitante;
}

async function exigirAdmin(repositorio, solicitanteId) {
  const solicitante = await identificar(repositorio, solicitanteId);
  if (solicitante.rol !== "admin") throw new ErrorLogica("PROHIBIDO", "Solo un administrador puede hacer esto");
}
