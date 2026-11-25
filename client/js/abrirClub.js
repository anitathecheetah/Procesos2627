// Apertura del detalle de un club en la pestaña «Clubes». Sin DOM: recibe las funciones que cargan y pintan.
// Si se pulsan dos clubes seguidos, solo cuenta la última petición: una respuesta (o un fallo) tardío
// de la anterior se descarta para que el detalle nunca muestre un club distinto del último elegido.
export function crearAbridorClub({ cargar, pintar, alFallar }) {
  let consulta = 0;
  async function abrir(club) {
    const actual = ++consulta;
    try {
      const datos = await cargar(club.id);
      if (actual === consulta) pintar(datos, club);
    } catch (error) {
      if (actual === consulta) alFallar(error, club);
    }
  }
  // Descarta las peticiones en curso (p. ej. al cerrar sesión).
  abrir.descartarPendientes = () => { consulta += 1; };
  return abrir;
}
