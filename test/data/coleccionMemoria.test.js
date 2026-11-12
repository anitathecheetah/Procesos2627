import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";
import { pruebasContratoDominio } from "./contratoDominio.js";

pruebasContratoDominio("memoria", async () => ({
  repos: Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, unicos]) => [n, crearColeccionMemoria({ unicos })])),
  limpiar: async () => {},
}));
