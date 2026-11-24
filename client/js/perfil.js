// Formulario «Mi perfil y material» de la cuenta: datos privados de cada usuario (PBI-42).
import { perfilPropio, guardarPerfil } from "./api.js";
import { alEnviar, mostrarMensaje } from "./ui.js";
import { perfilDesdeFormulario, formularioDesdePerfil, textoEdad } from "./datosPerfil.js";

const formulario = document.getElementById("form-perfil");

export async function cargarPerfil(usuario) {
  if (!usuario) return formulario.reset();
  try {
    const perfil = await perfilPropio();
    for (const [campo, valor] of Object.entries(formularioDesdePerfil(perfil))) {
      if (formulario.elements[campo]) formulario.elements[campo].value = valor;
    }
    document.getElementById("edad-perfil").textContent = textoEdad(perfil.edad);
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo cargar tu perfil.", false, formulario);
  }
}

alEnviar(formulario, async (datos, form) => {
  try {
    const perfil = await guardarPerfil(perfilDesdeFormulario(datos));
    document.getElementById("edad-perfil").textContent = textoEdad(perfil.edad);
    mostrarMensaje("Perfil guardado. Solo tú puedes verlo.", true, form);
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo guardar el perfil.", false, form);
  }
});
