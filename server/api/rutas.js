// Capa API (presentación del backend).
// Traduce peticiones HTTP a llamadas a la capa lógica y devuelve JSON.
// No contiene reglas de negocio ni accede a datos directamente.
import express, { Router } from "express";
import { crearAutenticacion, exigirSesion } from "./autenticacion.js";
import { borrarCookie, crearCookie, firmar } from "./cookies.js";
import { leerCsvSanciones } from "../logic/sanciones.js";
import { validarPassword } from "../logic/politicaPassword.js";

const ESTADO_HTTP = {
  DATOS_INVALIDOS: 400,
  NO_AUTENTICADO: 401,
  PROHIBIDO: 403,
  NO_ENCONTRADO: 404,
  EMAIL_DUPLICADO: 409,
  DUPLICADO: 409,
  CREDENCIALES_INVALIDAS: 401,
  CUENTA_PENDIENTE: 403,
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

export function crearRutasApi({ usuarios, importacion, sanciones, consulta, ranking, sesiones, secreto, produccion = false }) {
  const router = Router();
  const opcionesCookie = { maxAgeSegundos: Math.floor(sesiones.duracionMs / 1000), seguro: produccion };

  // Todas las rutas saben quién es el usuario de la sesión (si la hay).
  router.use(crearAutenticacion({ sesiones, secreto }));

  // Comprobación de que el servidor está vivo.
  router.get("/salud", (_req, res) => {
    res.status(200).json({ estado: "ok" });
  });

  // Política de contraseñas (VARIANTE-1). Pública: no exige sesión.
  router.post("/prueba/password", (req, res) => {
    const password = req.body?.password;
    if (typeof password !== "string") {
      return res.status(400).json({ error: "El campo 'password' es obligatorio y debe ser texto" });
    }
    res.status(200).json(validarPassword(password));
  });

  // Alta de usuario (cualquiera). Queda pendiente de confirmar el email.
  router.post("/usuarios", manejar(async (req, res) => {
    const usuario = await usuarios.alta(req.body ?? {});
    res.status(201).json(usuario);
  }));

  // Confirmación del email (enlace recibido por el usuario). Redirige a la página principal.
  router.get("/confirmar", manejar(async (req, res) => {
    await usuarios.confirmar(req.query.token);
    res.redirect("/?confirmado=1");
  }));

  // Inicio de sesión local: valida credenciales y abre una sesión con cookie firmada.
  router.post("/sesion", manejar(async (req, res) => {
    const usuario = await usuarios.iniciarSesion(req.body ?? {});
    const idSesion = await sesiones.iniciar(usuario.id);
    res.setHeader("Set-Cookie", crearCookie(firmar(idSesion, secreto), opcionesCookie));
    res.status(200).json(usuario);
  }));

  // Sesión actual (la persona que está identificada).
  router.get("/sesion", exigirSesion, manejar(async (req, res) => {
    res.status(200).json(await usuarios.obtener(req.usuarioId));
  }));

  // Cierre de sesión: se invalida en el servidor y se borra la cookie.
  router.delete("/sesion", manejar(async (req, res) => {
    await sesiones.cerrar(req.sesionId);
    res.setHeader("Set-Cookie", borrarCookie(opcionesCookie));
    res.status(204).end();
  }));

  // Listado (solo admin). El solicitante es el usuario de la sesión.
  router.get("/usuarios", exigirSesion, manejar(async (req, res) => {
    res.status(200).json(await usuarios.listar(req.usuarioId));
  }));

  // Consultar si un usuario está activo (solo admin).
  router.get("/usuarios/:id/activo", exigirSesion, manejar(async (req, res) => {
    res.status(200).json(await usuarios.usuarioActivo(req.usuarioId, req.params.id));
  }));

  // Eliminar un usuario (admin o el propio usuario). Eliminación lógica.
  router.delete("/usuarios/:id", exigirSesion, manejar(async (req, res) => {
    await usuarios.eliminar(req.usuarioId, req.params.id);
    res.status(204).end();
  }));

  // Consultas públicas (como la web de resultados): no exigen sesión.
  router.get("/pruebas", manejar(async (req, res) => {
    res.status(200).json(await consulta.listarPruebas({ deporte: req.query.deporte, temporada: req.query.temporada }));
  }));
  router.get("/pruebas/:id", manejar(async (req, res) => {
    res.status(200).json(await consulta.detallePrueba(req.params.id));
  }));
  router.get("/atletas", manejar(async (req, res) => {
    res.status(200).json(await consulta.buscarAtletas(req.query.q));
  }));
  router.get("/atletas/:id", manejar(async (req, res) => {
    res.status(200).json(await consulta.fichaAtleta(req.params.id));
  }));

  // Ranking Elo de un deporte (público, paginado) y su recálculo (solo admin).
  router.get("/ranking/:deporte", manejar(async (req, res) => {
    const { pagina, tamano, minPruebas, sexo } = req.query;
    res.status(200).json(await ranking.ranking(req.params.deporte, { pagina, tamano, minPruebas, sexo }));
  }));
  router.post("/ranking/:deporte/recalcular", exigirSesion, manejar(async (req, res) => {
    res.status(200).json(await ranking.recalcular(req.usuarioId, req.params.deporte));
  }));

  // Importar una clasificación en Excel (solo admin). El archivo va como cuerpo de la petición
  // (.xlsx en binario) y los datos de la prueba en la query: idExterno, nombre, deporte, tipo, fecha, categoria, sexo.
  router.post("/pruebas/importar", exigirSesion, express.raw({ type: () => true, limit: "10mb" }), manejar(async (req, res) => {
    const { idExterno, nombre, deporte, tipo, fecha, categoria, sexo } = req.query;
    const resumen = await importacion.importar(req.usuarioId, { idExterno, nombre, deporte, tipo, fecha, categoria, sexo }, req.body);
    res.status(201).json(resumen);
  }));

  // Cargar las sanciones del acta (solo admin). Cuerpo: CSV de texto (dorsal;accion1;infraccion1;…;observaciones)
  // o JSON { sanciones: [{ dorsal, pares: [{accion, infraccion}], observaciones }] }.
  router.post("/pruebas/:id/sanciones", exigirSesion, express.text({ type: ["text/*"], limit: "1mb" }), manejar(async (req, res) => {
    const filas = typeof req.body === "string" ? leerCsvSanciones(req.body) : req.body?.sanciones;
    res.status(201).json(await sanciones.cargar(req.usuarioId, req.params.id, filas));
  }));

  // Sanciones de una prueba (públicas, como los resultados).
  router.get("/pruebas/:id/sanciones", manejar(async (req, res) => {
    res.status(200).json(await sanciones.deLaPrueba(req.params.id));
  }));

  return router;
}
