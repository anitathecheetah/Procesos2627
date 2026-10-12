// Middleware de autenticación: lee la cookie de sesión y deja el usuario en req.usuarioId.
// Las reglas de rol (admin / propio usuario) viven en la capa lógica, que responde 401/403/404.
import { NOMBRE_COOKIE, leerCookie, verificar } from "./cookies.js";

export function crearAutenticacion({ sesiones, secreto }) {
  return async function autenticar(req, _res, next) {
    try {
      req.sesionId = verificar(leerCookie(req, NOMBRE_COOKIE), secreto);
      req.usuarioId = (await sesiones.resolver(req.sesionId)) ?? undefined;
      next();
    } catch (e) {
      next(e);
    }
  };
}

// Corta con 401 las rutas que exigen haber iniciado sesión.
export function exigirSesion(req, res, next) {
  if (!req.usuarioId) {
    return res.status(401).json({ error: "Debes iniciar sesión", codigo: "NO_AUTENTICADO" });
  }
  next();
}
