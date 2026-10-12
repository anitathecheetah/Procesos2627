// Ensambla la aplicación Express: API REST + frontend servido desde el mismo origen.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearRutasApi } from "./api/rutas.js";
import { crearRepositorioMemoria } from "./data/repositorioMemoria.js";
import { crearServicioUsuarios } from "./logic/usuarios.js";

const dirCliente = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client");

// Por defecto se monta con el repositorio en memoria; las pruebas pueden inyectar el suyo.
export function crearApp({ repositorio = crearRepositorioMemoria() } = {}) {
  const app = express();

  app.use(express.json());

  // API
  app.use("/api", crearRutasApi({ usuarios: crearServicioUsuarios(repositorio) }));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Ruta no encontrada", codigo: "NO_ENCONTRADO" });
  });

  // Frontend (mismo origen que la API)
  app.use(express.static(dirCliente));

  // Errores no controlados: siempre JSON {error, codigo}
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor", codigo: "ERROR_INTERNO" });
  });

  return app;
}
