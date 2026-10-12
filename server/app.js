// Ensambla la aplicación Express: API REST + frontend servido desde el mismo origen.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearRutasApi } from "./api/rutas.js";

const dirCliente = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client");

export function crearApp() {
  const app = express();

  app.use(express.json());

  // API
  app.use("/api", crearRutasApi());
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
