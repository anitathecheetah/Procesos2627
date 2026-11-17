// Presentación de las próximas carreras: solo construye el DOM. No hace peticiones (eso es api.js).
import { el, tabla, formatearFecha } from "./dom.js";

const DEPORTES = { duatlon: "Duatlón", triatlon: "Triatlón" };
const ESTADOS = { abierta: "Abierta", celebrada: "Celebrada" };

function boton(texto, alPulsar, clase = "secundario") {
  const b = el("button", texto, { type: "button", className: clase });
  b.addEventListener("click", alPulsar);
  return b;
}

// usuario: persona con sesión o null. acciones: { alApuntarse, alDesapuntarse, alVerApuntados, alVincular, alVerAsistencia, alEliminar }.
export function mostrarConvocatorias(carreras, usuario, acciones) {
  const lista = document.getElementById("lista-convocatorias");
  if (!carreras.length) {
    lista.replaceChildren(el("li", "Todavía no hay carreras convocadas.", { className: "vacio" }));
    return;
  }
  const esAdmin = usuario?.rol === "admin";
  lista.replaceChildren(...carreras.map((c) => {
    const abierta = c.estado === "abierta";
    const li = el("li", undefined, { className: "convocatoria" });
    const datos = el("div", undefined, { className: "convocatoria-datos" });
    datos.append(
      el("strong", c.nombre),
      el("span", `${formatearFecha(c.fecha)} · ${DEPORTES[c.deporte] ?? c.deporte}${c.lugar ? ` · ${c.lugar}` : ""}`, { className: "suave" }),
      el("span", `${c.apuntados} ${c.apuntados === 1 ? "apuntado" : "apuntados"} · ${ESTADOS[c.estado] ?? c.estado}`, { className: "suave" }),
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
    if (esAdmin) {
      botones.append(boton("Ver apuntados", () => acciones.alVerApuntados(c)));
      botones.append(boton(abierta ? "Vincular listado real" : "Cambiar listado real", () => acciones.alVincular(c)));
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

// pruebas: pruebas importadas del mismo deporte (más recientes primero).
export function mostrarFormularioVincular(carrera, pruebas, alVincular) {
  const zona = document.getElementById("detalle-convocatoria");
  if (!pruebas.length) {
    zona.replaceChildren(el("h3", `Listado real de ${carrera.nombre}`), el("p", `Primero importa el listado real de la federación como una prueba de ${DEPORTES[carrera.deporte] ?? carrera.deporte}.`, { className: "vacio" }));
    return;
  }
  const selector = el("select");
  pruebas.forEach((p) => selector.append(el("option", `${p.nombre} (${formatearFecha(p.fecha)})`, { value: p.id })));
  const etiqueta = el("label", "Prueba importada con el listado real");
  etiqueta.append(selector);
  zona.replaceChildren(
    el("h3", `Listado real de ${carrera.nombre}`),
    el("p", "Al vincularlo, la carrera pasa a «celebrada», deja de admitir inscripciones y se compara quién de los apuntados participó.", { className: "suave" }),
    etiqueta,
    boton("Vincular", () => alVincular(carrera, selector.value), ""),
  );
}

export function mostrarAsistencia(a) {
  const filas = a.apuntados.map((p) => [
    p.nombre,
    p.participo ? "Sí" : "No",
    p.atleta ? p.atleta.nombre : "—",
    p.participo ? (p.posicion ?? p.estado.toUpperCase()) : "",
  ]);
  document.getElementById("detalle-convocatoria").replaceChildren(
    el("h3", `Asistencia a ${a.convocatoria.nombre}`),
    el("p", `Listado real: ${a.prueba.nombre} (${formatearFecha(a.prueba.fecha)}) · ${a.participantes} participantes · ${a.participaron} de los apuntados participaron · ${a.noParticiparon} no · ${a.sinApuntarse} participantes no se habían apuntado`, { className: "suave" }),
    a.apuntados.length ? tabla(["Apuntado", "Participó", "Atleta del listado", "Puesto"], filas) : el("p", "Nadie se había apuntado.", { className: "vacio" }),
    el("p", "La coincidencia se hace por nombre: las palabras del nombre del usuario deben aparecer en el del atleta. Revisa a mano los «No».", { className: "suave pequeno" }),
  );
}

export function mostrarAvisoConvocatorias(texto, correcto = false) {
  const zona = document.getElementById("aviso-convocatorias");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}
