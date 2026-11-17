// Pestañas accesibles (tablist/tab/tabpanel) con navegación por teclado. Solo construye el DOM.
// pestanas: [{ id, titulo, contenido: () => Node | Node[] }]. El contenido se crea al abrir la pestaña
// la primera vez y se conserva, así los filtros y ordenaciones no se pierden al cambiar de pestaña.
import { el } from "./dom.js";
import { indiceTrasTecla } from "./navegacionPestanas.js";

export function crearPestanas(pestanas, { inicial = 0 } = {}) {
  const raiz = el("div", undefined, { className: "pestanas" });
  const lista = el("div", undefined, { className: "pestanas-lista", role: "tablist" });
  const panel = el("div", undefined, { className: "pestanas-panel", role: "tabpanel", tabIndex: 0 });
  const contenidos = new Map();
  let actual = inicial;
  const botones = pestanas.map((p, i) => {
    const b = el("button", p.titulo, { type: "button", className: "pestana", role: "tab", id: `pestana-${p.id}` });
    b.addEventListener("click", () => elegir(i));
    b.addEventListener("keydown", (e) => {
      const destino = indiceTrasTecla(i, pestanas.length, e.key);
      if (destino === null) return;
      e.preventDefault();
      elegir(destino);
      botones[destino].focus();
    });
    return b;
  });

  function elegir(i) {
    actual = i;
    botones.forEach((b, k) => {
      b.setAttribute("aria-selected", String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    if (!contenidos.has(i)) {
      const c = pestanas[i].contenido();
      contenidos.set(i, Array.isArray(c) ? c : [c]);
    }
    panel.setAttribute("aria-labelledby", botones[i].id);
    panel.replaceChildren(...contenidos.get(i));
  }

  lista.append(...botones);
  raiz.append(lista, panel);
  // Vuelve a construir la pestaña abierta (y descarta las demás): para cuando cambian los datos de los que dependen.
  raiz.refrescar = () => { contenidos.clear(); elegir(actual); };
  elegir(inicial);
  return raiz;
}
