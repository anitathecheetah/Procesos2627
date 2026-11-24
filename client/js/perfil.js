// Formulario «Mi perfil y material» de la cuenta: datos privados de cada usuario (PBI-54).
import { perfilPropio, guardarPerfil, clubesParaElegir } from "./api.js";
import { alEnviar, mostrarMensaje } from "./ui.js";
import { perfilDesdeFormulario, formularioDesdePerfil, textoEdad, textoEstadoClub } from "./datosPerfil.js";
import { el } from "./dom.js";

const formulario = document.getElementById("form-perfil");

export async function cargarPerfil(usuario) {
  if (!usuario) return formulario.reset();
  try {
    const [perfil, clubes] = await Promise.all([perfilPropio(), clubesParaElegir()]);
    document.getElementById("lista-clubes").replaceChildren(...clubes.map((c) => el("option", undefined, { value: c.nombre, label: c.comunidad ? `${c.nombre} (${c.comunidad})` : c.nombre })));
    document.getElementById("estado-club").textContent = textoEstadoClub(perfil);
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
    document.getElementById("estado-club").textContent = textoEstadoClub(perfil);
    if (perfil.club) formulario.elements.club.value = perfil.club;
    mostrarMensaje("Perfil guardado. Solo tú puedes verlo.", true, form);
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo guardar el perfil.", false, form);
  }
});
