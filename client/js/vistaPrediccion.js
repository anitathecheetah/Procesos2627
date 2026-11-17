// Presentación de la predicción: solo construye el DOM. No hace peticiones (eso es api.js).
import { el, tabla, formatearFecha } from "./dom.js";
import { porcentaje, textoRango, textoDiferencia } from "./formatoPrediccion.js";

const normalizar = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Rellena el selector de lista de salida: los mejores del ranking o los participantes de una prueba anterior.
// Si hay una prueba de Águilas, se deja elegida la más reciente (pruebas llega con las más recientes primero).
export function mostrarOpcionesBase(pruebas) {
  const selector = document.getElementById("prediccion-base");
  const opciones = [el("option", "Los 100 mejores del ranking (aproximación)", { value: "" })];
  for (const p of pruebas) opciones.push(el("option", `${p.nombre} (${formatearFecha(p.fecha)})`, { value: p.id }));
  selector.replaceChildren(...opciones);
  const aguilas = pruebas.find((p) => normalizar(p.nombre).includes("aguilas"));
  if (aguilas) selector.value = aguilas.id;
  actualizarControles();
}

// Sexo solo se usa con el ranking; la comparación con el resultado real solo con una prueba base.
export function actualizarControles() {
  const hayBase = Boolean(document.getElementById("prediccion-base").value);
  document.getElementById("prediccion-sexo").disabled = hayBase;
  const casilla = document.getElementById("prediccion-retro");
  casilla.disabled = !hayBase;
  if (!hayBase) casilla.checked = false;
}

// Nodos con el resumen y la tabla de una predicción (se usa en la tarjeta de predicción y en la página de cada prueba).
export function construirPrediccion(datos) {
  const retro = datos.retrospectiva;
  const cabeceras = ["#", "Atleta", "Club", "Elo", "Posición media", "Victoria", "Podio", "Top 10", "Rango (80 %)", ...(retro ? ["Real", "Dif."] : [])];
  const filas = datos.filas.map((f) => [
    f.posicionPrevista,
    f.atleta.nombre,
    f.club?.nombre ?? "",
    f.rating,
    f.posicionMedia.toFixed(1).replace(".", ","),
    porcentaje(f.probVictoria),
    porcentaje(f.probPodio),
    porcentaje(f.probTop10),
    textoRango(f.rango),
    ...(retro ? [f.posicionReal ?? "—", textoDiferencia(f.posicionPrevista, f.posicionReal)] : []),
  ]);
  const origen = datos.base ? `lista de salida: ${datos.base.nombre} (${formatearFecha(datos.base.fecha)})` : "lista de salida: los mejores del ranking (aproximación)";
  const resumen = [`${datos.filas.length} atletas`, origen, `${datos.simulaciones.toLocaleString("es-ES")} simulaciones`];
  if (retro && datos.errorMedio !== null) resumen.push(`error medio de ${String(datos.errorMedio).replace(".", ",")} puestos respecto al resultado real`);
  return [el("p", resumen.join(" · "), { className: "suave" }), tabla(cabeceras, filas)];
}

export function mostrarPrediccion(datos) {
  document.getElementById("prediccion-resultado").replaceChildren(...construirPrediccion(datos));
}

export function limpiarPrediccion() { document.getElementById("prediccion-resultado").replaceChildren(); }

export function mostrarAvisoPrediccion(texto, correcto = false) {
  const zona = document.getElementById("aviso-prediccion");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}
