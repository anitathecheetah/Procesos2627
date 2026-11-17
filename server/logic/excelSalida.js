// Lectura de la lista de salida (Excel) que publica la federación antes de la carrera: una hoja, una fila por atleta.
// Columnas (por el nombre de la cabecera): NOMBRE y NACIMIENTO obligatorias; CLUB y DORSAL opcionales.
// Las demás columnas (EVENTO, PHASE, ID, TIEMPO...) se ignoran, así sirve el mismo formato de las clasificaciones.
import readXlsxFile from "read-excel-file/node";
import { ErrorLogica } from "./errores.js";

const vacio = (v) => v === null || v === undefined || String(v).trim() === "";

// Devuelve { participantes: [{ nombre, anioNacimiento, club, dorsal }], descartadas: [{ fila, motivo }] }.
export async function leerListaSalida(buffer) {
  let hojas;
  try {
    hojas = await readXlsxFile(buffer);
  } catch {
    throw new ErrorLogica("DATOS_INVALIDOS", "El archivo no es un Excel (.xlsx) válido");
  }
  const datos = hojas?.[0]?.data;
  if (!datos || datos.length < 2) throw new ErrorLogica("DATOS_INVALIDOS", "El Excel no tiene participantes");
  const cabecera = datos[0].map((c) => String(c ?? "").trim().toUpperCase());
  const faltan = ["NOMBRE", "NACIMIENTO"].filter((c) => !cabecera.includes(c));
  if (faltan.length) throw new ErrorLogica("DATOS_INVALIDOS", `Faltan columnas en el Excel: ${faltan.join(", ")}`);
  const col = (n) => cabecera.indexOf(n);

  const participantes = [];
  const descartadas = [];
  datos.slice(1).forEach((fila, i) => {
    const numero = i + 2;
    if (vacio(fila[col("NOMBRE")])) return; // fila vacía
    const anio = Number(fila[col("NACIMIENTO")]);
    if (!Number.isInteger(anio) || anio < 1900) return descartadas.push({ fila: numero, motivo: "sin año de nacimiento" });
    participantes.push({
      nombre: String(fila[col("NOMBRE")]).trim(),
      anioNacimiento: anio,
      club: col("CLUB") >= 0 && !vacio(fila[col("CLUB")]) ? String(fila[col("CLUB")]).trim() : null,
      dorsal: col("DORSAL") >= 0 && !vacio(fila[col("DORSAL")]) ? String(fila[col("DORSAL")]).trim() : null,
    });
  });
  return { participantes, descartadas };
}
