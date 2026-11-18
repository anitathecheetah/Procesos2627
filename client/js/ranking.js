// Conecta la vista del ranking (vistaRanking.js) con el cliente de API (api.js).
import { ranking, rankingClubes, recalcularRanking, comunidades } from "./api.js";
import { mostrarRanking, mostrarAvisoRanking, mostrarBotonRecalcularEnPantalla } from "./vistaRanking.js";

let pagina = 1;
const deporte = () => document.getElementById("ranking-deporte").value;
const vista = () => document.getElementById("ranking-vista").value;

async function cargar() {
  try {
    mostrarAvisoRanking("");
    const sexo = document.getElementById("ranking-sexo").value;
    const datos = vista() === "clubes" ? await rankingClubes(deporte(), sexo, pagina) : await ranking(deporte(), sexo, pagina, document.getElementById("ranking-comunidad").value);
    mostrarRanking(datos, vista());
  } catch (error) {
    mostrarAvisoRanking(error.message || "No se pudo cargar el ranking.");
  }
}

for (const id of ["ranking-deporte", "ranking-vista", "ranking-sexo", "ranking-comunidad"]) document.getElementById(id).addEventListener("change", () => { pagina = 1; cargar(); });
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
try {
  const selector = document.getElementById("ranking-comunidad");
  for (const c of await comunidades()) {
    const opcion = document.createElement("option");
    opcion.value = opcion.textContent = c.nombre;
    selector.append(opcion);
  }
} catch { /* sin catálogo el filtro queda en «Todas» */ }
await cargar();
