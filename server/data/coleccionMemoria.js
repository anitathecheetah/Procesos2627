// Repositorio genérico en memoria para las entidades del dominio deportivo
// (atletas, clubes, pertenencias, pruebas, resultados, sanciones).
// Contrato (idéntico en coleccionMongo.js):
//   crear, crearVarios(lista), actualizar, buscarPorId, buscarUno(filtro), listar(filtro), eliminar(id), eliminarPor(filtro)
// `unicos` es una lista de listas de campos que no pueden repetirse (en MongoDB, índices únicos).
export function crearColeccionMemoria({ unicos = [] } = {}) {
  const datos = new Map();
  const copia = (x) => (x ? structuredClone(x) : null);
  const coincide = (doc, filtro) => Object.entries(filtro).every(([k, v]) => doc[k] === v);
  const repetido = (nuevo, ignorarId) =>
    [...datos.values()].some(
      (doc) => doc.id !== ignorarId && unicos.some((campos) => campos.every((c) => doc[c] !== undefined && doc[c] === nuevo[c])),
    );

  return {
    async crear(entidad) {
      if (datos.has(entidad.id) || repetido(entidad)) throw new Error("Entidad duplicada");
      datos.set(entidad.id, copia(entidad));
      return copia(entidad);
    },
    async crearVarios(lista) {
      for (const e of lista) await this.crear(e);
      return lista.length;
    },
    async actualizar(entidad) {
      if (!datos.has(entidad.id)) return null;
      if (repetido(entidad, entidad.id)) throw new Error("Entidad duplicada");
      datos.set(entidad.id, copia(entidad));
      return copia(entidad);
    },
    async buscarPorId(id) {
      return copia(datos.get(id));
    },
    async buscarUno(filtro) {
      return copia([...datos.values()].find((d) => coincide(d, filtro)));
    },
    async listar(filtro = {}) {
      return [...datos.values()].filter((d) => coincide(d, filtro)).map(copia);
    },
    async eliminar(id) {
      return datos.delete(id);
    },
    // Borra todo lo que coincide con el filtro y devuelve cuántos eran.
    async eliminarPor(filtro) {
      const ids = [...datos.values()].filter((d) => coincide(d, filtro)).map((d) => d.id);
      ids.forEach((id) => datos.delete(id));
      return ids.length;
    },
  };
}
