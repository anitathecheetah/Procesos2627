// Panel de un club (atletas, pruebas, Elo medio y top por deporte). Lo usan el director y la pestaña «Clubes» del administrador.
import { el, tabla } from "./dom.js";

const DEPORTES = { duatlon: "Duatlón", triatlon: "Triatlón" };

export function pintarPanelClub(zona, p) {
  if (!p) return zona.replaceChildren();
  const nodos = [
    el("h3", `Panel de ${p.club.nombre}`),
    el("p", `${p.atletas} atletas · ${p.pruebas} pruebas · ${p.resultados} resultados (${p.finalizados} finalizados)`, { className: "cuenta-atras" }),
  ];
  if (p.aviso) nodos.push(el("p", p.aviso, { className: "suave" }));
  for (const d of p.deportes) {
    nodos.push(
      el("h4", `${DEPORTES[d.deporte] ?? d.deporte}: ${d.atletas} atletas con ranking · Elo medio ${d.mediaElo}`),
      tabla(["Atleta", "Elo", "Pruebas"], d.top.map((a) => [a.nombre, String(a.rating), String(a.pruebas)])),
    );
  }
  nodos.push(el("p", "Solo se usan datos públicos de los resultados; el perfil privado de cada atleta no se muestra.", { className: "suave pequeno" }));
  zona.replaceChildren(...nodos);
}

