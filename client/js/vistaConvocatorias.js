// Presentación de las próximas carreras: solo construye el DOM. No hace peticiones (eso es api.js).
import { el, tabla, formatearFecha } from "./dom.js";
import { textoDias, proximaCarreraApuntada, textoTiempo } from "./cuentaAtras.js";

const DEPORTES = { duatlon: "Duatlón", triatlon: "Triatlón" };
const ESTADOS = { abierta: "Abierta", cerrada: "Con lista de salida" };

function boton(texto, alPulsar, clase = "secundario") {
  const b = el("button", texto, { type: "button", className: clase });
  b.addEventListener("click", alPulsar);
  return b;
}

// usuario: persona con sesión o null. acciones: { alApuntarse, alDesapuntarse, alVerLista, alVerApuntados, alSubirLista, alVerAsistencia, alEliminar }.
export function mostrarConvocatorias(carreras, usuario, acciones) {
  const lista = document.getElementById("lista-convocatorias");
  if (!carreras.length) {
    lista.replaceChildren(el("li", "Todavía no hay carreras convocadas.", { className: "vacio" }));
    return;
  }
  const esAdmin = usuario?.rol === "admin";
  const proxima = usuario ? proximaCarreraApuntada(carreras) : null;
  document.getElementById("proxima-carrera").replaceChildren(...(proxima ? [
    el("strong", `Tu próxima carrera: ${proxima.nombre}`),
    el("span", `${textoDias(proxima.diasRestantes)} · ${formatearFecha(proxima.fecha)}`),
    boton("Preparar carrera", () => acciones.alPreparar(proxima), ""),
  ] : []));
  lista.replaceChildren(...carreras.map((c) => {
    const abierta = c.estado === "abierta";
    const li = el("li", undefined, { className: "convocatoria" });
    const datos = el("div", undefined, { className: "convocatoria-datos" });
    datos.append(
      el("strong", c.nombre),
      el("span", `${formatearFecha(c.fecha)} · ${DEPORTES[c.deporte] ?? c.deporte}${c.lugar ? ` · ${c.lugar}` : ""}`, { className: "suave" }),
      el("span", textoDias(c.diasRestantes), { className: "cuenta-atras" }),
      el("span", `${c.apuntados} ${c.apuntados === 1 ? "apuntado" : "apuntados"} · ${ESTADOS[c.estado] ?? c.estado}${abierta ? "" : ` (${c.participantes} participantes)`}`, { className: "suave" }),
    );
    const botones = el("div", undefined, { className: "convocatoria-botones" });
    if (abierta && usuario) {
      botones.append(c.apuntado
        ? boton("Ya no voy", () => acciones.alDesapuntarse(c))
        : boton("Me apunto", () => acciones.alApuntarse(c), ""));
    } else if (abierta) {
      botones.append(el("span", "Inicia sesión para apuntarte", { className: "suave pequeno" }));
    }
    if (c.apuntado && abierta) botones.append(el("span", "✓ Vas a ir", { className: "apuntado" }));
    if (c.diasRestantes >= 0) botones.append(boton("Preparar carrera", () => acciones.alPreparar(c)));
    if (!abierta) botones.append(boton("Ver lista de salida", () => acciones.alVerLista(c)));
    if (esAdmin) {
      botones.append(boton("Ver apuntados", () => acciones.alVerApuntados(c)));
      botones.append(boton(abierta ? "Subir lista de salida" : "Cambiar lista de salida", () => acciones.alSubirLista(c)));
      if (!abierta) botones.append(boton("Ver asistencia", () => acciones.alVerAsistencia(c)));
      botones.append(boton("Eliminar", () => acciones.alEliminar(c), "peligro"));
    }
    li.append(datos, botones);
    return li;
  }));
}

export function mostrarFormularioAdmin(esAdmin) {
  document.getElementById("form-convocatoria").hidden = !esAdmin;
  if (!esAdmin) limpiarDetalle();
}

export function limpiarDetalle() { document.getElementById("detalle-convocatoria").replaceChildren(); }

export function mostrarApuntados(carrera, apuntados) {
  document.getElementById("detalle-convocatoria").replaceChildren(
    el("h3", `Apuntados a ${carrera.nombre}`),
    apuntados.length ? tabla(["Nombre"], apuntados.map((a) => [a.nombre])) : el("p", "Todavía no se ha apuntado nadie.", { className: "vacio" }),
  );
}

