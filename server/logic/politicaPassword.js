// Política de contraseñas (VARIANTE-1).
// Función pura de la capa de lógica: no accede a la base de datos ni a Express.
// Devuelve qué reglas incumple la contraseña; si cumple las tres, `errores` va vacío.
const LONGITUD_MINIMA = 10;

export function validarPassword(password) {
  const errores = [];
  // [...password] cuenta caracteres reales (no unidades UTF-16).
  if ([...password].length < LONGITUD_MINIMA) errores.push("LONGITUD");
  if (!/[0-9]/.test(password)) errores.push("DIGITO");
  // \p{Lu} reconoce cualquier mayúscula, también Ñ o É.
  if (!/\p{Lu}/u.test(password)) errores.push("MAYUSCULA");
  return { valida: errores.length === 0, errores };
}
