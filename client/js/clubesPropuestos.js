// Administración: clubes escritos a mano en los perfiles que aún no están en la lista. Los valida el administrador.
import { clubesPropuestos, clubesParaElegir, resolverClubPropuesto } from "./api.js";
import { mostrarMensaje } from "./ui.js";
import { el } from "./dom.js";
import { esDelCatalogo } from "./solicitudClub.js";

// Cuerpo de la resolución: `unir` es el id de un club de la lista ("" = dejarlo como está escrito).
export const cuerpoClubPropuesto = (nombre, { unir = "", nombreClub = "", descartar = false } = {}) =>
  descartar ? { nombre, descartar: true } : unir ? { nombre, clubId: unir } : { nombre, nombreClub: nombreClub.trim() || nombre };

async function pintar() {
  const zona = document.getElementById("clubes-propuestos");
  const [lista, clubes] = await Promise.all([clubesPropuestos(), clubesParaElegir()]);
  if (!lista.length) return zona.replaceChildren(el("p", "No hay clubes pendientes de validar.", { className: "vacio" }));
  zona.replaceChildren(...lista.map((c) => {
    const nombre = el("input", undefined, { type: "text", value: c.nombre, maxLength: 80, ariaLabel: "Nombre del club" });
    const unir = el("select", undefined, { ariaLabel: "Unir a un club de la lista" });
    unir.append(el("option", "Crear como club nuevo", { value: "" }), ...clubes.map((x) => el("option", `Unir a: ${x.nombre}${esDelCatalogo(x.id) ? "" : " ✓"}`, { value: x.id })));
    unir.addEventListener("change", () => { nombre.hidden = Boolean(unir.value); });
    const resolver = async (descartar) => {
      try {
        await resolverClubPropuesto(cuerpoClubPropuesto(c.nombre, { unir: unir.value, nombreClub: nombre.value, descartar }));
        await pintar();
      } catch (error) { mostrarMensaje(error.message, false); }
    };
    const validar = el("button", "Validar", { type: "button" });
    const descartar = el("button", "Descartar", { type: "button" });
    validar.addEventListener("click", () => resolver(false));
    descartar.addEventListener("click", () => resolver(true));
    const fila = el("div", undefined, { className: "recomendacion" });
    fila.append(el("strong", c.nombre), el("span", `escrito en ${c.usuarios} perfil${c.usuarios === 1 ? "" : "es"}`, { className: "suave" }), nombre, unir, validar, descartar);
    return fila;
  }));
}

export async function cargarClubesPropuestos(usuario) {
  const esAdmin = usuario?.rol === "admin";
  document.getElementById("zona-clubes-propuestos").hidden = !esAdmin;
  if (!esAdmin) return;
  try { await pintar(); } catch (error) { mostrarMensaje(error.message || "No se pudieron cargar los clubes propuestos.", false); }
}
