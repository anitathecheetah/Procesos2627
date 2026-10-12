// Capa de presentación (interfaz GUI).
// Solo lee y pinta el DOM. No hace peticiones al servidor: eso lo hace api.js.

export function mostrarEstado(texto, correcto = true) {
  const elemento = document.getElementById("estado");
  elemento.textContent = texto;
  elemento.dataset.correcto = String(correcto);
}

// Mensaje bajo un formulario (o el aviso global si no se indica zona).
export function mostrarMensaje(texto, correcto, formulario) {
  const zona = formulario ? formulario.querySelector(".mensaje") : document.getElementById("aviso-global");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}

// Valores de un formulario como objeto { campo: valor }.
export function leerFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario));
}

// Ejecuta `alEnviar(datos)` al enviar el formulario, desactivando el botón mientras tanto.
export function alEnviar(formulario, alEnviar) {
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = formulario.querySelector("button");
    boton.disabled = true;
    try {
      await alEnviar(leerFormulario(formulario), formulario);
    } finally {
      boton.disabled = false;
    }
  });
}

// Muestra la sesión (usuario) y oculta los formularios; con null hace lo contrario.
export function mostrarSesion(usuario) {
  document.getElementById("zona-sesion").hidden = !usuario;
  document.getElementById("zona-formularios").hidden = Boolean(usuario);
  if (usuario) {
    document.getElementById("usuario-sesion").textContent = `${usuario.nombre} (${usuario.email}) · rol: ${usuario.rol}`;
  }
}

export function alPulsarSalir(manejador) {
  document.getElementById("boton-salir").addEventListener("click", manejador);
}

export function alPulsarEliminarCuenta(manejador) {
  document.getElementById("boton-eliminar-cuenta").addEventListener("click", manejador);
}

export function confirmar(texto) {
  return window.confirm(texto);
}

// Panel de administración: tabla de usuarios con botón de eliminar. Con null se oculta.
export function mostrarAdministracion(usuarios, alEliminar) {
  const zona = document.getElementById("zona-admin");
  zona.hidden = !usuarios;
  if (!usuarios) return;
  const cuerpo = document.querySelector("#tabla-usuarios tbody");
  cuerpo.replaceChildren(
    ...usuarios.map((u) => {
      const fila = document.createElement("tr");
      for (const valor of [u.nombre, u.email, u.rol, u.estado]) {
        const celda = document.createElement("td");
        celda.textContent = valor; // textContent: nunca se interpreta como HTML
        fila.append(celda);
      }
      const celdaBoton = document.createElement("td");
      if (u.estado !== "eliminado") {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "Eliminar";
        boton.addEventListener("click", () => alEliminar(u));
        celdaBoton.append(boton);
      }
      fila.append(celdaBoton);
      return fila;
    })
  );
}

export function mostrarAvisoAdmin(texto, correcto) {
  const zona = document.getElementById("aviso-admin");
  zona.textContent = texto;
  zona.dataset.correcto = String(correcto);
}
