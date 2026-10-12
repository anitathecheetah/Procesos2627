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
  };
}

async function exigirAdmin(repositorio, solicitanteId) {
  const solicitante = solicitanteId ? await repositorio.buscarPorId(solicitanteId) : null;
  if (!solicitante) throw new ErrorLogica("NO_AUTENTICADO", "Debes identificarte");
  if (solicitante.rol !== "admin") throw new ErrorLogica("PROHIBIDO", "Solo un administrador puede hacer esto");
}
