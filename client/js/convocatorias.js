// Conecta la vista de las próximas carreras (vistaConvocatorias.js) con el cliente de API (api.js).
import {
  listarConvocatorias, crearConvocatoria, eliminarConvocatoria, apuntarse, desapuntarse,
  apuntadosDe, subirListaSalida, listaSalidaDe, asistenciaDe, preparacionDe, elegirBici,
} from "./api.js";
import {
  mostrarConvocatorias, mostrarFormularioAdmin, limpiarDetalle, mostrarApuntados,
  mostrarFormularioLista, mostrarLista, mostrarAsistencia, mostrarAvisoConvocatorias, mostrarPreparacion,
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
  document.dispatchEvent(new CustomEvent("convocatorias-cambiadas")); // la tarjeta de predicción actualiza sus listas
}

const acciones = {
  alPreparar: (c) => intentar(async () => mostrarPreparacion(await preparacionDe(c.id), alElegirBici)),
  // El nombre y los apellidos salen del perfil: no se pide nada.
  alApuntarse: (c) => intentar(async () => { await apuntarse(c.id); limpiarDetalle(); await cargar(); }),
  alDesapuntarse: (c) => intentar(async () => { await desapuntarse(c.id); await cargar(); }),
  alVerApuntados: (c) => intentar(async () => mostrarApuntados(c, await apuntadosDe(c.id))),
  alVerAsistencia: (c) => intentar(async () => mostrarAsistencia(await asistenciaDe(c.id))),
  alVerLista: (c) => intentar(async () => mostrarLista(c, await listaSalidaDe(c.id))),
  alSubirLista: (c) => intentar(async () => mostrarFormularioLista(c, alConfirmarSubida)),
  alEliminar: (c) => intentar(async () => {
    if (!window.confirm(`¿Eliminar «${c.nombre}» y sus inscripciones?`)) return;
    await eliminarConvocatoria(c.id);
    limpiarDetalle();
    await cargar();
  }),
};

const alElegirBici = (carrera, bici) => intentar(async () => {
  try {
    await elegirBici(carrera.id, bici);
  } finally {
    mostrarPreparacion(await preparacionDe(carrera.id), alElegirBici); // refleja lo guardado (o la elección anterior si falló)
  }
});

const alConfirmarSubida = (c, archivo, sexo) => intentar(async () => {
  if (!archivo) return mostrarAvisoConvocatorias("Elige primero el archivo Excel.");
  const r = await subirListaSalida(c.id, await archivo.arrayBuffer(), sexo);
  mostrarAsistencia(r.asistencia, r);
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
