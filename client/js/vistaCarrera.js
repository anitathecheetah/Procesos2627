// Paneles de la página de una carrera: Resumen, Splits y Predicción. Solo construyen el DOM.
// Los cálculos están en segmentos.js; las peticiones, en resultados.js (llegan como funciones).
import { NOMBRES_PARCIALES } from "./parciales.js";
import { SEGMENTOS, construirSplits, ordenarSplits, mejoresDelSegmento, resumenCarrera, csvSplits } from "./segmentos.js";
import { el, enlace, formatearTiempo, formatearTiempoCorto } from "./dom.js";
import { construirPrediccion } from "./vistaPrediccion.js";
import { DISTANCIAS, DISTANCIA_POR_DEFECTO, PERSONALIZADA, distanciasDe, textoRitmo, ritmosRealistas, sugerirDistancias } from "./ritmos.js";

const nombresDe = (prueba) => NOMBRES_PARCIALES[prueba.deporte] ?? Array.from({ length: SEGMENTOS }, (_, i) => `Segmento ${i + 1}`);
const tarjeta = (...hijos) => { const t = el("div", undefined, { className: "mini-tarjeta" }); t.append(...hijos); return t; };

function leerGuardado(clave) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? {}; } catch { return {}; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: no se recuerda */ }
}

// Selector de las distancias de la prueba, de las que salen los ritmos.
// Si nadie las ha elegido para ESTA prueba, se deducen de sus tiempos medios (el formato cuyos ritmos encajan);
// la elección se recuerda por prueba en este navegador. Si con las distancias elegidas los ritmos medios no son
// creíbles, se avisa. medias: tiempo medio de cada segmento (resumenCarrera). Devuelve { nodo, metros }:
// `metros()` da las distancias elegidas ([nat o c1, bici, carrera] en metros) o null.
export function crearAjusteDistancias(prueba, medias, alCambiar) {
  const deporte = prueba.deporte;
  const presets = DISTANCIAS[deporte];
  if (!presets) return { nodo: null, metros: () => null };
  const almacen = `ritmos:${prueba.id}`;
  const guardado = leerGuardado(almacen);
  const sugerida = sugerirDistancias(deporte, medias) ?? DISTANCIA_POR_DEFECTO[deporte];
  const elegidaAntes = guardado.clave === PERSONALIZADA || Boolean(presets[guardado.clave]);
  const estado = {
    clave: elegidaAntes ? guardado.clave : sugerida,
    personalizadas: Array.isArray(guardado.personalizadas) ? guardado.personalizadas : presets[sugerida].metros,
    deducida: !elegidaAntes,
  };
  const triatlon = deporte === "triatlon";
  const campos = [[triatlon ? "Natación (m)" : "Carrera 1 (km)", triatlon ? 1 : 1000], ["Bici (km)", 1000], [triatlon ? "Carrera (km)" : "Carrera 2 (km)", 1000]];

  const selector = el("select");
  Object.entries(presets).forEach(([clave, p]) => selector.append(el("option", p.nombre, { value: clave })));
  selector.append(el("option", "Personalizadas…", { value: PERSONALIZADA }));
  selector.value = estado.clave;
  const etiqueta = el("label", "Distancias de la prueba (para calcular los ritmos)");
  etiqueta.append(selector);

  const nota = el("p", undefined, { className: "suave pequeno" });
  const aviso = el("p", undefined, { className: "aviso-ritmos", role: "alert" });
  const actualizarNotas = () => {
    nota.textContent = estado.deducida ? "Distancias deducidas de los tiempos de esta prueba: cámbialas si no son las correctas." : "";
    aviso.textContent = ritmosRealistas(deporte, medias, distanciasDe(deporte, estado.clave, estado.personalizadas))
      ? "" : "Con estas distancias los ritmos medios no son realistas: revisa las distancias de la prueba.";
  };

  const personalizadas = el("div", undefined, { className: "filtros" });
  const entradas = campos.map(([texto, factor], i) => {
    const entrada = el("input", undefined, { type: "number", min: "0", step: "any", value: String(estado.personalizadas[i] / factor) });
    const l = el("label", texto);
    l.append(entrada);
    personalizadas.append(l);
    entrada.addEventListener("input", () => { estado.personalizadas = entradas.map((e, k) => Number(e.value) * campos[k][1]); cambiar(); });
    return entrada;
  });
  personalizadas.hidden = estado.clave !== PERSONALIZADA;

  const cambiar = () => { estado.deducida = false; guardar(almacen, { clave: estado.clave, personalizadas: estado.personalizadas }); actualizarNotas(); alCambiar(); };
  selector.addEventListener("change", () => { estado.clave = selector.value; personalizadas.hidden = estado.clave !== PERSONALIZADA; cambiar(); });
  actualizarNotas();

  const nodo = el("div", undefined, { className: "ajuste-distancias" });
  nodo.append(etiqueta, personalizadas, nota, aviso);
  return { nodo, metros: () => distanciasDe(deporte, estado.clave, estado.personalizadas) };
}

