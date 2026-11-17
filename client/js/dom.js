// Utilidades de DOM y formato compartidas por las vistas. Todo el texto entra con textContent, nunca como HTML.
export function formatearTiempo(segundos) {
  if (segundos === null || segundos === undefined) return "—";
  const total = Math.round(segundos);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatearFecha(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}


export function el(etiqueta, texto, atributos = {}) {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  Object.assign(e, atributos);
  return e;
}

export function enlace(texto, alPulsar) {
  const b = el("button", texto, { type: "button", className: "enlace" });
  b.addEventListener("click", alPulsar);
  return b;
}

export function tabla(cabeceras, filas) {
  const t = el("table");
  const cabecera = el("tr");
  cabeceras.forEach((c) => cabecera.append(el("th", c)));
  t.append(el("thead"), el("tbody"));
  t.tHead.append(cabecera);
  for (const fila of filas) {
    const tr = el("tr");
    for (const celda of fila) {
      const td = el("td");
      if (celda instanceof Node) td.append(celda);
      else td.textContent = celda ?? "";
      tr.append(td);
    }
    t.tBodies[0].append(tr);
  }
  const envoltorio = el("div", undefined, { className: "tabla-desplazable" });
  envoltorio.append(t);
  return envoltorio;
}

// Como formatearTiempo pero sin las horas si no llegan a 1: 0:30, 19:16, 1:04:53.
export function formatearTiempoCorto(segundos) {
  if (segundos === null || segundos === undefined) return "—";
  const total = Math.round(segundos);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
