// Presentación del ranking Elo: solo construye el DOM. Todo el texto entra con textContent.
function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto ?? "";
  return td;
}

const CABECERAS = {
  atletas: ["#", "Atleta", "Club", "Elo", "Pruebas"],
  clubes: ["#", "Club", "Elo medio", "Atletas", "Mejores"],
};
const VACIO = {
  atletas: "Todavía no hay ranking para este deporte.",
  clubes: "Todavía no hay clubes con ranking (hacen falta al menos 3 atletas por club).",
};

function filaDeAtleta(f) {
  return [f.posicion, f.atleta.nombre, f.club?.nombre, f.rating, f.pruebas];
}
function filaDeClub(f) {
  return [f.posicion, f.club.nombre, f.rating, f.atletas, f.mejores.map((m) => `${m.nombre} (${m.rating})`).join(", ")];
}

// vista: "atletas" (por defecto) o "clubes". Cambia la cabecera de la tabla según la vista.
export function mostrarRanking({ filas, total, pagina, tamano }, vista = "atletas") {
  const cabecera = document.querySelector("#tabla-ranking thead tr");
  cabecera.replaceChildren(...CABECERAS[vista].map((texto) => {
    const th = document.createElement("th");
    th.textContent = texto;
    return th;
  }));
  const cuerpo = document.querySelector("#tabla-ranking tbody");
  if (!filas.length) {
    const fila = document.createElement("tr");
    const td = celda(VACIO[vista]);
    td.colSpan = CABECERAS[vista].length;
    td.className = "vacio";
    fila.append(td);
    cuerpo.replaceChildren(fila);
  } else {
    cuerpo.replaceChildren(...filas.map((f) => {
      const tr = document.createElement("tr");
      tr.append(...(vista === "clubes" ? filaDeClub(f) : filaDeAtleta(f)).map(celda));
      return tr;
    }));
  }
  const paginas = Math.max(1, Math.ceil(total / tamano));
  document.getElementById("ranking-pagina").textContent = `Página ${pagina} de ${paginas} · ${total} ${vista === "clubes" ? "clubes" : "atletas"}`;
  document.getElementById("ranking-anterior").disabled = pagina <= 1;
  document.getElementById("ranking-siguiente").disabled = pagina >= paginas;
}

export function mostrarAvisoRanking(texto, correcto = false) {
  const zona = document.getElementById("aviso-ranking");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}

export const mostrarBotonRecalcularEnPantalla = (visible) => {
  document.getElementById("ranking-recalcular").hidden = !visible;
};
