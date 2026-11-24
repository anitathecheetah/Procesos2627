// Perfil y material del atleta (PBI-54): datos que cada usuario guarda en su cuenta y que solo él puede ver.
// Documentado en docs/perfil-material.md.
import { ErrorLogica } from "./errores.js";
import { hoyEnEspana } from "./preparacion.js";

export const TIPOS_NEOPRENO = Object.freeze(["", "integral", "corto"]);
export const TIPOS_BICI = Object.freeze(["ruta", "contrarreloj", "mtb"]);
const MAX_BICIS = 5;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const PERFIL_VACIO = Object.freeze({
  nombre: "", apellidos: "", club: "", fechaNacimiento: "", alturaCm: null, pesoKg: null,
  zapatillas: { triatlon: { carrera: "", ciclismo: "" }, duatlon: { carrera1: "", carrera2: "", ciclismo: "" } },
  neopreno: { modelo: "", tipo: "" },
  bicis: [],
});

function texto(valor, campo, max) {
  if (valor == null) return "";
  if (typeof valor !== "string") throw new ErrorLogica("DATOS_INVALIDOS", `${campo} debe ser texto`);
  const t = valor.trim().replace(/\s+/g, " ");
  if (t.length > max) throw new ErrorLogica("DATOS_INVALIDOS", `${campo} no puede tener más de ${max} caracteres`);
  return t;
}
function numero(valor, campo, { min, max }) {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new ErrorLogica("DATOS_INVALIDOS", `${campo} debe estar entre ${min} y ${max}`);
  return Math.round(n * 10) / 10;
}
function fecha(valor, hoy) {
  if (valor == null || valor === "") return "";
  if (typeof valor !== "string" || !ISO.test(valor) || new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) !== valor) {
    throw new ErrorLogica("DATOS_INVALIDOS", "La fecha de nacimiento debe tener el formato AAAA-MM-DD y existir");
  }
  if (valor > hoy || valor < "1900-01-01") throw new ErrorLogica("DATOS_INVALIDOS", "La fecha de nacimiento no es válida");
  return valor;
}

// Años cumplidos en `hoy`; null si no hay fecha.
export function edadEn(fechaNacimiento, hoy = hoyEnEspana()) {
  if (!fechaNacimiento) return null;
  const [a, m, d] = fechaNacimiento.split("-").map(Number);
  const [ha, hm, hd] = hoy.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

export function crearServicioPerfil({ repos, hoy = hoyEnEspana }) {
  const conEdad = (p) => ({ ...p, edad: edadEn(p.fechaNacimiento, hoy()) });
  return {
    // Perfil propio (con valores por defecto si aún no ha guardado nada).
    async obtener(usuarioId) {
      const guardado = await repos.perfiles.buscarPorId(usuarioId);
      const { id: _i, usuarioId: _u, ...datos } = guardado ?? {};
      return conEdad({ ...structuredClone(PERFIL_VACIO), ...datos });
    },

    // Borra el perfil (al eliminar la cuenta no deben quedar datos personales).
    async eliminar(usuarioId) {
      await repos.perfiles.eliminar(usuarioId);
    },

    // Guarda el perfil completo (sustituye al anterior). Valida todo antes de guardar.
    async guardar(usuarioId, datos = {}) {
      const z = datos.zapatillas ?? {};
      const tri = z.triatlon ?? {};
      const dua = z.duatlon ?? {};
      const neo = datos.neopreno ?? {};
      const tipoNeo = neo.tipo ?? "";
      if (!TIPOS_NEOPRENO.includes(tipoNeo)) throw new ErrorLogica("DATOS_INVALIDOS", "El tipo de neopreno debe ser integral o corto");
      const bicisEntrada = datos.bicis ?? [];
      if (!Array.isArray(bicisEntrada) || bicisEntrada.length > MAX_BICIS) throw new ErrorLogica("DATOS_INVALIDOS", `Puedes guardar hasta ${MAX_BICIS} bicis`);
      const bicis = bicisEntrada
        .map((b) => ({ nombre: texto(b?.nombre, "El nombre de la bici", 60), tipo: b?.tipo ?? "ruta" }))
        .filter((b) => b.nombre);
      if (bicis.some((b) => !TIPOS_BICI.includes(b.tipo))) throw new ErrorLogica("DATOS_INVALIDOS", `El tipo de bici debe ser uno de: ${TIPOS_BICI.join(", ")}`);
      const perfil = {
        nombre: texto(datos.nombre, "El nombre", 60),
        apellidos: texto(datos.apellidos, "Los apellidos", 80),
        club: texto(datos.club, "El club", 80),
        fechaNacimiento: fecha(datos.fechaNacimiento, hoy()),
        alturaCm: numero(datos.alturaCm, "La altura (cm)", { min: 100, max: 230 }),
        pesoKg: numero(datos.pesoKg, "El peso (kg)", { min: 30, max: 250 }),
        zapatillas: {
          triatlon: { carrera: texto(tri.carrera, "Las zapatillas de correr", 60), ciclismo: texto(tri.ciclismo, "Las zapatillas de ciclismo", 60) },
          duatlon: {
            carrera1: texto(dua.carrera1, "Las zapatillas de la primera carrera", 60),
            carrera2: texto(dua.carrera2, "Las zapatillas de la segunda carrera", 60),
            ciclismo: texto(dua.ciclismo, "Las zapatillas de ciclismo", 60),
          },
        },
        neopreno: { modelo: texto(neo.modelo, "El neopreno", 60), tipo: tipoNeo },
        bicis,
      };
      const existente = await repos.perfiles.buscarPorId(usuarioId);
      const entidad = { id: usuarioId, usuarioId, ...perfil };
      if (existente) await repos.perfiles.actualizar(entidad);
      else await repos.perfiles.crear(entidad);
      return conEdad(perfil);
    },
  };
}