export function panelResumen({ prueba, clasificacion }, { alElegirAtleta, metros = () => null }) {
  const nombres = nombresDe(prueba);
  const splits = construirSplits(clasificacion);
  const r = resumenCarrera(clasificacion);
  const ritmo = (i, segundos) => textoRitmo(prueba.deporte, i, segundos, metros());

  const cifras = el("div", undefined, { className: "cifras" });
  cifras.append(
    tarjeta(el("strong", `${r.finalizados}/${r.salieron}`), el("span", "Finalizaron", { className: "suave" })),
    ...nombres.map((n, i) => tarjeta(
      el("strong", formatearTiempoCorto(r.medias[i])),
      el("span", `Media ${n}`, { className: "suave" }),
      ...(ritmo(i, r.medias[i]) ? [el("span", ritmo(i, r.medias[i]), { className: "ritmo" })] : []),
    )),
  );

  const podio = el("div", undefined, { className: "podio" });
  r.podio.forEach((p) => {
    const parciales = p.tiempos.map((t, i) => `${nombres[i]} ${formatearTiempoCorto(t)}`).join(" · ");
    podio.append(tarjeta(
      el("span", String(p.posicion), { className: `medalla medalla-${p.posicion}` }),
      enlace(p.nombre, () => alElegirAtleta({ id: p.id })),
      el("span", p.club, { className: "suave" }),
      el("strong", formatearTiempo(p.total)),
      el("span", parciales, { className: "suave pequeno" }),
    ));
  });

  const mejores = el("div", undefined, { className: "mejores-segmentos" });
  nombres.forEach((n, i) => {
    const caja = el("div", undefined, { className: "caja-segmento" });
    caja.append(el("h5", n));
    const top = mejoresDelSegmento(splits, i, 3);
    if (!top.length) caja.append(el("p", "Sin datos", { className: "suave" }));
    top.forEach((m) => {
      const fila = el("div", undefined, { className: "fila-top" });
      fila.append(el("span", `${m.puesto}.`, { className: "suave" }), enlace(m.nombre, () => alElegirAtleta({ id: m.id })), el("strong", formatearTiempoCorto(m.tiempo)));
      if (ritmo(i, m.tiempo)) fila.append(el("span", ritmo(i, m.tiempo), { className: "ritmo" }));
      caja.append(fila);
    });
    mejores.append(caja);
  });

  return [
    el("h4", "Resumen de la carrera"),
    cifras,
    el("h4", "Podio"),
    r.podio.length ? podio : el("p", "Todavía no hay finalistas.", { className: "vacio" }),
    el("h4", "Los 3 mejores de cada segmento"),
    el("p", "Solo cuentan los finalistas con los 5 parciales completos.", { className: "suave" }),
    mejores,
  ];
}

