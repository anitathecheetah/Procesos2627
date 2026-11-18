// Presentación de la predicción: solo construye el DOM. No hace peticiones (eso es api.js).
import { el, tabla, formatearFecha } from "./dom.js";
import { porcentaje, textoRango, textoDiferencia } from "./formatoPrediccion.js";
import { nombreConCategoria, pruebaEncajaConSexo } from "./categorias.js";

const normalizar = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Rellena el selector de lista de salida: las carreras futuras con lista de salida oficial (valor "c:<id>"),
// los participantes de una prueba anterior o, como aproximación, los mejores del ranking.
// Si hay una carrera con lista oficial se deja elegida (es lo que de verdad va a pasar); si no, la prueba de Águilas
// más reciente (pruebas llega con las más recientes primero).
let pruebasCargadas = [];
let carrerasCargadas = [];

export function mostrarOpcionesBase(pruebas, carreras = []) {
  pruebasCargadas = pruebas;
  carrerasCargadas = carreras;
  pintarOpciones(true);
}

// Las pruebas anteriores se filtran por el sexo elegido; al cambiar el sexo se repinta la lista
// (conservando la elección si sigue disponible).
export function refrescarOpcionesPorSexo() {
  pintarOpciones(false);
}

function pintarOpciones(elegirPorDefecto) {
  const selector = document.getElementById("prediccion-base");
  const sexo = document.getElementById("prediccion-sexo").value;
  const anterior = selector.value;
  const pruebas = pruebasCargadas.filter((p) => pruebaEncajaConSexo(p, sexo));
  const opciones = [el("option", "Los 100 mejores del ranking (aproximación)", { value: "" })];
  const conLista = carrerasCargadas.filter((c) => c.participantes > 0);
  for (const c of conLista) opciones.push(el("option", `Lista de salida oficial: ${c.nombre} (${formatearFecha(c.fecha)}) · ${c.participantes} participantes`, { value: `c:${c.id}` }));
  for (const p of pruebas) opciones.push(el("option", `Prueba anterior: ${nombreConCategoria(p)} (${formatearFecha(p.fecha)})`, { value: p.id }));
  selector.replaceChildren(...opciones);
  const aguilas = pruebas.find((p) => normalizar(p.nombre).includes("aguilas"));
  if (!elegirPorDefecto && opciones.some((o) => o.value === anterior)) selector.value = anterior;
  else if (conLista.length) selector.value = `c:${conLista[0].id}`;
  else if (aguilas) selector.value = aguilas.id;
  actualizarControles();
}

// La comparación con el resultado real solo tiene sentido con una prueba anterior.
export function actualizarControles() {
  const valor = document.getElementById("prediccion-base").value;
  const casilla = document.getElementById("prediccion-retro");
  casilla.disabled = !valor || valor.startsWith("c:");
  if (casilla.disabled) casilla.checked = false;
}

// Nodos con el resumen y la tabla de una predicción (se usa en la tarjeta de predicción y en la página de cada prueba).
export function construirPrediccion(datos) {
  const retro = datos.retrospectiva;
  const cabeceras = ["#", "Atleta", "Club", "Elo", "Posición media", "Victoria", "Podio", "Top 10", "Rango (80 %)", ...(retro ? ["Real", "Dif."] : [])];
  const filas = datos.filas.map((f) => [
    f.posicionPrevista,
    f.atleta.nombre,
    f.club?.nombre ?? "",
    f.sinHistorial ? `${f.rating} *` : f.rating,
    f.posicionMedia.toFixed(1).replace(".", ","),
    porcentaje(f.probVictoria),
    porcentaje(f.probPodio),
    porcentaje(f.probTop10),
    textoRango(f.rango),
    ...(retro ? [f.posicionReal ?? "—", textoDiferencia(f.posicionPrevista, f.posicionReal)] : []),
  ]);
  const origen = datos.carrera ? `lista de salida oficial: ${datos.carrera.nombre} (${formatearFecha(datos.carrera.fecha)})`
    : datos.base ? `lista de salida: ${datos.base.nombre} (${formatearFecha(datos.base.fecha)})` : "lista de salida: los mejores del ranking (aproximación)";
  const resumen = [`${datos.filas.length} atletas`, origen, `${datos.simulaciones.toLocaleString("es-ES")} simulaciones`];
  if (retro && datos.errorMedio !== null) resumen.push(`error medio de ${String(datos.errorMedio).replace(".", ",")} puestos respecto al resultado real`);
  const nodos = [el("p", resumen.join(" · "), { className: "suave" }), tabla(cabeceras, filas)];
  if (datos.filas.some((f) => f.sinHistorial)) nodos.push(el("p", "* Sin Elo en este deporte: parte del Elo inicial (1500) y su predicción es menos fiable.", { className: "suave pequeno" }));
  return nodos;
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
