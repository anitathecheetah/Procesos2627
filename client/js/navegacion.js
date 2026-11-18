// Barra lateral y paneles: muestra solo el panel de la sección elegida (DOM).
// La lógica de qué sección toca vive en rutas.js.
import { seccionDeHash, seccionesVisibles, hashDeSeccion, tituloDeSeccion } from "./rutas.js";

let esAdmin = false;

function pintarEnlaces() {
  const lista = document.getElementById("menu-secciones");
  lista.replaceChildren(
    ...seccionesVisibles({ esAdmin }).map((s) => {
      const elemento = document.createElement("li");
      const enlace = document.createElement("a");
      enlace.href = hashDeSeccion(s.id);
      enlace.dataset.seccion = s.id;
      const icono = document.createElement("span");
      icono.className = "menu-icono";
      icono.setAttribute("aria-hidden", "true");
      icono.textContent = s.icono;
      enlace.append(icono, document.createTextNode(s.titulo));
      elemento.append(enlace);
      return elemento;
    })
  );
}

function mostrarSeccion() {
  const activa = seccionDeHash(location.hash, { esAdmin });
  for (const panel of document.querySelectorAll(".panel[data-seccion]")) {
    panel.hidden = panel.dataset.seccion !== activa;
  }
  for (const enlace of document.querySelectorAll("#menu-secciones a")) {
    if (enlace.dataset.seccion === activa) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  }
  document.title = activa === "inicio" ? "Procesos 26-27" : `${tituloDeSeccion(activa)} · Procesos 26-27`;
  cerrarMenu();
}

function cerrarMenu() {
  document.getElementById("barra-lateral").classList.remove("abierta");
  document.getElementById("boton-menu").setAttribute("aria-expanded", "false");
}

export function iniciarNavegacion() {
  pintarEnlaces();
  mostrarSeccion();
  window.addEventListener("hashchange", () => {
    mostrarSeccion();
    window.scrollTo(0, 0);
  });
  document.getElementById("boton-menu").addEventListener("click", () => {
    const abierta = document.getElementById("barra-lateral").classList.toggle("abierta");
    document.getElementById("boton-menu").setAttribute("aria-expanded", String(abierta));
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") cerrarMenu();
  });
}

// Al iniciar o cerrar sesión cambia qué secciones se ven (Admin solo para administradores).
export function alCambiarSesionNavegacion(usuario) {
  esAdmin = usuario?.rol === "admin";
  pintarEnlaces();
  mostrarSeccion();
}
