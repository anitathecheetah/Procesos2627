// Punto de entrada del frontend: conecta la interfaz (ui.js) con el cliente de API (api.js).
import { salud, registrar, iniciarSesion, sesionActual, cerrarSesion, listarUsuarios, eliminarUsuario } from "./api.js";
import {
  mostrarEstado, mostrarMensaje, alEnviar, mostrarSesion, alPulsarSalir,
  alPulsarEliminarCuenta, confirmar, mostrarAdministracion, mostrarAvisoAdmin,
} from "./ui.js";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Traduce un error del servidor a un texto claro para la persona.
function textoDeError(error) {
  if (error.codigo === "EMAIL_DUPLICADO") return "Ya existe una cuenta con ese email.";
  if (error.codigo === "CREDENCIALES_INVALIDAS") return "Email o contraseña incorrectos.";
  if (error.codigo === "CUENTA_PENDIENTE") return "Tu cuenta está pendiente: confirma tu email antes de entrar.";
  return error.message || "No se pudo completar la operación.";
}

let usuarioActual = null;

// Muestra la sesión y, si la persona es administradora, el panel de usuarios.
async function mostrarSesionCompleta(usuario) {
  usuarioActual = usuario;
  mostrarSesion(usuario);
  if (usuario?.rol === "admin") await cargarAdministracion();
  else mostrarAdministracion(null);
}

async function cargarAdministracion() {
  try {
    mostrarAdministracion(await listarUsuarios(), borrarDesdeAdmin);
    mostrarAvisoAdmin("", true);
  } catch (error) {
    mostrarAdministracion([], borrarDesdeAdmin);
    mostrarAvisoAdmin(textoDeError(error), false);
  }
}

async function borrarDesdeAdmin(usuario) {
  if (!confirmar(`¿Eliminar a ${usuario.email}?`)) return;
  try {
    await eliminarUsuario(usuario.id);
    await cargarAdministracion();
  } catch (error) {
    mostrarAvisoAdmin(textoDeError(error), false);
  }
}

alPulsarEliminarCuenta(async () => {
  if (!confirmar("¿Seguro que quieres eliminar tu cuenta? No podrás volver a entrar.")) return;
  try {
    await eliminarUsuario(usuarioActual.id);
    await mostrarSesionCompleta(null);
    mostrarMensaje("Tu cuenta ha sido eliminada.", true);
  } catch (error) {
    mostrarMensaje(textoDeError(error), false);
  }
});

alEnviar(document.getElementById("form-registro"), async (datos, formulario) => {
  if (!datos.nombre.trim()) return mostrarMensaje("Escribe tu nombre.", false, formulario);
  if (!EMAIL_VALIDO.test(datos.email)) return mostrarMensaje("El email no es válido.", false, formulario);
  if (datos.password.length < 8) return mostrarMensaje("La contraseña debe tener al menos 8 caracteres.", false, formulario);
  try {
    await registrar(datos);
    formulario.reset();
    mostrarMensaje("Cuenta creada. Confirma tu email con el enlace que te hemos enviado.", true, formulario);
  } catch (error) {
    mostrarMensaje(textoDeError(error), false, formulario);
  }
});

alEnviar(document.getElementById("form-login"), async (datos, formulario) => {
  if (!datos.email || !datos.password) return mostrarMensaje("Escribe tu email y tu contraseña.", false, formulario);
  try {
    const usuario = await iniciarSesion(datos);
    formulario.reset();
    mostrarMensaje("", true, formulario);
    mostrarMensaje("", true); // limpia avisos antiguos (p. ej. "Email confirmado")
    await mostrarSesionCompleta(usuario);
  } catch (error) {
    mostrarMensaje(textoDeError(error), false, formulario);
  }
});

alPulsarSalir(async () => {
  try {
    await cerrarSesion();
    await mostrarSesionCompleta(null);
    mostrarMensaje("Has cerrado la sesión.", true);
  } catch (error) {
    mostrarMensaje(textoDeError(error), false);
  }
});

// Al cargar la página se comprueba si ya hay una sesión (la cookie persiste al recargar).
try {
  await mostrarSesionCompleta(await sesionActual());
} catch {
  await mostrarSesionCompleta(null);
}

if (new URLSearchParams(location.search).has("confirmado")) {
  mostrarMensaje("Email confirmado. Ya puedes iniciar sesión.", true);
}

try {
  const respuesta = await salud();
  mostrarEstado(`Servidor: ${respuesta.estado}`);
} catch (error) {
  mostrarEstado(`No se pudo contactar con el servidor: ${error.message}`, false);
}
