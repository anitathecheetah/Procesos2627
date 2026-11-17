// Conecta la vista de las próximas carreras (vistaConvocatorias.js) con el cliente de API (api.js).
import {
  listarConvocatorias, crearConvocatoria, eliminarConvocatoria, apuntarse, desapuntarse,
  apuntadosDe, vincularListado, asistenciaDe, listarPruebas,
} from "./api.js";
import {
  mostrarConvocatorias, mostrarFormularioAdmin, limpiarDetalle, mostrarApuntados,
  mostrarFormularioVincular, mostrarAsistencia, mostrarAvisoConvocatorias,
} from "./vistaConvocatorias.js";

let usuario = null;

async function intentar(accion) {
  try {
    mostrarAvisoConvocatorias("");
    await accion();
  } catch (error) {
    mostrarAvisoConvocatorias(error.message || "No se pudo completar la operación.");
  }
}

async function cargar() {
  await intentar(async () => mostrarConvocatorias(await listarConvocatorias(), usuario, acciones));
}

const acciones = {
  alApuntarse: (c) => intentar(async () => { await apuntarse(c.id); await cargar(); }),
  alDesapuntarse: (c) => intentar(async () => { await desapuntarse(c.id); await cargar(); }),
  alVerApuntados: (c) => intentar(async () => mostrarApuntados(c, await apuntadosDe(c.id))),
  alVerAsistencia: (c) => intentar(async () => mostrarAsistencia(await asistenciaDe(c.id))),
  alVincular: (c) => intentar(async () => mostrarFormularioVincular(c, await listarPruebas(c.deporte), alConfirmarVinculo)),
  alEliminar: (c) => intentar(async () => {
    if (!window.confirm(`¿Eliminar «${c.nombre}» y sus inscripciones?`)) return;
    await eliminarConvocatoria(c.id);
    limpiarDetalle();
    await cargar();
  }),
};

const alConfirmarVinculo = (c, pruebaId) => intentar(async () => {
  mostrarAsistencia(await vincularListado(c.id, pruebaId));
  await cargar();
});

// main.js avisa cada vez que cambia la sesión (entrar, salir, recargar la página).
export async function alCambiarSesion(nuevoUsuario) {
  usuario = nuevoUsuario;
  mostrarFormularioAdmin(usuario?.rol === "admin");
  await cargar();
}

document.getElementById("form-convocatoria").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const datos = Object.fromEntries(new FormData(formulario));
  intentar(async () => {
    await crearConvocatoria(datos);
    formulario.reset();
    await cargar();
    mostrarAvisoConvocatorias("Carrera creada.", true);
  });
});
