// Conecta la vista de resultados (vistaResultados.js) con el cliente de API (api.js).
import { listarPruebas, detallePrueba, buscarAtletas, fichaAtleta } from "./api.js";
import {
  mostrarPruebas, mostrarAtletas, mostrarDetallePrueba, mostrarFichaAtleta, volverALaLista, mostrarAvisoResultados,
} from "./vistaResultados.js";

// Ejecuta una consulta y, si falla, lo dice en pantalla.
async function intentar(accion) {
  try {
    mostrarAvisoResultados("");
    await accion();
  } catch (error) {
    mostrarAvisoResultados(error.message || "No se pudo cargar la información.");
  }
}

const abrirPrueba = (p) => intentar(async () => {
  mostrarDetallePrueba(await detallePrueba(p.id), { alElegirAtleta: abrirAtleta, alVolver: volverALaLista });
});
const abrirAtleta = (a) => intentar(async () => {
  mostrarFichaAtleta(await fichaAtleta(a.id), { alElegirPrueba: abrirPrueba, alVolver: volverALaLista });
});
const cargarPruebas = () => intentar(async () => {
  mostrarPruebas(await listarPruebas(document.getElementById("filtro-deporte").value), abrirPrueba);
});

document.getElementById("filtro-deporte").addEventListener("change", cargarPruebas);

document.getElementById("form-buscar").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const q = new FormData(evento.target).get("q").trim();
  intentar(async () => {
    if (q.length < 2) {
      mostrarAtletas(null);
      return mostrarAvisoResultados("Escribe al menos 2 letras para buscar.");
    }
    mostrarAtletas(await buscarAtletas(q), abrirAtleta);
  });
});

await cargarPruebas();
