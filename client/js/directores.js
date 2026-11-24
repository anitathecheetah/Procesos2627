// Directores de club (PBI-55): solicitud en la cuenta, resolución por el administrador y panel del club.
import { clubesParaElegir, solicitarDirector, miSolicitudDirector, solicitudesPendientes, resolverSolicitud, panelDelClub } from "./api.js";
import { alEnviar, mostrarMensaje } from "./ui.js";
import { el, tabla } from "./dom.js";
import { OTRO_CLUB, cuerpoSolicitud, textoEstadoSolicitud } from "./solicitudClub.js";

const DEPORTES = { duatlon: "Duatlón", triatlon: "Triatlón" };
const formulario = document.getElementById("form-director");
const selector = formulario.elements.club;
const nombreNuevo = formulario.elements.nombreClub;
const etiquetaNombre = document.getElementById("etiqueta-club-nuevo");

const actualizarNombre = () => { etiquetaNombre.hidden = selector.value !== OTRO_CLUB; };
selector.addEventListener("change", actualizarNombre);

function pintarPanel(p) {
  const zona = document.getElementById("panel-club");
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

async function pintarSolicitudesAdmin() {
  const zona = document.getElementById("solicitudes-club");
  const lista = await solicitudesPendientes();
  if (!lista.length) return zona.replaceChildren(el("p", "No hay solicitudes de director pendientes.", { className: "vacio" }));
  zona.replaceChildren(...lista.map((s) => {
    const nombre = el("input", undefined, { type: "text", value: s.nombreClub, maxLength: 80, ariaLabel: "Nombre del club" });
    nombre.hidden = !s.clubNuevo;
    const resolver = async (aprobar) => {
      try {
        await resolverSolicitud(s.id, aprobar ? { aprobar: true, ...(s.clubNuevo ? { nombreClub: nombre.value } : {}) } : { aprobar: false });
        await pintarSolicitudesAdmin();
      } catch (error) { mostrarMensaje(error.message, false); }
    };
    const aprobar = el("button", "Aprobar", { type: "button" });
    const rechazar = el("button", "Rechazar", { type: "button" });
    aprobar.addEventListener("click", () => resolver(true));
    rechazar.addEventListener("click", () => resolver(false));
    const li = el("div", undefined, { className: "recomendacion" });
    li.append(el("strong", `${s.solicitante?.nombre ?? "?"} (${s.solicitante?.email ?? ""})`), el("span", `quiere ser director de: ${s.nombreClub}${s.clubNuevo ? " (club nuevo)" : ""}`, { className: "suave" }), nombre, aprobar, rechazar);
    return li;
  }));
}

let usuarioActual = null;

export async function cargarDirectores(usuario) {
  usuarioActual = usuario;
  document.getElementById("zona-director").hidden = !usuario;
  document.getElementById("zona-solicitudes-club").hidden = usuario?.rol !== "admin";
  if (!usuario) return pintarPanel(null);
  try {
    const [clubes, solicitud] = await Promise.all([clubesParaElegir(), miSolicitudDirector()]);
    selector.replaceChildren(
      ...clubes.map((c) => el("option", c.nombre, { value: c.id })),
      el("option", "Mi club no está en la lista", { value: OTRO_CLUB }),
    );
    actualizarNombre();
    document.getElementById("estado-director").textContent = textoEstadoSolicitud(solicitud);
    formulario.hidden = solicitud && solicitud.estado !== "rechazada";
    pintarPanel(solicitud?.estado === "aprobada" ? await panelDelClub() : null);
    if (usuario.rol === "admin") await pintarSolicitudesAdmin();
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo cargar la parte de director de club.", false, formulario);
  }
}

alEnviar(formulario, async (datos, form) => {
  try {
    await solicitarDirector(cuerpoSolicitud({ club: datos.club, nombreClub: datos.nombreClub }));
    mostrarMensaje("Solicitud enviada. El administrador la revisará.", true, form);
    nombreNuevo.value = "";
    await cargarDirectores(usuarioActual);
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo enviar la solicitud.", false, form);
  }
});
