// Conversión entre el formulario «Mi perfil y material» (campos planos) y el perfil de la API. Sin DOM, para poder probarla.
export const HUECOS_BICI = 3;

// formulario → perfil de la API
export function perfilDesdeFormulario(f) {
  const bicis = [];
  for (let i = 1; i <= HUECOS_BICI; i += 1) bicis.push({ nombre: f[`bici${i}_nombre`] ?? "", tipo: f[`bici${i}_tipo`] || "ruta" });
  return {
    nombre: f.nombre ?? "", apellidos: f.apellidos ?? "", club: f.club ?? "", fechaNacimiento: f.fechaNacimiento ?? "",
    alturaCm: f.alturaCm ?? "", pesoKg: f.pesoKg ?? "",
    zapatillas: {
      triatlon: { carrera: f.tri_carrera ?? "", ciclismo: f.tri_ciclismo ?? "" },
      duatlon: { carrera1: f.dua_carrera1 ?? "", carrera2: f.dua_carrera2 ?? "", ciclismo: f.dua_ciclismo ?? "" },
    },
    neopreno: { modelo: f.neo_modelo ?? "", tipo: f.neo_tipo ?? "" },
    bicis: bicis.filter((b) => b.nombre.trim()),
  };
}

// perfil de la API → valores del formulario
export function formularioDesdePerfil(p) {
  const f = {
    nombre: p.nombre, apellidos: p.apellidos, club: p.club, fechaNacimiento: p.fechaNacimiento,
    alturaCm: p.alturaCm ?? "", pesoKg: p.pesoKg ?? "",
    tri_carrera: p.zapatillas.triatlon.carrera, tri_ciclismo: p.zapatillas.triatlon.ciclismo,
    dua_carrera1: p.zapatillas.duatlon.carrera1, dua_carrera2: p.zapatillas.duatlon.carrera2, dua_ciclismo: p.zapatillas.duatlon.ciclismo,
    neo_modelo: p.neopreno.modelo, neo_tipo: p.neopreno.tipo,
  };
  for (let i = 1; i <= HUECOS_BICI; i += 1) {
    f[`bici${i}_nombre`] = p.bicis[i - 1]?.nombre ?? "";
    f[`bici${i}_tipo`] = p.bicis[i - 1]?.tipo ?? "ruta";
  }
  return f;
}

export const textoEstadoClub = (p) => (p?.clubPendiente ? "Club pendiente de validar por el administrador." : "");

export const textoEdad = (edad) => (edad == null ? "" : `${edad} años`);