// Formulario del administrador para subir el Excel de la lista de salida que publica la federación.
export function mostrarFormularioLista(carrera, alSubir) {
  const archivo = el("input", undefined, { type: "file", accept: ".xlsx" });
  const etiquetaArchivo = el("label", "Excel de la lista de salida (.xlsx)");
  etiquetaArchivo.append(archivo);
  const sexo = el("select");
  [["", "Mixta / sin indicar"], ["M", "Masculina"], ["F", "Femenina"]].forEach(([v, t]) => sexo.append(el("option", t, { value: v })));
  const etiquetaSexo = el("label", "Categoría de esta lista");
  etiquetaSexo.append(sexo);
  document.getElementById("detalle-convocatoria").replaceChildren(
    el("h3", `Lista de salida de ${carrera.nombre}`),
    el("p", "Columnas: NOMBRE y NACIMIENTO obligatorias; CLUB y DORSAL opcionales. Al subirla, la carrera se cierra a nuevas inscripciones y la predicción usará esta lista. Los posibles menores de edad no se guardan. Se puede volver a subir para sustituirla.", { className: "suave" }),
    etiquetaArchivo,
    etiquetaSexo,
    boton("Subir lista", () => alSubir(carrera, archivo.files[0], sexo.value), ""),
  );
}

export function mostrarLista(carrera, lista) {
  document.getElementById("detalle-convocatoria").replaceChildren(
    el("h3", `Lista de salida de ${carrera.nombre}`),
    lista.length ? tabla(["Dorsal", "Atleta", "Club"], lista.map((p) => [p.dorsal ?? "", p.atleta.nombre, p.club?.nombre ?? ""])) : el("p", "La lista está vacía.", { className: "vacio" }),
  );
}

export function mostrarAsistencia(a, resumenSubida) {
  const filas = a.apuntados.map((p) => [p.nombre, p.enLista ? "Sí" : "No", p.atleta ? p.atleta.nombre : "—", p.dorsal ?? ""]);
  const nodos = [el("h3", `Apuntados frente a la lista de salida de ${a.convocatoria.nombre}`)];
  if (resumenSubida) {
    const extra = [];
    if (resumenSubida.menoresExcluidos) extra.push(`${resumenSubida.menoresExcluidos} posibles menores excluidos`);
    if (resumenSubida.descartadas.length) extra.push(`${resumenSubida.descartadas.length} filas descartadas`);
    nodos.push(el("p", `Lista subida: ${resumenSubida.participantes} participantes${extra.length ? ` (${extra.join(", ")})` : ""}.`, { className: "apuntado" }));
  }
  nodos.push(
    el("p", `${a.participantes} en la lista · ${a.enLista} de los apuntados están en ella · ${a.noEnLista} no · ${a.sinApuntarse} participantes no se habían apuntado`, { className: "suave" }),
    a.apuntados.length ? tabla(["Apuntado", "En la lista", "Atleta de la lista", "Dorsal"], filas) : el("p", "Nadie se había apuntado.", { className: "vacio" }),
    el("p", "La coincidencia se hace por nombre: las palabras del nombre del usuario deben aparecer en el del atleta. Revisa a mano los «No».", { className: "suave pequeno" }),
  );
  document.getElementById("detalle-convocatoria").replaceChildren(...nodos);
}

export function mostrarAvisoConvocatorias(texto, correcto = false) {
  const zona = document.getElementById("aviso-convocatorias");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}

// Cuenta atrás, previsión del tiempo y material recomendado de una carrera.
export function mostrarPreparacion(p) {
  const nodos = [el("h3", `Preparar ${p.carrera.nombre}`), el("p", `${textoDias(p.diasRestantes)} · ${formatearFecha(p.carrera.fecha)}${p.carrera.lugar ? ` · ${p.carrera.lugar}` : ""}`, { className: "cuenta-atras" })];
  nodos.push(p.tiempo
    ? el("p", `Previsión: ${textoTiempo(p.tiempo)} (fuente: ${p.tiempo.fuente})`, { className: "prevision" })
    : el("p", p.sinPrevision ?? "", { className: "suave" }));
  if (p.recomendaciones.length) {
    const ul = el("ul", undefined, { className: "lista" });
    p.recomendaciones.forEach((a) => {
      const li = el("li", undefined, { className: "recomendacion" });
      li.append(el("strong", a.nombre), el("span", a.motivo, { className: "suave" }));
      const enlace = el("a", "Buscar y comparar reseñas", { href: a.enlace, target: "_blank", rel: "noopener noreferrer" });
      li.append(enlace);
      ul.append(li);
    });
    nodos.push(el("h4", "Material recomendado"), ul,
      el("p", "Son sugerencias generales según el tiempo; los enlaces abren una búsqueda para que compares productos y reseñas actuales.", { className: "suave pequeno" }));
  }
  document.getElementById("detalle-convocatoria").replaceChildren(...nodos);
}
