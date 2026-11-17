// Presentación de resultados: solo construye el DOM. No hace peticiones (eso es api.js).
// Todo el texto entra con textContent, nunca como HTML.
import { describirParciales } from "./parciales.js";
import { textoElo } from "./elo.js";

const DEPORTES = { duatlon: "Duatlón", triatlon: "Triatlón" };
const ESTADOS = { finalizado: "", dnf: "DNF", dns: "DNS", dq: "Descalificado" };
const SANCIONES = {
  DSQ: "Descalificación", ST: "Sanción por tiempo",
  LM: "montar antes de la línea", OTH: "otras infracciones",
};

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

const textoSancion = (s) =>
  s.pares.map((p) => `${SANCIONES[p.accion] ?? p.accion} (${SANCIONES[p.infraccion] ?? p.infraccion})`).join("; ") +
  (s.observaciones ? ` — ${s.observaciones}` : "");

function el(etiqueta, texto, atributos = {}) {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  Object.assign(e, atributos);
  return e;
}

function enlace(texto, alPulsar) {
  const b = el("button", texto, { type: "button", className: "enlace" });
  b.addEventListener("click", alPulsar);
  return b;
}

function tabla(cabeceras, filas) {
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

export function mostrarPruebas(pruebas, alElegir) {
  const lista = document.getElementById("lista-pruebas");
  if (!pruebas.length) {
    lista.replaceChildren(el("li", "Todavía no hay pruebas importadas.", { className: "vacio" }));
    return;
  }
  lista.replaceChildren(...pruebas.map((p) => {
    const li = el("li");
    li.append(
      enlace(p.nombre, () => alElegir(p)),
      el("span", ` · ${formatearFecha(p.fecha)} · ${DEPORTES[p.deporte] ?? p.deporte} · ${p.participantes} participantes`, { className: "suave" }),
    );
    return li;
  }));
}

export function mostrarAtletas(atletas, alElegir) {
  const lista = document.getElementById("lista-atletas");
  if (!atletas) return lista.replaceChildren();
  if (!atletas.length) {
    lista.replaceChildren(el("li", "No se ha encontrado ningún atleta.", { className: "vacio" }));
    return;
  }
  lista.replaceChildren(...atletas.map((a) => {
    const li = el("li");
    li.append(enlace(a.nombre, () => alElegir(a)), el("span", ` · ${a.anioNacimiento}`, { className: "suave" }));
    return li;
  }));
}

// Muestra el detalle (o la lista si es null).
function alternarVista(detalle) {
  document.getElementById("vista-pruebas").hidden = Boolean(detalle);
  const zona = document.getElementById("vista-detalle");
  zona.hidden = !detalle;
  zona.replaceChildren(...(detalle ?? []));
}
export const volverALaLista = () => alternarVista(null);

export function mostrarDetallePrueba({ prueba, clasificacion }, { alElegirAtleta, alVolver }) {
  const filas = clasificacion.map((f) => {
    const estado = ESTADOS[f.estado];
    const extras = [...(f.invitado ? ["invitado"] : []), ...f.sanciones.map(textoSancion)];
    return [
      f.estado === "finalizado" ? f.posicion : "—",
      enlace(`${f.atleta.nombre}`, () => alElegirAtleta(f.atleta)),
      f.club?.nombre ?? "",
      f.dorsal,
      f.estado === "finalizado" ? formatearTiempo(f.tiempoTotal) : estado,
      describirParciales(prueba.deporte, f.parciales, formatearTiempo),
      textoElo(f.elo),
      extras.join(" · "),
    ];
  });
  alternarVista([
    enlace("← Volver", alVolver),
    el("h3", prueba.nombre),
    el("p", `${formatearFecha(prueba.fecha)} · ${DEPORTES[prueba.deporte] ?? prueba.deporte}${prueba.categoria ? ` · ${prueba.categoria}` : ""}`, { className: "suave" }),
    el("p", "Elo: puntos del atleta antes de la prueba → después, y lo que ganó o perdió. Sale al recalcular el ranking del deporte; quien no termina no puntúa.", { className: "suave" }),
    tabla(["Pos.", "Atleta", "Club", "Dorsal", "Tiempo", "Parciales", "Elo", "Notas"], filas),
  ]);
}

export function mostrarFichaAtleta({ atleta, clubes, resultados, elo = [] }, { alElegirPrueba, alVolver }) {
  alternarVista([
    enlace("← Volver", alVolver),
    el("h3", atleta.nombre),
    el("p", `Año de nacimiento: ${atleta.anioNacimiento}`, { className: "suave" }),
    el("p", clubes.length ? `Clubes: ${clubes.map((c) => `${c.temporada}: ${c.club?.nombre ?? "—"}`).join(" · ")}` : "Sin club registrado."),
    tabla(["Fecha", "Prueba", "Pos.", "Tiempo", "Notas"], resultados.map((r) => [
      formatearFecha(r.prueba.fecha),
      enlace(r.prueba.nombre, () => alElegirPrueba({ id: r.pruebaId })),
      r.estado === "finalizado" ? r.posicion : ESTADOS[r.estado],
      r.estado === "finalizado" ? formatearTiempo(r.tiempoTotal) : "—",
      r.sanciones.map(textoSancion).join(" · "),
    ])),
    ...elo.flatMap((e) => [
      el("h4", `Elo en ${DEPORTES[e.deporte] ?? e.deporte}: ${e.rating} (${e.pruebas} ${e.pruebas === 1 ? "prueba" : "pruebas"})`),
      tabla(["Fecha", "Prueba", "Puesto", "Elo"], e.historial.map((h) => [
        formatearFecha(h.fecha),
        enlace(h.prueba, () => alElegirPrueba({ id: h.pruebaId })),
        `${h.posicion} de ${h.participantes}`,
        textoElo({ antes: h.antes, despues: h.despues, cambio: h.despues - h.antes }),
      ])),
    ]),
  ]);
}

export function mostrarAvisoResultados(texto, correcto = false) {
  const zona = document.getElementById("aviso-resultados");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}
