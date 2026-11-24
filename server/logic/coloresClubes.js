// Colores de los clubes de Primera División (liga de triatlón y liga de duatlón, temporada 2026). Los eligió el usuario;
// el color va con el club (por su nombre normalizado), no con la división: si un club sube o baja, conserva su color.
// `colores` son los colores del maillot en CSS (el primero es el principal) y `descripcion` lo que se muestra al pasar el ratón.
import { claveClub } from "./normalizacion.js";

const BLANCO = "#ffffff"; const NEGRO = "#111827"; const NARANJA = "#f97316"; const AZUL = "#1d4ed8"; const ROSA = "#ec4899";
const ROSA_CLARO = "#f9a8d4"; const AMARILLO = "#facc15"; const VERDE = "#22c55e"; const CELESTE = "#38bdf8"; const LILA = "#a78bfa";

export const COLORES_CLUBES = Object.freeze([
  { nombre: "Peñota Dental Triatlón", colores: [BLANCO], descripcion: "blanco" },
  { nombre: "Cidade de Lugo Fluvial", colores: ["#d9138a"], descripcion: "fucsia" },
  { nombre: "C.E.A. Bétera", colores: [CELESTE], descripcion: "celeste" },
  { nombre: "Club Deportivo Delikia", colores: [ROSA_CLARO], descripcion: "rosa claro" },
  { nombre: "Club de Triatlón Diablillos de Rivas", colores: ["#8b0000"], descripcion: "rojo oscuro" },
  { nombre: "Deporama Triatlón Soriano", colores: ["#f87171"], descripcion: "rojo claro" },
  { nombre: "Club Triatlón Albacete Res", colores: [AMARILLO], descripcion: "amarillo" },
  { nombre: "C.E. Katoa Barcelona", colores: [VERDE], descripcion: "verde" },
  { nombre: "Stadium Casablanca Mapei", colores: ["#14532d"], descripcion: "verde oscuro" },
  { nombre: "AD Triatlón Ecosport Alcobendas", colores: [NARANJA, AZUL], descripcion: "naranja y azul" },
  { nombre: "A.D. Náutico de Narón", colores: [ROSA, AZUL], descripcion: "rosa y azul" },
  { nombre: "Montilla-Córdoba Triatlón", colores: [NARANJA, AMARILLO, NEGRO], descripcion: "naranja, amarillo y negro" },
  { nombre: "Triatlón Inforhouse Santiago", colores: [BLANCO, NEGRO], descripcion: "cebra (blanco y negro)" },
  { nombre: "Saltoki Trikideak", colores: ["#16a34a", ROSA_CLARO], descripcion: "trébol verde sobre fondo rosa" },
  { nombre: "Isbilya - Sloppy Joe´s", colores: ["#dc2626", NEGRO], descripcion: "rojo y negro" },
  { nombre: "Prat Triatló 1994", colores: [NARANJA, AZUL], descripcion: "naranja y azul" },
  { nombre: "Club Natació Barcelona Fasttriatlon", colores: [BLANCO, "#dc2626", NEGRO], descripcion: "blanco, rojo y negro" },
  { nombre: "C.D.T. Resistentia T3", colores: [ROSA, BLANCO, LILA], descripcion: "rosa, blanco y lila" },
  { nombre: "Marlins Triatlón Madrid", colores: [VERDE, NEGRO], descripcion: "verde y negro" },
  { nombre: "Tripuçol", colores: [NARANJA, NEGRO, BLANCO], descripcion: "naranja, negro y blanco" },
  { nombre: "Club Triatlón Tritones Rioja", colores: [CELESTE, BLANCO, NARANJA], descripcion: "celeste, blanco y naranja" },
  { nombre: "Triatlón Ferrol", colores: [AZUL, BLANCO], descripcion: "azul y blanco" },
  { nombre: "Universidad de Alicante", colores: ["#1e3a8a"], descripcion: "azul oscuro" },
]);

// Cada nombre admite variantes con que se escribe en los Excel y en el ranking de la FETRI.
const VARIANTES = {
  "Peñota Dental Triatlón": ["Peñota Dental Alusigma", "Peñota Dental"],
  "Club Deportivo Delikia": ["Deportivo Delikia", "C.D. Delikia"],
  "Club Triatlón Albacete Res": ["Triatlón Albacete Res", "Triatlon Albacete Res"],
  "Club de Triatlón Diablillos de Rivas": ["Diablillos de Rivas"],
  "AD Triatlón Ecosport Alcobendas": ["Triatlón Ecosport Alcobendas"],
  "Isbilya - Sloppy Joe´s": ["Isbilya Sloppy Joe's", "Isbilya-Sloppy Joe's"],
  "Club Natació Barcelona Fasttriatlon": ["Natació Barcelona Fasttriatlon", "Fasttriatlon Club Natació Barcelona"],
  "Prat Triatló 1994": ["Prat Triatlo 1994", "Prat Triatló"],
  "Club Triatlón Tritones Rioja": ["Tritones Rioja", "Club Triatlon Tritones Rioja"],
};

const porClave = new Map();
for (const c of COLORES_CLUBES) {
  for (const n of [c.nombre, ...(VARIANTES[c.nombre] ?? [])]) porClave.set(claveClub(n), c);
}

// { colores, descripcion } del club, o null si no tiene color asignado.
export function coloresDeClub(nombre) {
  if (typeof nombre !== "string" || nombre.trim() === "") return null;
  const c = porClave.get(claveClub(nombre));
  return c ? { colores: [...c.colores], descripcion: c.descripcion } : null;
}

// Para ampliar la respuesta de un club: { id, nombre } → { id, nombre, colores, descripcionColor }.
export function conColores(club) {
  if (!club) return club;
  const c = coloresDeClub(club.nombre);
  return c ? { ...club, colores: c.colores, descripcionColor: c.descripcion } : club;
}
