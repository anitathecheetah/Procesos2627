// Qué bici vale en cada carrera (PBI-54). Lo fija la carrera: si es cross (MTB) y si el drafting está permitido.
// Documentado en docs/perfil-material.md.
export const TIPOS_BICI = Object.freeze(["ruta", "contrarreloj", "mtb"]);

// → { valida, motivo } (motivo explica por qué no vale) y, si vale pero depende de algo que aún no se sabe, { aviso }.
export function evaluarBici(bici, { cross = false, drafting = "por confirmar" } = {}) {
  if (cross) {
    return bici.tipo === "mtb" ? { valida: true } : { valida: false, motivo: "es una prueba cross: hace falta bici de montaña" };
  }
  if (bici.tipo === "mtb") return { valida: false, motivo: "la bici de montaña solo se admite en pruebas cross" };
  if (bici.tipo === "contrarreloj") {
    if (drafting === "permitido") return { valida: false, motivo: "con drafting no se permite la bici de contrarreloj" };
    if (drafting !== "prohibido") return { valida: true, aviso: "solo vale si la prueba no permite drafting; confírmalo en el reglamento" };
  }
  return { valida: true };
}
