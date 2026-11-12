// Conexión a MongoDB: crea los repositorios y los índices necesarios.
import { MongoClient } from "mongodb";
import { crearRepositorioMongo, crearRepositorioSesionesMongo } from "./repositorioMongo.js";
import { crearColeccionMongo } from "./coleccionMongo.js";
import { INDICES_DOMINIO } from "./indicesDominio.js";

export async function conectarBaseDatos(uri, nombreBd = "procesos") {
  const cliente = new MongoClient(uri);
  await cliente.connect();
  const bd = cliente.db(nombreBd);

  const usuarios = bd.collection("usuarios");
  await usuarios.createIndex({ email: 1 }, { unique: true });
  await usuarios.createIndex({ tokenConfirmacion: 1 }, { sparse: true });

  const sesiones = bd.collection("sesiones");
  await sesiones.createIndex({ caducaEn: 1 }, { expireAfterSeconds: 0 });

  // Dominio deportivo: una colección por entidad, con sus índices únicos y de consulta.
  const dominio = {};
  for (const [nombre, indices] of Object.entries(INDICES_DOMINIO)) {
    const coleccion = bd.collection(nombre);
    for (const { campos, unico = false } of indices) {
      await coleccion.createIndex(Object.fromEntries(campos.map((c) => [c, 1])), { unique: unico, sparse: unico });
    }
    dominio[nombre] = crearColeccionMongo(coleccion);
  }

  return {
    dominio,
    repositorio: crearRepositorioMongo(usuarios),
    repositorioSesiones: crearRepositorioSesionesMongo(sesiones),
    cerrar: () => cliente.close(),
  };
}
