// Secciones de la web y enrutado por la parte # de la dirección (#/rankings).
// Módulo puro: no toca el DOM, así se puede probar sin navegador.

export const SECCIONES = [
  { id: "inicio", titulo: "Inicio", icono: "🏠" },
  { id: "carreras", titulo: "Carreras", icono: "🏁" },
  { id: "rankings", titulo: "Rankings", icono: "🏆" },
  { id: "prediccion", titulo: "Predicción", icono: "🔮" },
  { id: "proximas", titulo: "Próximas carreras", icono: "📅" },
  { id: "cuenta", titulo: "Mi perfil", icono: "👤" },
  { id: "admin", titulo: "Admin", icono: "🛠️", soloAdmin: true },
];

export const SECCION_POR_DEFECTO = "inicio";

export function hashDeSeccion(id) {
  return `#/${id}`;
}

// Sección que corresponde a una dirección. Si no existe, o es de administrador y la persona
// no lo es, se muestra la de por defecto (sin cambiar la dirección: al iniciar sesión se reevalúa).
export function seccionDeHash(hash, { esAdmin = false } = {}) {
  const id = String(hash ?? "").replace(/^#\/?/, "").split(/[/?#]/)[0];
  const seccion = SECCIONES.find((s) => s.id === id);
  if (!seccion || (seccion.soloAdmin && !esAdmin)) return SECCION_POR_DEFECTO;
  return seccion.id;
}

export function seccionesVisibles({ esAdmin = false } = {}) {
  return SECCIONES.filter((s) => !s.soloAdmin || esAdmin);
}

export function tituloDeSeccion(id) {
  return SECCIONES.find((s) => s.id === id)?.titulo ?? "";
}
