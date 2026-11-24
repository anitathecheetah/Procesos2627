// Lista de clubes de la pestaña «Clubes»: filtro por nombre y texto de cada fila. Sin DOM.
const normalizar = (texto) => String(texto ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export const textoClubResumen = (c) => `${c.nombre} · ${c.atletas} atleta${c.atletas === 1 ? "" : "s"}`;

// Clubes cuyo nombre contiene todas las palabras escritas (sin importar mayúsculas ni tildes); los que tienen más atletas, primero.
export function filtrarClubes(clubes, texto = "") {
  const palabras = normalizar(texto).split(" ").filter(Boolean);
  return clubes
    .filter((c) => { const n = normalizar(c.nombre); return palabras.every((p) => n.includes(p)); })
    .sort((a, b) => b.atletas - a.atletas || a.nombre.localeCompare(b.nombre, "es"));
}
