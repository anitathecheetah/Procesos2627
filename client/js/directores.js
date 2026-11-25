// Directores de club (PBI-55): solicitud en la cuenta, resolución por el administrador y panel del club.
import { clubesParaElegir, solicitarDirector, miSolicitudDirector, solicitudesPendientes, resolverSolicitud, panelDelClub } from "./api.js";
import { alEnviar, mostrarMensaje } from "./ui.js";
import { el, tabla } from "./dom.js";
import { pintarPanelClub } from "./vistaPanelClub.js";
import { OTRO_CLUB, cuerpoSolicitud, cuerpoResolucion, esDelCatalogo, textoEstadoSolicitud } from "./solicitudClub.js";

const formulario = document.getElementById("form-director");
const selector = formulario.elements.club;
const nombreNuevo = formulario.elements.nombreClub;
const etiquetaNombre = document.getElementById("etiqueta-club-nuevo");

const actualizarNombre = () => { etiquetaNombre.hidden = selector.value !== OTRO_CLUB; };
selector.addEventListener("change", actualizarNombre);

const pintarPanel = (p) => pintarPanelClub(document.getElementById("panel-club"), p);

async function pintarSolicitudesAdmin() {
  const zona = document.getElementById("solicitudes-club");
  const [lista, clubes] = await Promise.all([solicitudesPendientes(), clubesParaElegir()]);
  const existentes = clubes.filter((c) => !esDelCatalogo(c.id)); // clubes que ya tienen resultados o datos en la app
  if (!lista.length) return zona.replaceChildren(el("p", "No hay solicitudes de director pendientes.", { className: "vacio" }));
  zona.replaceChildren(...lista.map((s) => {
    const nombre = el("input", undefined, { type: "text", value: s.nombreClub, maxLength: 80, ariaLabel: "Nombre del club" });
    nombre.hidden = !s.clubNuevo;
    // Unir a un club que ya existe (mismo club escrito de otra forma): solo si la solicitud no apunta ya a uno.
    const unir = el("select", undefined, { ariaLabel: "Unir a un club existente" });
    unir.append(el("option", s.clubNuevo ? "Crear club nuevo" : "Club del catálogo (se crea al aprobar)", { value: "" }), ...existentes.map((c) => el("option", `Unir a: ${c.nombre}`, { value: c.id })));
    unir.hidden = Boolean(s.clubId);
    unir.addEventListener("change", () => { nombre.hidden = !s.clubNuevo || Boolean(unir.value); });
    const resolver = async (aprobar) => {
      try {
        await resolverSolicitud(s.id, aprobar ? cuerpoResolucion(s, { clubId: unir.value, nombreClub: nombre.value }) : { aprobar: false });
        await pintarSolicitudesAdmin();
      } catch (error) { mostrarMensaje(error.message, false); }
    };
    const aprobar = el("button", "Aprobar", { type: "button" });
    const rechazar = el("button", "Rechazar", { type: "button" });
    aprobar.addEventListener("click", () => resolver(true));
    rechazar.addEventListener("click", () => resolver(false));
    const li = el("div", undefined, { className: "recomendacion" });
    li.append(el("strong", `${s.solicitante?.nombre ?? "?"} (${s.solicitante?.email ?? ""})`), el("span", `quiere ser director de: ${s.nombreClub}${s.clubNuevo ? " (club nuevo)" : ""}`, { className: "suave" }), nombre, unir, aprobar, rechazar);
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
      ...clubes.map((c) => el("option", c.comunidad ? `${c.nombre} (${c.comunidad})` : c.nombre, { value: c.id })),
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
