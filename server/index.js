// Punto de entrada del backend: elige el almacenamiento según el entorno y arranca el servidor HTTP.
import { crearApp } from "./app.js";

const PORT = process.env.PORT || 3000;
const { MONGODB_URI, MONGODB_DB = "procesos", NODE_ENV } = process.env;

let baseDatos = null;
let opciones = {};

if (MONGODB_URI) {
  // Con MONGODB_URI los datos van a MongoDB (persisten entre reinicios).
  const { conectarBaseDatos } = await import("./data/conexion.js");
  baseDatos = await conectarBaseDatos(MONGODB_URI, MONGODB_DB);
  opciones = { repositorio: baseDatos.repositorio, repositorioSesiones: baseDatos.repositorioSesiones };
  console.log("Almacenamiento: MongoDB");
} else if (NODE_ENV === "production") {
  throw new Error("Falta la variable de entorno MONGODB_URI");
} else {
  console.warn("MONGODB_URI no definido: los datos se guardan en memoria y se pierden al reiniciar");
}

const app = crearApp(opciones);
if (await app.locals.usuarios.asegurarAdministrador()) console.log("Administrador inicial confirmado (ADMIN_EMAIL)");

const servidor = app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

// Cloud Run envía SIGTERM al parar una revisión: se cierra con orden.
process.on("SIGTERM", () => {
  servidor.close(async () => {
    await baseDatos?.cerrar();
    process.exit(0);
  });
});
