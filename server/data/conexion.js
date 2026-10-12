// Conexión a MongoDB: crea los repositorios y los índices necesarios.
import { MongoClient } from "mongodb";
import { crearRepositorioMongo, crearRepositorioSesionesMongo } from "./repositorioMongo.js";

export async function conectarBaseDatos(uri, nombreBd = "procesos") {
  const cliente = new MongoClient(uri);
  await cliente.connect();
  const bd = cliente.db(nombreBd);

  const usuarios = bd.collection("usuarios");
  await usuarios.createIndex({ email: 1 }, { unique: true });
  await usuarios.createIndex({ tokenConfirmacion: 1 }, { sparse: true });

  const sesiones = bd.collection("sesiones");
  await sesiones.createIndex({ caducaEn: 1 }, { expireAfterSeconds: 0 });

  return {
    repositorio: crearRepositorioMongo(usuarios),
    repositorioSesiones: crearRepositorioSesionesMongo(sesiones),
    cerrar: () => cliente.close(),
  };
}
