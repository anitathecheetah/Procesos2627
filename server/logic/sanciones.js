// Sanciones del acta oficial de una prueba. Se enlazan con el resultado por prueba + dorsal.
// Cada línea del acta lleva hasta tres pares acción + infracción (por ejemplo DSQ + LM).
import { randomUUID } from "node:crypto";
import { ErrorLogica } from "./errores.js";
import { ESTADOS_RESULTADO, esAccionSancion, esInfraccionSancion } from "./catalogos.js";

const MAX_PARES = 3;

// Texto CSV del acta preparado a mano: dorsal;accion1;infraccion1[;accion2;infraccion2;accion3;infraccion3][;observaciones]
// (separador ; o ,). La primera línea puede ser una cabecera. Devuelve [{ linea, dorsal, pares, observaciones }].
export function leerCsvSanciones(texto) {
  if (typeof texto !== "string" || texto.trim() === "") throw new ErrorLogica("DATOS_INVALIDOS", "Falta el CSV de sanciones");
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const separador = lineas.some((l) => l.includes(";")) ? ";" : ",";
  const filas = [];
  lineas.forEach((linea, i) => {
    if (linea.trim() === "") return;
    const crudas = linea.split(separador);
    const celdas = crudas.map((c) => c.trim());
    if (i === 0 && /dorsal/i.test(celdas[0])) return; // cabecera
    const pares = [];
    for (let k = 0; k < MAX_PARES; k++) {
      const accion = (celdas[1 + 2 * k] ?? "").toUpperCase();
      const infraccion = (celdas[2 + 2 * k] ?? "").toUpperCase();
      if (accion || infraccion) pares.push({ accion, infraccion });
    }
    const observaciones = crudas.slice(1 + 2 * MAX_PARES).join(separador).trim();
    filas.push({ linea: i + 1, dorsal: celdas[0], pares, ...(observaciones ? { observaciones } : {}) });
  });
  if (!filas.length) throw new ErrorLogica("DATOS_INVALIDOS", "El CSV de sanciones no tiene filas");
  return filas;
}

export function crearServicioSanciones({ repos, usuarios, log = { info() {} } }) {
  // Valida todas las filas antes de guardar nada: un error no deja la carga a medias.
  async function validar(pruebaId, filas) {
    const preparadas = [];
    const dorsales = new Set();
    for (const f of filas) {
      const donde = f.linea ? `línea ${f.linea}` : `dorsal ${f.dorsal}`;
      const dorsal = String(f.dorsal ?? "").trim();
      if (!dorsal) throw new ErrorLogica("DATOS_INVALIDOS", `${donde}: falta el dorsal`);
      if (dorsales.has(dorsal)) throw new ErrorLogica("DATOS_INVALIDOS", `${donde}: el dorsal ${dorsal} está repetido`);
      dorsales.add(dorsal);
      if (!Array.isArray(f.pares) || f.pares.length === 0) throw new ErrorLogica("DATOS_INVALIDOS", `${donde}: falta la acción`);
      if (f.pares.length > MAX_PARES) throw new ErrorLogica("DATOS_INVALIDOS", `${donde}: máximo ${MAX_PARES} sanciones por dorsal`);
      for (const { accion, infraccion } of f.pares) {
        if (!esAccionSancion(accion)) throw new ErrorLogica("DATOS_INVALIDOS", `${donde}: acción desconocida "${accion}"`);
        if (!esInfraccionSancion(infraccion)) throw new ErrorLogica("DATOS_INVALIDOS", `${donde}: infracción desconocida "${infraccion}"`);
      }
      const resultado = await repos.resultados.buscarUno({ pruebaId, dorsal });
      if (!resultado) throw new ErrorLogica("NO_ENCONTRADO", `${donde}: el dorsal ${dorsal} no existe en la prueba`);
      preparadas.push({ dorsal, pares: f.pares, observaciones: f.observaciones, resultado });
    }
    return preparadas;
  }

  return {
    // Carga (o recarga) las sanciones de la prueba. Recargar un dorsal sustituye lo anterior.
    // Una acción DSQ deja el resultado como descalificado; si se quita, recupera su estado original.
    async cargar(solicitanteId, pruebaId, filas) {
      await usuarios.exigirAdministrador(solicitanteId);
      if (!(await repos.pruebas.buscarPorId(pruebaId))) throw new ErrorLogica("NO_ENCONTRADO", "La prueba no existe");
      const preparadas = await validar(pruebaId, filas);

      let descalificados = 0;
      for (const { dorsal, pares, observaciones, resultado } of preparadas) {
        for (const anterior of await repos.sanciones.listar({ pruebaId, dorsal })) await repos.sanciones.eliminar(anterior.id);
        await repos.sanciones.crear({
          id: randomUUID(), pruebaId, resultadoId: resultado.id, atletaId: resultado.atletaId, dorsal, pares,
          ...(observaciones ? { observaciones } : {}),
        });

        const descalifica = pares.some((p) => p.accion === "DSQ");
        if (descalifica && resultado.estado !== ESTADOS_RESULTADO.DQ) {
          await repos.resultados.actualizar({ ...resultado, estadoOriginal: resultado.estado, estado: ESTADOS_RESULTADO.DQ });
        } else if (!descalifica && resultado.estadoOriginal) {
          const { estadoOriginal, ...resto } = resultado;
          await repos.resultados.actualizar({ ...resto, estado: estadoOriginal });
        }
        if (descalifica) descalificados++;
      }
      log.info("Sanciones cargadas", { prueba: pruebaId, filas: preparadas.length, descalificados });
      return { cargadas: preparadas.length, descalificados };
    },

    async deLaPrueba(pruebaId) {
      if (!(await repos.pruebas.buscarPorId(pruebaId))) throw new ErrorLogica("NO_ENCONTRADO", "La prueba no existe");
      return repos.sanciones.listar({ pruebaId });
    },
  };
}
