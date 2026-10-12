import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { pruebasDeContrato } from "./contrato.js";

pruebasDeContrato("memoria", async () => ({ repo: crearRepositorioMemoria(), limpiar: async () => {} }));
