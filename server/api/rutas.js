// Capa API (presentación del backend).
// Traduce peticiones HTTP a llamadas a la capa lógica y devuelve JSON.
// No contiene reglas de negocio ni accede a datos directamente.
import { Router } from "express";

const ESTADO_HTTP = {
  DATOS_INVALIDOS: 400,
  NO_AUTENTICADO: 401,
  PROHIBIDO: 403,
  NO_ENCONTRADO: 404,
  EMAIL_DUPLICADO: 409,
};

// Envuelve un manejador async y traduce los errores de la lógica a {error, codigo}.
const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    const estado = ESTADO_HTTP[e.codigo];
    if (!estado) return next(e);
    res.status(estado).json({ error: e.message, codigo: e.codigo });
  }
};

export function crearRutasApi({ usuarios }) {
  const router = Router();

  // Comprobación de que el servidor está vivo.
  router.get("/salud", (_req, res) => {
    res.status(200).json({ estado: "ok" });
  });

  // Alta de usuario (cualquiera). Queda pendiente de confirmar el email.
  router.post("/usuarios", manejar(async (req, res) => {
    const usuario = await usuarios.alta(req.body ?? {});
    res.status(201).json(usuario);
  }));

  // Listado (solo admin). Hito 1: el solicitante llega en la cabecera X-Usuario-Id
  // (provisional; en el hito 2 se sustituye por la sesión).
  router.get("/usuarios", manejar(async (req, res) => {
    res.status(200).json(await usuarios.listar(req.get("X-Usuario-Id")));
  }));

  return router;
}
