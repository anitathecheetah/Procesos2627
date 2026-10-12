// Repositorio de sesiones EN MEMORIA. Contrato: crear(sesion), buscar(id) -> sesion|null, eliminar(id).
// Las sesiones se pierden al reiniciar el servidor (las cookies dejan de valer y hay que volver a entrar).
export function crearRepositorioSesionesMemoria() {
  const sesiones = new Map();
  return {
    async crear(sesion) {
      sesiones.set(sesion.id, { ...sesion });
    },
    async buscar(id) {
      const s = sesiones.get(id);
      return s ? { ...s } : null;
    },
    async eliminar(id) {
      sesiones.delete(id);
    },
  };
}
