// Conecta la vista de la predicción (vistaPrediccion.js) con el cliente de API (api.js).
import { listarPruebas, listarConvocatorias, prediccion } from "./api.js";
import { mostrarOpcionesBase, refrescarOpcionesPorSexo, actualizarControles, mostrarPrediccion, limpiarPrediccion, mostrarAvisoPrediccion } from "./vistaPrediccion.js";

const valor = (id) => document.getElementById(id).value;

async function cargarPruebas() {
  try {
    const deporte = valor("prediccion-deporte");
    const [pruebas, carreras] = await Promise.all([listarPruebas(deporte), listarConvocatorias()]);
    mostrarOpcionesBase(pruebas, carreras.filter((c) => c.deporte === deporte));
  } catch (error) {
    mostrarAvisoPrediccion(error.message || "No se pudieron cargar las pruebas.");
  }
}

document.getElementById("prediccion-deporte").addEventListener("change", () => { limpiarPrediccion(); mostrarAvisoPrediccion(""); cargarPruebas(); });
document.getElementById("prediccion-base").addEventListener("change", actualizarControles);
document.getElementById("prediccion-sexo").addEventListener("change", refrescarOpcionesPorSexo);
document.addEventListener("convocatorias-cambiadas", cargarPruebas);

document.getElementById("form-prediccion").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const boton = evento.submitter;
  boton.disabled = true;
  try {
    mostrarAvisoPrediccion("Calculando la predicción…", true);
    const lista = valor("prediccion-base");
    const datos = await prediccion(valor("prediccion-deporte"), {
      base: lista.startsWith("c:") ? "" : lista,
      convocatoria: lista.startsWith("c:") ? lista.slice(2) : "",
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
