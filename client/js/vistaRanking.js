// Presentación del ranking Elo: solo construye el DOM. Todo el texto entra con textContent.
function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto ?? "";
  return td;
}

export function mostrarRanking({ filas, total, pagina, tamano }) {
  const cuerpo = document.querySelector("#tabla-ranking tbody");
  if (!filas.length) {
    const fila = document.createElement("tr");
    const td = celda("Todavía no hay ranking para este deporte.");
    td.colSpan = 5;
    td.className = "vacio";
    fila.append(td);
    cuerpo.replaceChildren(fila);
  } else {
    cuerpo.replaceChildren(...filas.map((f) => {
      const tr = document.createElement("tr");
      tr.append(celda(f.posicion), celda(f.atleta.nombre), celda(f.club?.nombre), celda(f.rating), celda(f.pruebas));
      return tr;
    }));
  }
  const paginas = Math.max(1, Math.ceil(total / tamano));
  document.getElementById("ranking-pagina").textContent = `Página ${pagina} de ${paginas} · ${total} atletas`;
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
