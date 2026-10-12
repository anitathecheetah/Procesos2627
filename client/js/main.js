// Punto de entrada del frontend: conecta la interfaz (ui.js) con el cliente de API (api.js).
import { salud } from "./api.js";
import { mostrarEstado } from "./ui.js";

try {
  const respuesta = await salud();
  mostrarEstado(`Servidor: ${respuesta.estado}`);
} catch (error) {
  mostrarEstado(`No se pudo contactar con el servidor: ${error.message}`, false);
}
