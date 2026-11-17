# Próximas carreras e inscripciones

## Qué hace

1. El **administrador** crea las próximas carreras (nombre, deporte, fecha y lugar) en la tarjeta **Próximas carreras**.
2. Cada **usuario con sesión** pulsa **Me apunto** en las que va a ir (y **Ya no voy** si cambia de idea). Cualquiera ve cuántos se han apuntado; solo el administrador ve los nombres (sin email).
3. Cuando la federación publica el listado real, el administrador lo importa como una prueba (ver [importacion-excel.md](importacion-excel.md)) y lo **vincula** a la carrera. La carrera pasa a **celebrada**, deja de admitir inscripciones y el administrador ve la **asistencia**: quién de los apuntados participó, quién no y cuántos participantes no se habían apuntado.

## Cómo se compara

La coincidencia es por nombre: las palabras del nombre del usuario deben aparecer todas en el del atleta, da igual el orden, las tildes o si viene como «APELLIDOS, NOMBRE» (por ejemplo, «Ana Rodríguez» coincide con «RODRIGUEZ MARTIN, ANA»). Hacen falta al menos 2 palabras y cada atleta solo cuenta para un apuntado. Los usuarios y los atletas no están enlazados por ningún identificador, así que conviene revisar a mano los «No». Los participantes «DNS» (no salieron) no cuentan.

## Datos y privacidad

- Colección `convocatorias`: `id, nombre, deporte, fecha, lugar, estado (abierta | celebrada), pruebaId?, creadaPor`.
- Colección `inscripciones`: `id, convocatoriaId, usuarioId, nombre` (único por carrera y usuario). Guarda el nombre de la cuenta, nunca el email.
- Borrar una carrera borra sus inscripciones. Una carrera celebrada se puede volver a vincular con otra prueba si se importó mal.

## API

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/convocatorias` | público | Listado (abiertas por fecha próxima, luego celebradas). Con sesión añade `apuntado`. |
| `POST /api/convocatorias` | admin | Crea una carrera: `{ nombre, deporte, fecha (AAAA-MM-DD), lugar }`. |
| `DELETE /api/convocatorias/:id` | admin | La borra con sus inscripciones. |
| `PUT` / `DELETE /api/convocatorias/:id/inscripcion` | sesión | Apuntarse / desapuntarse (repetirlo no da error). Solo si está abierta. |
| `GET /api/convocatorias/:id/inscripciones` | admin | Quién se ha apuntado. |
| `PUT /api/convocatorias/:id/listado` | admin | Vincula la prueba importada: `{ pruebaId }` (mismo deporte). Devuelve la asistencia. |
| `GET /api/convocatorias/:id/asistencia` | admin | Asistencia de una carrera ya vinculada. |

Errores: 400 (datos no válidos, carrera cerrada, sin listado vinculado), 401 (sin sesión), 403 (no es admin) y 404 (carrera o prueba inexistente).
