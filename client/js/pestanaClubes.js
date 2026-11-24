// Pestaña «Clubes» (solo administrador): el mismo panel que vería el director, de cualquier club.
import { resumenClubes, panelClubAdmin } from "./api.js";
import { mostrarMensaje } from "./ui.js";
import { el } from "./dom.js";
import { pintarPanelClub } from "./vistaPanelClub.js";
import { filtrarClubes, textoClubResumen } from "./filtroClubes.js";

const zona = document.getElementById("panel-clubes-admin");
const buscador = document.getElementById("buscar-club-admin");
const lista = document.getElementById("lista-clubes-admin");
const detalle = document.getElementById("detalle-club-admin");
let clubes = [];

async function abrir(club) {
  try { pintarPanelClub(detalle, await panelClubAdmin(club.id)); }
  catch (error) { mostrarMensaje(error.message || "No se pudo cargar el club.", false, zona); }
}

function pintarLista() {
  const visibles = filtrarClubes(clubes, buscador.value);
  lista.replaceChildren(...visibles.map((c) => {
    const b = el("button", textoClubResumen(c), { type: "button", className: "club-lista" });
    b.addEventListener("click", () => abrir(c));
    const li = el("li");
    li.append(b);
    return li;
  }));
  if (!visibles.length) lista.replaceChildren(el("li", "Ningún club coincide.", { className: "vacio" }));
}

buscador.addEventListener("input", pintarLista);

export async function cargarPestanaClubes(usuario) {
  if (usuario?.rol !== "admin") { clubes = []; detalle.replaceChildren(); return; }
  try {
    clubes = await resumenClubes();
    pintarLista();
  } catch (error) {
    mostrarMensaje(error.message || "No se pudieron cargar los clubes.", false, zona);
  }
}
