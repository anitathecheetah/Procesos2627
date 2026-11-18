// Presentación de resultados: solo construye el DOM. No hace peticiones (eso es api.js).
// Todo el texto entra con textContent, nunca como HTML.
import { NOMBRES_PARCIALES } from "./parciales.js";
import { filtrarClasificacion, esMejorSegmento } from "./filtrosResultados.js";
import { textoElo } from "./elo.js";
import { crearPestanas } from "./pestanas.js";
import { panelResumen, panelSplits, panelPrediccion, crearAjusteDistancias } from "./vistaCarrera.js";
import { resumenCarrera } from "./segmentos.js";
import { el, enlace, tabla, formatearTiempo, formatearFecha } from "./dom.js";

const DEPORTES = { duatlon: "Duatlón", triatlon: "Triatlón" };
const ESTADOS = { finalizado: "", dnf: "DNF", dns: "DNS", dq: "Descalificado" };
const SANCIONES = {
  DSQ: "Descalificación", ST: "Sanción por tiempo",
  LM: "montar antes de la línea", OTH: "otras infracciones",
};

const textoSancion = (s) =>
  s.pares.map((p) => `${SANCIONES[p.accion] ?? p.accion} (${SANCIONES[p.infraccion] ?? p.infraccion})`).join("; ") +
  (s.observaciones ? ` — ${s.observaciones}` : "");

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

const MARCA_MEJOR = "★";

// Tabla de los mejores tiempos de cada segmento de la prueba.
function tablaMejores(nombres, mejores, alElegirAtleta) {
  const filas = nombres.map((nombre, i) => {
    const m = mejores?.[i];
    if (!m) return [nombre, "—", ""];
    const quienes = el("span");
    m.atletas.forEach((a, k) => {
      if (k) quienes.append(", ");
      quienes.append(enlace(a.nombre, () => alElegirAtleta({ id: a.id })));
      if (a.club) quienes.append(el("span", ` (${a.club})`, { className: "suave" }));
    });
    return [nombre, formatearTiempo(m.tiempo), quienes];
  });
  return tabla(["Segmento", "Mejor tiempo", "Atleta"], filas);
}

export function mostrarDetallePrueba({ prueba, clasificacion, mejoresSegmentos }, { alElegirAtleta, alVolver, alPredecir }) {
  const nombres = NOMBRES_PARCIALES[prueba.deporte] ?? [];
  const contenedor = el("div");
  const filtros = el("form", undefined, { className: "filtros", noValidate: true });
  const campo = (etiqueta, nombre, placeholder) => {
    const l = el("label", etiqueta);
    l.append(el("input", undefined, { name: nombre, placeholder, autocomplete: "off" }));
    return l;
  };
  const ordenar = el("label", "Ordenar por");
  const selector = el("select", undefined, { name: "orden" });
  selector.append(el("option", "Posición", { value: "posicion" }));
  nombres.forEach((n, i) => selector.append(el("option", `Mejor tiempo de ${n}`, { value: String(i) })));
  ordenar.append(selector);
  // Comunidades que aparecen en esta prueba (la de la licencia federativa de cada atleta).
  const comunidades = [...new Set(clasificacion.map((f) => f.comunidad).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const filtroComunidad = el("label", "Comunidad de la licencia");
  const selectorComunidad = el("select", undefined, { name: "comunidad" });
  selectorComunidad.append(el("option", "Todas", { value: "" }), ...comunidades.map((c) => el("option", c, { value: c })));
  filtroComunidad.append(selectorComunidad);
  filtros.append(campo("Atleta", "atleta", "Nombre o apellidos"), campo("Club", "club", "Nombre del club"), ...(comunidades.length ? [filtroComunidad] : []), ordenar);
  filtros.addEventListener("submit", (e) => e.preventDefault());

  const pintar = () => {
    const f = Object.fromEntries(new FormData(filtros));
    const visibles = filtrarClasificacion(clasificacion, f);
    const filas = visibles.map((fila) => {
      const estado = ESTADOS[fila.estado];
      const extras = [...(fila.invitado ? ["invitado"] : []), ...fila.sanciones.map(textoSancion)];
      const tiempos = nombres.map((_, i) => {
        const t = fila.estado === "finalizado" && Array.isArray(fila.parciales) && fila.parciales.length === nombres.length ? fila.parciales[i] : null;
        if (t === null) return "";
        return esMejorSegmento(mejoresSegmentos, i, fila) ? `${formatearTiempo(t)} ${MARCA_MEJOR}` : formatearTiempo(t);
      });
      return [
        fila.estado === "finalizado" ? fila.posicion : "—",
        enlace(fila.atleta.nombre, () => alElegirAtleta(fila.atleta)),
        fila.club?.nombre ?? "",
        fila.comunidad ?? "",
        fila.dorsal,
        fila.estado === "finalizado" ? formatearTiempo(fila.tiempoTotal) : estado,
        ...tiempos,
        textoElo(fila.elo),
        extras.join(" · "),
      ];
    });
    contenedor.replaceChildren(
      el("p", `${visibles.length} de ${clasificacion.length} resultados`, { className: "suave" }),
      tabla(["Pos.", "Atleta", "Club", "Licencia", "Dorsal", "Tiempo", ...nombres, "Elo", "Notas"], filas),
    );
  };
  filtros.addEventListener("input", pintar);

  const datos = { prueba, clasificacion };
  let pestanas;
  const ajuste = crearAjusteDistancias(prueba, resumenCarrera(clasificacion).medias, () => pestanas?.refrescar());
  const opciones = { alElegirAtleta, metros: ajuste.metros };
  const clasificacionNodos = () => [
    el("h4", "Mejor tiempo de cada segmento"),
    tablaMejores(nombres, mejoresSegmentos, alElegirAtleta),
    el("h4", "Clasificación"),
    el("p", `${MARCA_MEJOR} marca el mejor tiempo del segmento. Elo: puntos del atleta antes de la prueba → después, y lo que ganó o perdió. Sale al recalcular el ranking del deporte; quien no termina no puntúa.`, { className: "suave" }),
    filtros,
    contenedor,
  ];
  alternarVista([
    enlace("← Volver", alVolver),
    el("h3", prueba.nombre),
    el("p", `${formatearFecha(prueba.fecha)} · ${DEPORTES[prueba.deporte] ?? prueba.deporte}${prueba.categoria ? ` · ${prueba.categoria}` : ""}`, { className: "suave" }),
    ...(ajuste.nodo ? [ajuste.nodo] : []),
    (pestanas = crearPestanas([
      { id: "resumen", titulo: "Resumen", contenido: () => panelResumen(datos, opciones) },
      { id: "splits", titulo: "Splits", contenido: () => panelSplits(datos, opciones) },
      { id: "clasificacion", titulo: "Clasificación", contenido: clasificacionNodos },
      { id: "prediccion", titulo: "Predicción", contenido: () => panelPrediccion(prueba, alPredecir) },
    ])),
  ]);
  pintar();
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
