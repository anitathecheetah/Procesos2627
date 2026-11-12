// Lectura de las clasificaciones en Excel publicadas por la federación (una hoja, una fila por atleta).
// Estructura: ... NACIMIENTO | 5 parciales | POSICION | POSICION_FINAL | ESTADO | TIEMPO | (más columnas que se ignoran).
// OJO: en algunos ficheros las filas con un parcial vacío vienen con las celdas desplazadas a la izquierda,
// así que las columnas de resultado no se leen por posición fija sino por el contenido de cada celda.
import readXlsxFile from "read-excel-file/node";
import { ErrorLogica } from "./errores.js";
import { estadoDesdeTexto, ESTADOS_RESULTADO } from "./catalogos.js";

const COLUMNAS_OBLIGATORIAS = ["NOMBRE", "CLUB", "DORSAL", "NACIMIENTO", "TIEMPO"];
const PARCIALES_ESPERADOS = 5; // duatlón: carrera, T1, bici, T2, carrera · triatlón: natación, T1, bici, T2, carrera
const MARCADOR_NO_CLASIFICADO = 10000;
const TIEMPO = /^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d+))?$/;

export const aSegundos = (texto) => {
  const m = TIEMPO.exec(String(texto).trim());
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(`0.${m[4]}`) : 0);
};

const vacio = (v) => v === null || v === undefined || String(v).trim() === "";

// Lee el .xlsx (Buffer) y devuelve { cabecera, filas } con las filas como arrays de celdas.
export async function leerFilasExcel(buffer) {
  let hojas;
  try {
    hojas = await readXlsxFile(buffer);
  } catch {
    throw new ErrorLogica("DATOS_INVALIDOS", "El archivo no es un Excel (.xlsx) válido");
  }
  const datos = hojas?.[0]?.data;
  if (!datos || datos.length < 2) throw new ErrorLogica("DATOS_INVALIDOS", "El Excel no tiene resultados");
  const cabecera = datos[0].map((c) => String(c ?? "").trim().toUpperCase());
  const faltan = COLUMNAS_OBLIGATORIAS.filter((c) => !cabecera.includes(c));
  if (faltan.length) throw new ErrorLogica("DATOS_INVALIDOS", `Faltan columnas en el Excel: ${faltan.join(", ")}`);
  return { cabecera, filas: datos.slice(1) };
}

// Convierte una fila en un resultado, o explica por qué se descarta: { ok, resultado | motivo }.
export function filaAResultado(fila, cabecera) {
  const col = (nombre) => cabecera.indexOf(nombre);
  const nombre = fila[col("NOMBRE")];
  if (vacio(nombre)) return { ok: false, vacia: true, motivo: "fila sin nombre" };

  const anio = vacio(fila[col("NACIMIENTO")]) ? NaN : Number(fila[col("NACIMIENTO")]);
  if (!Number.isInteger(anio) || anio < 1900) return { ok: false, motivo: "sin año de nacimiento" };

  const zona = fila.slice(col("NACIMIENTO") + 1, col("TIEMPO") + 1).filter((v) => !vacio(v));
  const tiempos = [];
  const enteros = [];
  let estado = ESTADOS_RESULTADO.FINALIZADO;
  for (const v of zona) {
    const texto = String(v).trim();
    if (aSegundos(texto) !== null) tiempos.push(aSegundos(texto));
    else if (/^\d+$/.test(texto)) enteros.push(Number(texto));
    else {
      const e = estadoDesdeTexto(texto);
      if (!e) return { ok: false, motivo: `estado desconocido: ${texto}` };
      estado = e;
    }
  }

  const avisos = [];
  let posicion = null;
  let tiempoTotal = null;
  let parciales = tiempos;

  // Sin texto de estado, un atleta sin clasificar se reconoce porque su posición es un marcador
  // (10065, 10066…) o no tiene tiempo total: sin parciales no salió (DNS); con parciales abandonó (DNF).
  if (estado === ESTADOS_RESULTADO.FINALIZADO && (enteros.at(-1) >= MARCADOR_NO_CLASIFICADO || tiempos.length === 0)) {
    estado = tiempos.length === 0 ? ESTADOS_RESULTADO.DNS : ESTADOS_RESULTADO.DNF;
    avisos.push(`estado inferido (${estado}): sin clasificar`);
  }

  if (estado === ESTADOS_RESULTADO.FINALIZADO) {
    if (tiempos.length < 2) return { ok: false, motivo: "finalizado sin tiempo total" };
    if (!enteros.length) return { ok: false, motivo: "finalizado sin posición" };
    tiempoTotal = tiempos.at(-1);
    parciales = tiempos.slice(0, -1);
    // POSICION deja fuera a los invitados; POSICION_FINAL (la última) es el orden real de llegada.
    posicion = enteros.at(-1);
    if (parciales.length !== PARCIALES_ESPERADOS) {
      avisos.push(`parciales incompletos (${parciales.length} de ${PARCIALES_ESPERADOS})`);
      parciales = null; // no se sabe cuál falta: no se guarda ninguno mal colocado
    }
  }

  return {
    ok: true,
    resultado: {
      dorsal: vacio(fila[col("DORSAL")]) ? null : String(fila[col("DORSAL")]).trim(),
      nombre: String(nombre).trim(),
      anioNacimiento: anio,
      club: vacio(fila[col("CLUB")]) ? null : String(fila[col("CLUB")]).trim(),
      posicion,
      estado,
      tiempoTotal,
      parciales,
      ...(/\(invitad[oa]\)/i.test(String(nombre)) ? { invitado: true } : {}),
      avisos,
    },
  };
}

// Todo el fichero: { resultados, descartadas: [{ fila, motivo }] } (fila = número de fila en el Excel).
export async function leerResultados(buffer) {
  const { cabecera, filas } = await leerFilasExcel(buffer);
  const resultados = [];
  const descartadas = [];
  filas.forEach((fila, i) => {
    const r = filaAResultado(fila, cabecera);
    if (r.ok) resultados.push(r.resultado);
    else if (!r.vacia) descartadas.push({ fila: i + 2, motivo: r.motivo });
  });
  return { resultados, descartadas };
}
