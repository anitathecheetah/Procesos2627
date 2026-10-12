// Capa de presentación (interfaz GUI).
// Solo lee y pinta el DOM. No hace peticiones al servidor: eso lo hace api.js.

export function mostrarEstado(texto, correcto = true) {
  const elemento = document.getElementById("estado");
  elemento.textContent = texto;
  elemento.dataset.correcto = String(correcto);
}

// Mensaje bajo un formulario (o el aviso global si no se indica zona).
export function mostrarMensaje(texto, correcto, formulario) {
  const zona = formulario ? formulario.querySelector(".mensaje") : document.getElementById("aviso-global");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}

// Valores de un formulario como objeto { campo: valor }.
export function leerFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario));
}

// Ejecuta `alEnviar(datos)` al enviar el formulario, desactivando el botón mientras tanto.
export function alEnviar(formulario, alEnviar) {
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = formulario.querySelector("button");
    boton.disabled = true;
    try {
      await alEnviar(leerFormulario(formulario), formulario);
    } finally {
      boton.disabled = false;
    }
  });
}
