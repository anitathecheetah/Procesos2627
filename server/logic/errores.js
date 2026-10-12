// Errores de negocio. La capa API los traduce a códigos HTTP; la lógica no conoce HTTP.
export class ErrorLogica extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

// Códigos: DATOS_INVALIDOS, NO_AUTENTICADO, PROHIBIDO, NO_ENCONTRADO, EMAIL_DUPLICADO, CREDENCIALES_INVALIDAS, CUENTA_PENDIENTE
