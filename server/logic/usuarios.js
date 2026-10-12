// Capa lógica: reglas de gestión de usuarios. No conoce Express ni la base de datos.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { ROL_ADMIN, ROL_USUARIO } from "./roles.js";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Quita del usuario lo que nunca debe salir hacia fuera.
function publico({ id, nombre, email, rol, estado }) {
  return { id, nombre, email, rol, estado };
}

const LONGITUD_MINIMA_PASSWORD = 8;

// cifrador: { cifrar(texto) -> hash, comparar(texto, hash) -> boolean } (bcrypt en producción).
// notificar(usuario, token): avisa al usuario para que confirme su email.
export function crearServicioUsuarios(repositorio, { cifrador, notificar = () => {} } = {}) {
  return {
    // Alta local: el usuario queda pendiente de confirmar el email.
    async alta({ nombre, email, password } = {}) {
      if (typeof nombre !== "string" || nombre.trim() === "") {
        throw new ErrorLogica("DATOS_INVALIDOS", "El nombre es obligatorio");
      }
      if (typeof email !== "string" || !EMAIL_VALIDO.test(email.trim())) {
        throw new ErrorLogica("DATOS_INVALIDOS", "El email no es válido");
      }
      if (typeof password !== "string" || password.length < LONGITUD_MINIMA_PASSWORD) {
        throw new ErrorLogica("DATOS_INVALIDOS", `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`);
      }
      const emailNormalizado = email.trim().toLowerCase();
      if (await repositorio.buscarPorEmail(emailNormalizado)) {
        throw new ErrorLogica("EMAIL_DUPLICADO", "Ya existe un usuario con ese email");
      }
      const tokenConfirmacion = randomUUID();
      const usuario = await repositorio.crear({
        id: randomUUID(),
        nombre: nombre.trim(),
        email: emailNormalizado,
        rol: ROL_USUARIO,
        estado: "pendiente",
        hash: await cifrador.cifrar(password), // nunca se guarda la contraseña en claro
        tokenConfirmacion,
      });
      await notificar(publico(usuario), tokenConfirmacion);
      return publico(usuario);
    },

    // Confirma el email con el token recibido: la cuenta pasa de pendiente a activa.
    async confirmar(token) {
      const usuario = token ? await repositorio.buscarPorToken(token) : null;
      if (!usuario || usuario.estado === "eliminado") {
        throw new ErrorLogica("NO_ENCONTRADO", "El enlace de confirmación no es válido");
      }
      const { tokenConfirmacion: _usado, ...resto } = usuario;
      await repositorio.actualizar({ ...resto, estado: "activo" });
    },

    // Inicio de sesión local. Devuelve el usuario si las credenciales son correctas y la cuenta está activa.
    async iniciarSesion({ email, password } = {}) {
      const usuario =
        typeof email === "string" && typeof password === "string"
          ? await repositorio.buscarPorEmail(email.trim().toLowerCase())
          : null;
      const correcta = usuario?.hash ? await cifrador.comparar(password, usuario.hash) : false;
      if (!usuario || usuario.estado === "eliminado" || !correcta) {
        throw new ErrorLogica("CREDENCIALES_INVALIDAS", "Email o contraseña incorrectos");
      }
      if (usuario.estado === "pendiente") {
        throw new ErrorLogica("CUENTA_PENDIENTE", "Confirma tu email antes de iniciar sesión");
      }
      return publico(usuario);
    },

    // Datos del usuario identificado (para "quién soy" en la sesión).
    async obtener(solicitanteId) {
      return publico(await identificar(repositorio, solicitanteId));
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
      if (solicitante.rol !== ROL_ADMIN && solicitante.id !== id) {
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
  if (solicitante.rol !== ROL_ADMIN) throw new ErrorLogica("PROHIBIDO", "Solo un administrador puede hacer esto");
}
