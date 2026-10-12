# Capa de lógica de negocio

Aquí van las reglas de gestión de usuarios (alta, listado, activo, eliminación, permisos).

- **Recibe** datos ya extraídos de la petición por la capa API (`server/api`).
- **Usa** la capa de datos (`server/data`) a través de un repositorio recibido como parámetro.
- **No conoce** Express, `req`/`res` ni la base de datos concreta.
- **Lanza** errores propios (con código) que la capa API traduce a códigos HTTP.
