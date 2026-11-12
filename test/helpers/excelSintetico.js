// Genera Excel SINTÉTICOS con la misma estructura que los de la federación.
// Nunca se usan datos reales de personas en las pruebas ni en el repositorio.
import writeExcelFile from "write-excel-file/node";

export const CABECERA = ["EVENTO", "PHASE", "ID", "NOMBRE", "AÑO", "CLUB", "FEDERACION", "DORSAL", "NACIMIENTO",
  "CARRERA", "T1", "CICLISMO", "T2", "CARRERA", "POSICION", "POSICION_FINAL", "ESTADO", "TIEMPO"];

const celda = (v) => (v === null || v === undefined ? null : { value: v });

// Fila de un atleta que termina: 5 parciales, posición y tiempo total.
export const finalista = (nombre, anio, club, dorsal, pos, total, parciales = ["00:14:00", "00:00:20", "00:30:00", "00:00:20", "00:07:00"]) =>
  [null, "Final", String(1000 + dorsal), nombre, null, club, "MAD", String(dorsal), String(anio), ...parciales, pos, pos, null, total];

// No terminó: parciales hasta donde llegó y estado DNF (sin tiempo total).
export const abandono = (nombre, anio, club, dorsal) =>
  [null, "Final", String(1000 + dorsal), nombre, null, club, "MAD", String(dorsal), String(anio), "00:14:00", "00:00:20", null, null, null, null, 70, "DNF", null];

// Con un parcial vacío la federación exporta las celdas desplazadas a la izquierda.
export const desplazada = (nombre, anio, club, dorsal, pos, total) =>
  [null, "Final", String(1000 + dorsal), nombre, null, club, "MAD", String(dorsal), String(anio),
    "00:14:00", "00:00:20", "00:30:00", "00:00:20", pos, pos, null, total];

export async function crearExcel(filas, cabecera = CABECERA) {
  const datos = [cabecera, ...filas].map((fila) => fila.map(celda));
  return writeExcelFile(datos).toBuffer();
}
