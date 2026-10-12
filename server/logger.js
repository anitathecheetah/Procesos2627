// Logger sencillo con niveles. LOG_LEVEL: debug, info (por defecto), warn, error o silencio.
// Nunca se deben pasar contraseñas ni hashes en los datos.
const NIVELES = { debug: 10, info: 20, warn: 30, error: 40, silencio: 100 };

export function crearLogger({ nivel = process.env.LOG_LEVEL ?? "info", salida = console } = {}) {
  const minimo = NIVELES[nivel] ?? NIVELES.info;
  const escribir = (nombre, mensaje, datos) => {
    if (NIVELES[nombre] < minimo) return;
    const linea = `${new Date().toISOString()} ${nombre.toUpperCase()} ${mensaje}${datos ? " " + JSON.stringify(datos) : ""}`;
    (nombre === "error" ? salida.error : nombre === "warn" ? salida.warn : salida.log)(linea);
  };
  return {
    debug: (m, d) => escribir("debug", m, d),
    info: (m, d) => escribir("info", m, d),
    warn: (m, d) => escribir("warn", m, d),
    error: (m, d) => escribir("error", m, d),
  };
}

export const loggerSilencioso = crearLogger({ nivel: "silencio" });
