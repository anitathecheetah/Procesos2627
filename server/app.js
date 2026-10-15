// Ensambla la aplicación Express: API REST + frontend servido desde el mismo origen.
import express from "express";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearRutasApi } from "./api/rutas.js";
import { crearRepositorioMemoria } from "./data/repositorioMemoria.js";
import { crearServicioUsuarios } from "./logic/usuarios.js";
import { crearCifradorBcrypt } from "./logic/cifrador.js";
import { crearLogger } from "./logger.js";
import { crearServicioSesiones } from "./logic/sesiones.js";
import { crearRepositorioSesionesMemoria } from "./data/repositorioSesionesMemoria.js";

const dirCliente = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client");

// Por defecto se monta con el repositorio en memoria; las pruebas pueden inyectar el suyo.
// Sin servicio de correo todavía: el enlace de confirmación se escribe en el log del servidor.
const logPorDefecto = crearLogger();
const avisarPorLog = (usuario, token) =>
  logPorDefecto.info(`Confirmación de ${usuario.email}: /api/confirmar?token=${token}`);

// El secreto de las cookies sale de SECRETO_SESION. En producción es obligatorio.
function obtenerSecreto() {
  if (process.env.SECRETO_SESION) return process.env.SECRETO_SESION;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta la variable de entorno SECRETO_SESION");
  }
  logPorDefecto.warn("SECRETO_SESION no definido: se usa uno aleatorio (las sesiones se pierden al reiniciar)");
  return randomBytes(32).toString("hex");
}

export function crearApp({
  repositorio = crearRepositorioMemoria(),
  cifrador = crearCifradorBcrypt(),
  notificar = avisarPorLog,
  repositorioSesiones = crearRepositorioSesionesMemoria(),
  secreto = obtenerSecreto(),
  emailAdmin = process.env.ADMIN_EMAIL,
  log = logPorDefecto,
} = {}) {
  const app = express();

  app.use(express.json());

  // API
  const usuarios = crearServicioUsuarios(repositorio, { cifrador, notificar, emailAdmin, log });
  app.locals.usuarios = usuarios; // para tareas de arranque (index.js)
  app.use("/api", crearRutasApi({
    usuarios,
    sesiones: crearServicioSesiones(repositorioSesiones),
    secreto,
    produccion: process.env.NODE_ENV === "production",
  }));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Ruta no encontrada", codigo: "NO_ENCONTRADO" });
  });

  // Frontend (mismo origen que la API)
  app.use(express.static(dirCliente));

  // JSON mal formado en el cuerpo de la petición: 400 en lugar de 500.
  app.use((err, _req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido", codigo: "DATOS_INVALIDOS" });
    }
    next(err);
  });

  // Errores no controlados: siempre JSON {error, codigo}
  app.use((err, _req, res, _next) => {
    log.error("Error no controlado", { mensaje: err.message });
    res.status(500).json({ error: "Error interno del servidor", codigo: "ERROR_INTERNO" });
  });

  return app;
}
