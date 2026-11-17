// Conecta la vista del ranking (vistaRanking.js) con el cliente de API (api.js).
import { ranking, rankingClubes, recalcularRanking } from "./api.js";
import { mostrarRanking, mostrarAvisoRanking, mostrarBotonRecalcularEnPantalla } from "./vistaRanking.js";

let pagina = 1;
const deporte = () => document.getElementById("ranking-deporte").value;
const vista = () => document.getElementById("ranking-vista").value;

async function cargar() {
  try {
    mostrarAvisoRanking("");
    const sexo = document.getElementById("ranking-sexo").value;
    const datos = vista() === "clubes" ? await rankingClubes(deporte(), sexo, pagina) : await ranking(deporte(), sexo, pagina);
    mostrarRanking(datos, vista());
  } catch (error) {
    mostrarAvisoRanking(error.message || "No se pudo cargar el ranking.");
  }
}

for (const id of ["ranking-deporte", "ranking-vista", "ranking-sexo"]) document.getElementById(id).addEventListener("change", () => { pagina = 1; cargar(); });
document.getElementById("ranking-anterior").addEventListener("click", () => { pagina--; cargar(); });
document.getElementById("ranking-siguiente").addEventListener("click", () => { pagina++; cargar(); });

document.getElementById("ranking-recalcular").addEventListener("click", async (evento) => {
  const boton = evento.currentTarget;
  boton.disabled = true;
  try {
    const r = await recalcularRanking(deporte());
    pagina = 1;
    await cargar();
    mostrarAvisoRanking(`Ranking recalculado: ${r.pruebas} pruebas y ${r.atletas} atletas.`, true);
  } catch (error) {
    mostrarAvisoRanking(error.message || "No se pudo recalcular.");
  } finally {
    boton.disabled = false;
  }
});

export const mostrarBotonRecalcular = mostrarBotonRecalcularEnPantalla;
await cargar();
