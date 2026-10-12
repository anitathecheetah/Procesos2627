// Punto de entrada del frontend: conecta la interfaz (ui.js) con el cliente de API (api.js).
import { salud, registrar, iniciarSesion } from "./api.js";
import { mostrarEstado, mostrarMensaje, alEnviar } from "./ui.js";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Traduce un error del servidor a un texto claro para la persona.
function textoDeError(error) {
  if (error.codigo === "EMAIL_DUPLICADO") return "Ya existe una cuenta con ese email.";
  if (error.codigo === "CREDENCIALES_INVALIDAS") return "Email o contraseña incorrectos.";
  if (error.codigo === "CUENTA_PENDIENTE") return "Tu cuenta está pendiente: confirma tu email antes de entrar.";
  return error.message || "No se pudo completar la operación.";
}

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
    mostrarMensaje(`Sesión iniciada. Hola, ${usuario.nombre}.`, true, formulario);
  } catch (error) {
    mostrarMensaje(textoDeError(error), false, formulario);
  }
});

if (new URLSearchParams(location.search).has("confirmado")) {
  mostrarMensaje("Email confirmado. Ya puedes iniciar sesión.", true);
}

try {
  const respuesta = await salud();
  mostrarEstado(`Servidor: ${respuesta.estado}`);
} catch (error) {
  mostrarEstado(`No se pudo contactar con el servidor: ${error.message}`, false);
}
