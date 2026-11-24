# Próximas carreras, inscripciones y lista de salida

## Qué hace

1. El **administrador** crea las próximas carreras (nombre, deporte, fecha y lugar) en la tarjeta **Próximas carreras**.
2. Cada **usuario con sesión** pulsa **Me apunto** en las que va a ir (el nombre y los dos apellidos se toman de **Mi perfil**, sin pedirlos al apuntarse; si faltan, la app avisa de que hay que completarlos) (y **Ya no voy** si cambia de idea). Cualquiera ve cuántos se han apuntado; solo el administrador ve los nombres (sin email).
3. Antes de la carrera, la federación publica la **lista de salida** oficial. El administrador la sube como Excel con **Subir lista de salida**. La carrera pasa a **cerrada** (con lista de salida), deja de admitir inscripciones y el administrador ve la **asistencia**: quién de los apuntados está en la lista, quién no y cuántos participantes no se habían apuntado.
4. La **predicción** de esa carrera usa la lista de salida: se predice a todos los que van a competir (ver [prediccion.md](prediccion.md)).
5. Después de la carrera se importan los resultados como siempre (ver [importacion-excel.md](importacion-excel.md)).

## La lista de salida (Excel)

Una hoja, una fila por atleta. Las columnas se localizan por el nombre de la cabecera: **NOMBRE** y **NACIMIENTO** son obligatorias; **CLUB** y **DORSAL** son opcionales. El resto (EVENTO, PHASE, ID, TIEMPO...) se ignora, así que vale el mismo formato que las clasificaciones.

- Por defecto no se guardan los **posibles menores de edad** (año de la carrera − año de nacimiento ≤ 18), como al importar resultados: se descartan antes de guardar nada.
- Los atletas se identifican por nombre + año de nacimiento, igual que en los resultados, así que quien ya corrió conserva su Elo. Quien debuta aparece en la predicción con el Elo inicial (1500) y marcado con * (predicción menos fiable).
- La lista indica la categoría (masculina o femenina) al subirla; se aplica a los atletas nuevos del archivo.
- Se puede volver a subir: sustituye a la anterior. La lista de salida es pública (es la que publica la federación): nombre, club y dorsal, sin año de nacimiento.

## Cómo se compara con los apuntados

La coincidencia es por nombre: las palabras del nombre del usuario deben aparecer todas en el del atleta, da igual el orden, las tildes o si viene como «APELLIDOS, NOMBRE» (por ejemplo, «Ana Rodríguez Martín» coincide con «RODRIGUEZ MARTIN, ANA»). Al apuntarse se exigen al menos 3 palabras (nombre y dos apellidos), lo que evita coincidencias con quien solo tiene dos y cada atleta solo cuenta para un apuntado. Los usuarios y los atletas no están enlazados por ningún identificador, así que conviene revisar a mano los «No».

## Datos y privacidad

- `convocatorias`: `id, nombre, deporte, fecha, lugar, estado (abierta | cerrada), creadaPor`.
- `inscripciones`: `id, convocatoriaId, usuarioId, nombre, bici` (único por carrera y usuario). `nombre` es el del perfil (nombre + apellidos), nunca el email; `bici` es la elegida en «Preparar carrera» (`{nombre, tipo}`, opcional).
- `salida`: `id, convocatoriaId, atletaId, clubId?, dorsal?` (único por carrera y atleta).
- Borrar una carrera borra sus inscripciones y su lista de salida.

## API

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/convocatorias` | público | Listado (abiertas por fecha próxima, luego cerradas). Con sesión añade `apuntado`; incluye `participantes` (tamaño de la lista de salida). |
| `POST /api/convocatorias` | admin | Crea una carrera: `{ nombre, deporte, fecha (AAAA-MM-DD), lugar }`. |
| `DELETE /api/convocatorias/:id` | admin | La borra con sus inscripciones y su lista. |
| `PUT` / `DELETE /api/convocatorias/:id/inscripcion` | sesión | Apuntarse (sin cuerpo: el nombre sale del perfil, que debe tener nombre y dos apellidos) / desapuntarse (repetirlo no da error). Solo si está abierta. |
| `PUT /api/convocatorias/:id/inscripcion/bici` | sesión | Elige la bici de la carrera: `{ bici }` con el nombre de una bici del perfil que valga para la carrera; `""` la quita. Hay que estar apuntado. |
| `GET /api/convocatorias/:id/inscripciones` | admin | Quién se ha apuntado. |
| `PUT /api/convocatorias/:id/salida?sexo=M\|F` | admin | Sube la lista de salida (Excel como cuerpo). Devuelve participantes, menores excluidos, filas descartadas y la asistencia. |
| `GET /api/convocatorias/:id/salida` | público | Lista de salida: atleta, club, dorsal. |
| `GET /api/convocatorias/:id/asistencia` | admin | Apuntados frente a la lista de salida. |

Errores: 400 (datos no válidos, carrera cerrada, sin lista subida), 401 (sin sesión), 403 (no es admin) y 404 (carrera inexistente).
