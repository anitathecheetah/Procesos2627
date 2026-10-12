// Capa de presentación (interfaz GUI).
// Solo pinta en el DOM. No hace peticiones al servidor: eso lo hace api.js.

export function mostrarEstado(texto, correcto = true) {
  const elemento = document.getElementById("estado");
  elemento.textContent = texto;
  elemento.dataset.correcto = String(correcto);
}
