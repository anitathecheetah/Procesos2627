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
