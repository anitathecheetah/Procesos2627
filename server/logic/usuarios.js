// Capa lógica: reglas de gestión de usuarios. No conoce Express ni la base de datos.
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { ROL_ADMIN, ROL_USUARIO } from "./roles.js";
import { loggerSilencioso } from "../logger.js";
import { validarPassword } from "./politicaPassword.js";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Quita del usuario lo que nunca debe salir hacia fuera.
function publico({ id, nombre, email, rol, estado }) {
  return { id, nombre, email, rol, estado };
}

const LONGITUD_MINIMA_PASSWORD = 8;

// Textos de la política (politicaPassword.js) para el cambio de contraseña.
const MENSAJE_POLITICA = {
  LONGITUD: "mínimo 10 caracteres",
  DIGITO: "al menos un número",
  MAYUSCULA: "al menos una mayúscula",
};

// cifrador: { cifrar(texto) -> hash, comparar(texto, hash) -> boolean } (bcrypt en producción).
// notificar(usuario, token): avisa al usuario para que confirme su email.
// emailAdmin: el email que debe tener rol de administrador (variable ADMIN_EMAIL).
export function crearServicioUsuarios(repositorio, { cifrador, notificar = () => {}, emailAdmin, log = loggerSilencioso } = {}) {
  const emailAdminNormalizado = emailAdmin?.trim().toLowerCase() || null;

  return {
    // Arranque: si ya existe el usuario con ADMIN_EMAIL lo hace administrador. Es idempotente:
    // ejecutarlo varias veces deja el mismo resultado. Si aún no existe, será administrador
    // cuando se registre y confirme su email (así no hay cuentas con contraseña por defecto).
    async asegurarAdministrador() {
      if (!emailAdminNormalizado) return false;
      const usuario = await repositorio.buscarPorEmail(emailAdminNormalizado);
      if (!usuario || usuario.estado === "eliminado") return false;
      if (usuario.rol !== ROL_ADMIN) {
        await repositorio.actualizar({ ...usuario, rol: ROL_ADMIN });
        log.info("Usuario promocionado a administrador", { id: usuario.id });
      }
      return true;
    },

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
        rol: emailNormalizado === emailAdminNormalizado ? ROL_ADMIN : ROL_USUARIO,
        estado: "pendiente",
        hash: await cifrador.cifrar(password), // nunca se guarda la contraseña en claro
        tokenConfirmacion,
      });
      await notificar(publico(usuario), tokenConfirmacion);
      log.info("Usuario registrado", { id: usuario.id, email: usuario.email, rol: usuario.rol });
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
      log.info("Email confirmado", { id: usuario.id });
    },

    // Inicio de sesión local. Devuelve el usuario si las credenciales son correctas y la cuenta está activa.
    async iniciarSesion({ email, password } = {}) {
      const usuario =
        typeof email === "string" && typeof password === "string"
          ? await repositorio.buscarPorEmail(email.trim().toLowerCase())
          : null;
      const correcta = usuario?.hash ? await cifrador.comparar(password, usuario.hash) : false;
      if (!usuario || usuario.estado === "eliminado" || !correcta) {
        log.warn("Inicio de sesión fallido", { email: typeof email === "string" ? email : null });
        throw new ErrorLogica("CREDENCIALES_INVALIDAS", "Email o contraseña incorrectos");
      }
      if (usuario.estado === "pendiente") {
        throw new ErrorLogica("CUENTA_PENDIENTE", "Confirma tu email antes de iniciar sesión");
      }
      log.info("Inicio de sesión", { id: usuario.id });
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

    // Para otros servicios (el solicitante ya está verificado como administrador): nombre y email de un usuario.
    async datosPublicos(id) {
      const u = await repositorio.buscarPorId(id);
      return u ? { nombre: u.nombre, email: u.email } : null;
    },

    // Para otros servicios: corta con 401/403 si el solicitante no es un administrador identificado.
    async exigirAdministrador(solicitanteId) {
      await exigirAdmin(repositorio, solicitanteId);
    },

    // Cambio de contraseña del propio usuario: exige la actual y que la nueva cumpla la política.
    async cambiarPassword(solicitanteId, { actual, nueva } = {}) {
      const usuario = await identificar(repositorio, solicitanteId);
      if (typeof actual !== "string" || typeof nueva !== "string" || actual === "" || nueva === "") {
        throw new ErrorLogica("DATOS_INVALIDOS", "Escribe la contraseña actual y la nueva");
      }
      if (!usuario.hash || !(await cifrador.comparar(actual, usuario.hash))) {
        log.warn("Cambio de contraseña rechazado: la actual no coincide", { id: usuario.id });
        throw new ErrorLogica("DATOS_INVALIDOS", "La contraseña actual no es correcta");
      }
      const { errores } = validarPassword(nueva);
      if (errores.length) {
        const faltas = errores.map((e) => MENSAJE_POLITICA[e]).join(", ");
        throw new ErrorLogica("DATOS_INVALIDOS", `La contraseña nueva no cumple la política: ${faltas}`);
      }
      if (nueva === actual) {
        throw new ErrorLogica("DATOS_INVALIDOS", "La contraseña nueva debe ser distinta de la actual");
      }
      await repositorio.actualizar({ ...usuario, hash: await cifrador.cifrar(nueva) });
      log.info("Contraseña cambiada", { id: usuario.id });
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
      log.info("Usuario eliminado", { id, por: solicitante.id });
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