function descargar(nombreArchivo, texto) {
  const url = URL.createObjectURL(new Blob(["﻿", texto], { type: "text/csv;charset=utf-8" }));
  const a = el("a", undefined, { href: url, download: nombreArchivo });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function panelSplits({ prueba, clasificacion }, { alElegirAtleta, metros = () => null }) {
  const nombres = nombresDe(prueba);
  const filas = construirSplits(clasificacion);
  const estado = { columna: "posicion", descendente: false, modo: "tiempo" };

  const modos = el("div", undefined, { className: "conmutador", role: "group" });
  const botonesModo = [["tiempo", "Tiempo"], ["puestos", "Puestos"], ["ritmo", "Ritmo"]].map(([clave, texto]) => {
    const b = el("button", texto, { type: "button", className: "conmutador-boton" });
    b.addEventListener("click", () => { estado.modo = clave; pintar(); });
    b.dataset.modo = clave;
    return b;
  });
  modos.append(...botonesModo);
  const csv = el("button", "CSV", { type: "button", className: "secundario" });
  csv.addEventListener("click", () => {
    const nombreArchivo = `splits-${prueba.nombre}`.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\w-]+/g, "_").toLowerCase();
    descargar(`${nombreArchivo}.csv`, csvSplits(nombres, ordenarSplits(filas, estado.columna, estado.descendente), formatearTiempo));
  });
  const barra = el("div", undefined, { className: "barra-herramientas" });
  barra.append(modos, csv);

  const contenedor = el("div", undefined, { className: "tabla-desplazable" });
  const cabeceras = [["posicion", "#"], ["nombre", "Atleta"], ["club", "Club"], ...nombres.map((n, i) => [i, n]), ["total", "Total"]];

  function pintar() {
    botonesModo.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === estado.modo)));
    const t = el("table", undefined, { className: "splits" });
    const tr = el("tr");
    for (const [clave, texto] of cabeceras) {
      const th = el("th");
      const activa = estado.columna === clave;
      th.setAttribute("aria-sort", activa ? (estado.descendente ? "descending" : "ascending") : "none");
      const b = el("button", `${texto}${activa ? (estado.descendente ? " ▼" : " ▲") : ""}`, { type: "button", className: "ordenar" });
      b.addEventListener("click", () => {
        estado.descendente = estado.columna === clave ? !estado.descendente : false;
        estado.columna = clave;
        pintar();
      });
      th.append(b);
      tr.append(th);
    }
    t.append(el("thead"), el("tbody"));
    t.tHead.append(tr);
    for (const f of ordenarSplits(filas, estado.columna, estado.descendente)) {
      const fila = el("tr");
      const celda = (texto, clase) => { const td = el("td", texto, clase ? { className: clase } : {}); fila.append(td); return td; };
      celda(f.posicion);
      const atleta = el("td"); atleta.append(enlace(f.nombre, () => alElegirAtleta({ id: f.id }))); fila.append(atleta);
      celda(f.club, "suave");
      f.tiempos.forEach((tiempo, i) => {
        const td = el("td", undefined, { className: f.puestos[i] === 1 ? "mejor" : "" });
        if (tiempo === null) td.textContent = "—";
        else if (estado.modo === "puestos") td.textContent = String(f.puestos[i]);
        else if (estado.modo === "ritmo") td.append(textoRitmo(prueba.deporte, i, tiempo, metros()) || formatearTiempoCorto(tiempo), el("sup", String(f.puestos[i]), { className: "puesto" }));
        else td.append(formatearTiempoCorto(tiempo), el("sup", String(f.puestos[i]), { className: "puesto" }));
        fila.append(td);
      });
      celda(formatearTiempoCorto(f.total));
      t.tBodies[0].append(fila);
    }
    contenedor.replaceChildren(t);
  }
  pintar();

  return [
    el("h4", "Splits"),
    el("p", "Tiempo de cada atleta en cada segmento y su puesto en él (número pequeño). En verde, el mejor tiempo. «Ritmo» muestra min/100 m en natación, km/h en bici y min/km en carrera (según las distancias elegidas). Pulsa una cabecera para ordenar.", { className: "suave" }),
    barra,
    filas.length ? contenedor : el("p", "Todavía no hay finalistas.", { className: "vacio" }),
  ];
}

// Predicción de la prueba con el Elo de antes de disputarla, comparada con el resultado real.
export function panelPrediccion(prueba, alPredecir) {
  const zona = el("div");
  zona.append(el("p", "Calculando la predicción…", { className: "suave" }));
  alPredecir(prueba).then(
    (datos) => zona.replaceChildren(...construirPrediccion(datos)),
    (error) => zona.replaceChildren(el("p", error.message || "No se pudo calcular la predicción.", { className: "mensaje" })),
  );
  return [
    el("h4", "Predicción y resultado"),
    el("p", "Predicción hecha con el Elo que tenía cada atleta antes de esta prueba, comparada con lo que pasó. Hace falta que el ranking esté recalculado con ella.", { className: "suave" }),
    zona,
  ];
}
