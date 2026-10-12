// Capa API (presentación del backend).
// Traduce peticiones HTTP a llamadas a la capa lógica y devuelve JSON.
// No contiene reglas de negocio ni accede a datos directamente.
import { Router } from "express";

export function crearRutasApi() {
  const router = Router();

  // Comprobación de que el servidor está vivo.
  router.get("/salud", (_req, res) => {
    res.status(200).json({ estado: "ok" });
  });

  return router;
}
