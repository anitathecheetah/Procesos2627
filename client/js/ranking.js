// Conecta la vista del ranking (vistaRanking.js) con el cliente de API (api.js).
import { ranking, recalcularRanking } from "./api.js";
import { mostrarRanking, mostrarAvisoRanking, mostrarBotonRecalcularEnPantalla } from "./vistaRanking.js";

let pagina = 1;
const deporte = () => document.getElementById("ranking-deporte").value;

async function cargar() {
  try {
    mostrarAvisoRanking("");
    mostrarRanking(await ranking(deporte(), document.getElementById("ranking-sexo").value, pagina));
  } catch (error) {
    mostrarAvisoRanking(error.message || "No se pudo cargar el ranking.");
  }
}

for (const id of ["ranking-deporte", "ranking-sexo"]) document.getElementById(id).addEventListener("change", () => { pagina = 1; cargar(); });
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
