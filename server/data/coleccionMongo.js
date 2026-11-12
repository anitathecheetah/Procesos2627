// Repositorio genérico sobre una colección de MongoDB. Mismo contrato que coleccionMemoria.js.
// El id de la aplicación se guarda como _id. Los únicos se aplican con índices en conexion.js.
const aEntidad = (doc) => {
  if (!doc) return null;
  const { _id, ...resto } = doc;
  return { id: _id, ...resto };
};
const aDocumento = ({ id, ...resto }) => ({ _id: id, ...resto });
const aFiltro = ({ id, ...resto } = {}) => (id === undefined ? resto : { _id: id, ...resto });

export function crearColeccionMongo(coleccion) {
  return {
    async crear(entidad) {
      await coleccion.insertOne(aDocumento(entidad));
      return structuredClone(entidad);
    },
    async actualizar(entidad) {
      const { matchedCount } = await coleccion.replaceOne({ _id: entidad.id }, aDocumento(entidad));
      return matchedCount ? structuredClone(entidad) : null;
    },
    async buscarPorId(id) {
      return aEntidad(await coleccion.findOne({ _id: id }));
    },
    async buscarUno(filtro) {
      return aEntidad(await coleccion.findOne(aFiltro(filtro)));
    },
    async listar(filtro = {}) {
      return (await coleccion.find(aFiltro(filtro)).toArray()).map(aEntidad);
    },
    async eliminar(id) {
      const { deletedCount } = await coleccion.deleteOne({ _id: id });
      return deletedCount > 0;
    },
  };
}
