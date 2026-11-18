// Cliente de comunicación con el servidor.
// Es la única parte del frontend que hace peticiones HTTP a la API.
// No toca el DOM: de eso se encarga la interfaz (ui.js).

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
  }
}

async function peticion(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  if (respuesta.status === 204) return null;

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // Respuesta sin JSON (no debería ocurrir en esta API).
  }

  if (!respuesta.ok) {
    const mensaje = datos?.error || `Error inesperado del servidor (${respuesta.status})`;
    throw new ErrorApi(respuesta.status, datos?.codigo, mensaje);
  }
  return datos;
}

// --- Servidor ---
export const salud = () => peticion("GET", "/salud");

export const registrar = (datos) => peticion("POST", "/usuarios", datos);
export const iniciarSesion = (datos) => peticion("POST", "/sesion", datos);
export const sesionActual = () => peticion("GET", "/sesion");
export const cerrarSesion = () => peticion("DELETE", "/sesion");
export const listarUsuarios = () => peticion("GET", "/usuarios");
export const eliminarUsuario = (id) => peticion("DELETE", `/usuarios/${id}`);
export const cambiarPassword = (datos) => peticion("PUT", "/usuarios/yo/password", datos);

// --- Resultados (consultas públicas) ---
export const listarPruebas = (deporte) => peticion("GET", `/pruebas${deporte ? `?deporte=${encodeURIComponent(deporte)}` : ""}`);
export const detallePrueba = (id) => peticion("GET", `/pruebas/${encodeURIComponent(id)}`);
export const buscarAtletas = (q) => peticion("GET", `/atletas?q=${encodeURIComponent(q)}`);
export const fichaAtleta = (id) => peticion("GET", `/atletas/${encodeURIComponent(id)}`);

// --- Ranking Elo ---
export const ranking = (deporte, sexo, pagina = 1, comunidad = "") =>
  peticion("GET", `/ranking/${encodeURIComponent(deporte)}?pagina=${pagina}&tamano=25${sexo ? `&sexo=${sexo}` : ""}${comunidad ? `&comunidad=${encodeURIComponent(comunidad)}` : ""}`);
export const comunidades = () => peticion("GET", "/comunidades");
export const rankingClubes = (deporte, sexo, pagina = 1) =>
  peticion("GET", `/ranking/${encodeURIComponent(deporte)}/clubes?pagina=${pagina}&tamano=25${sexo ? `&sexo=${sexo}` : ""}`);
export const recalcularRanking = (deporte) => peticion("POST", `/ranking/${encodeURIComponent(deporte)}/recalcular`);

// --- Predicción de una carrera ---
// opciones: { base (id de prueba) | convocatoria (id de carrera con lista de salida), sexo, retrospectiva }
export const prediccion = (deporte, { base, convocatoria, sexo, retrospectiva } = {}) => {
  const params = new URLSearchParams();
  if (convocatoria) params.set("convocatoria", convocatoria);
  else if (base) params.set("base", base);
  else if (sexo) params.set("sexo", sexo);
  if (base && retrospectiva) params.set("retrospectiva", "true");
  const consulta = params.toString();
  return peticion("GET", `/prediccion/${encodeURIComponent(deporte)}${consulta ? `?${consulta}` : ""}`);
};

// --- Próximas carreras e inscripciones ---
export const listarConvocatorias = () => peticion("GET", "/convocatorias");
export const crearConvocatoria = (datos) => peticion("POST", "/convocatorias", datos);
export const eliminarConvocatoria = (id) => peticion("DELETE", `/convocatorias/${encodeURIComponent(id)}`);
export const apuntarse = (id, nombre) => peticion("PUT", `/convocatorias/${encodeURIComponent(id)}/inscripcion`, { nombre });
export const desapuntarse = (id) => peticion("DELETE", `/convocatorias/${encodeURIComponent(id)}/inscripcion`);
export const apuntadosDe = (id) => peticion("GET", `/convocatorias/${encodeURIComponent(id)}/inscripciones`);
export const listaSalidaDe = (id) => peticion("GET", `/convocatorias/${encodeURIComponent(id)}/salida`);
// Sube el Excel de la lista de salida (cuerpo binario, no JSON). sexo: M, F o "".
export async function subirListaSalida(id, archivo, sexo) {
  const respuesta = await fetch(`/api/convocatorias/${encodeURIComponent(id)}/salida${sexo ? `?sexo=${sexo}` : ""}`, {
    method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: archivo,
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos?.codigo, datos?.error || `Error inesperado del servidor (${respuesta.status})`);
  return datos;
}
export const preparacionDe = (id) => peticion("GET", `/convocatorias/${encodeURIComponent(id)}/preparacion`);
export const asistenciaDe = (id) => peticion("GET", `/convocatorias/${encodeURIComponent(id)}/asistencia`);
