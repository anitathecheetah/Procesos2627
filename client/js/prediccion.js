// Conecta la vista de la predicción (vistaPrediccion.js) con el cliente de API (api.js).
import { listarPruebas, prediccion } from "./api.js";
import { mostrarOpcionesBase, actualizarControles, mostrarPrediccion, limpiarPrediccion, mostrarAvisoPrediccion } from "./vistaPrediccion.js";

const valor = (id) => document.getElementById(id).value;

async function cargarPruebas() {
  try {
    mostrarOpcionesBase(await listarPruebas(valor("prediccion-deporte")));
  } catch (error) {
    mostrarAvisoPrediccion(error.message || "No se pudieron cargar las pruebas.");
  }
}

document.getElementById("prediccion-deporte").addEventListener("change", () => { limpiarPrediccion(); mostrarAvisoPrediccion(""); cargarPruebas(); });
document.getElementById("prediccion-base").addEventListener("change", actualizarControles);

document.getElementById("form-prediccion").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const boton = evento.submitter;
  boton.disabled = true;
  try {
    mostrarAvisoPrediccion("Calculando la predicción…", true);
    const datos = await prediccion(valor("prediccion-deporte"), {
      base: valor("prediccion-base"),
      sexo: valor("prediccion-sexo"),
      retrospectiva: document.getElementById("prediccion-retro").checked,
    });
    mostrarPrediccion(datos);
    mostrarAvisoPrediccion("");
  } catch (error) {
    limpiarPrediccion();
    mostrarAvisoPrediccion(error.message || "No se pudo calcular la predicción.");
  } finally {
    boton.disabled = false;
  }
});

await cargarPruebas();
