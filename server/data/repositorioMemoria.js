// Repositorio de usuarios EN MEMORIA (hito 1).
// En el hito 3 se sustituye por uno con base de datos real que cumple el mismo contrato:
//   crear(usuario) -> usuario | buscarPorId(id) -> usuario|null
//   buscarPorEmail(email) -> usuario|null | listar() -> usuario[]
// No contiene reglas de negocio ni conoce HTTP.
export function crearRepositorioMemoria() {
  const usuarios = new Map();

  return {
    async crear(usuario) {
      usuarios.set(usuario.id, { ...usuario });
      return { ...usuario };
    },
    async buscarPorId(id) {
      const u = usuarios.get(id);
      return u ? { ...u } : null;
    },
    async buscarPorEmail(email) {
      for (const u of usuarios.values()) if (u.email === email) return { ...u };
      return null;
    },
    async listar() {
      return [...usuarios.values()].map((u) => ({ ...u }));
    },
  };
}
