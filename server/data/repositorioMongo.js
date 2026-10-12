// Repositorio de usuarios sobre MongoDB. Mismo contrato que repositorioMemoria.js:
//   crear, actualizar, buscarPorId, buscarPorEmail, buscarPorToken, listar.
// Recibe la colección ya conectada (no conoce la cadena de conexión).
// El id de la aplicación se guarda como _id del documento.
const aUsuario = (doc) => {
  if (!doc) return null;
  const { _id, ...resto } = doc;
  return { id: _id, ...resto };
};
const aDocumento = ({ id, ...resto }) => ({ _id: id, ...resto });

export function crearRepositorioMongo(coleccion) {
  return {
    async crear(usuario) {
      await coleccion.insertOne(aDocumento(usuario));
      return { ...usuario };
    },
    async actualizar(usuario) {
      const { matchedCount } = await coleccion.replaceOne({ _id: usuario.id }, aDocumento(usuario));
      return matchedCount ? { ...usuario } : null;
    },
    async buscarPorId(id) {
      return aUsuario(await coleccion.findOne({ _id: id }));
    },
    async buscarPorEmail(email) {
      return aUsuario(await coleccion.findOne({ email }));
    },
    async buscarPorToken(token) {
      return token ? aUsuario(await coleccion.findOne({ tokenConfirmacion: token })) : null;
    },
    async listar() {
      return (await coleccion.find({}).toArray()).map(aUsuario);
    },
  };
}

// Sesiones en MongoDB. Un índice TTL borra solas las sesiones caducadas.
export function crearRepositorioSesionesMongo(coleccion) {
  return {
    async crear({ id, usuarioId, expira }) {
      await coleccion.insertOne({ _id: id, usuarioId, expira, caducaEn: new Date(expira) });
    },
    async buscar(id) {
      const doc = await coleccion.findOne({ _id: id });
      return doc ? { id: doc._id, usuarioId: doc.usuarioId, expira: doc.expira } : null;
    },
    async eliminar(id) {
      await coleccion.deleteOne({ _id: id });
    },
  };
}
