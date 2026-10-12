// Cifrado de contraseñas con bcrypt (bcryptjs, JavaScript puro).
// Se inyecta en el servicio de usuarios para poder sustituirlo en las pruebas.
import bcrypt from "bcryptjs";

const RONDAS = 10;

export function crearCifradorBcrypt() {
  return {
    cifrar: (texto) => bcrypt.hash(texto, RONDAS),
    comparar: (texto, hash) => bcrypt.compare(texto, hash),
  };
}
