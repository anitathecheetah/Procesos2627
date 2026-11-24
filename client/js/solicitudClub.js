// Cuerpo de la solicitud de director a partir del formulario: un club de la lista o, si no aparece, un nombre nuevo. Sin DOM.
export const OTRO_CLUB = "__otro__";

export function cuerpoSolicitud({ club, nombreClub } = {}) {
  if (club === OTRO_CLUB) return { nombreClub: (nombreClub ?? "").trim() };
  return { clubId: club ?? "" };
}

export const textoEstadoSolicitud = (s) => {
  if (!s) return "";
  const club = s.nombreClub + (s.clubNuevo && s.estado === "pendiente" ? " (club nuevo)" : "");
  if (s.estado === "pendiente") return `Solicitud para ser director de ${club}: pendiente de que la apruebe el administrador.`;
  if (s.estado === "aprobada") return `Eres director de ${club}.`;
  return `Tu solicitud para ${club} fue rechazada. Puedes volver a solicitarlo.`;
};
