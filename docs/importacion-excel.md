# Importación de resultados desde Excel

Un administrador sube la clasificación de **una categoría de una prueba** (por ejemplo, "Élite masculino") en el `.xlsx` que ofrece la web de resultados de la federación. El archivo se lee en memoria y **no se guarda**; solo se guardan los resultados.

## Endpoint

`POST /api/pruebas/importar?idExterno=…&nombre=…&deporte=duatlon|triatlon&fecha=AAAA-MM-DD[&tipo=individual|liga][&categoria=…][&sexo=M|F]`

- Cuerpo: el archivo `.xlsx` en binario. Máximo 10 MB.
- Solo administradores (401 sin sesión, 403 si no es administrador).
- `idExterno` identifica la prueba en la web de origen (por ejemplo `2449-5790`): reimportarla devuelve **409** y no duplica nada.
- Respuesta **201**: `{ prueba, importados, menoresExcluidos, descartadas: [{fila, motivo}], revisar: [{atleta, dorsal, motivos}] }`.
- Errores: 400 si el archivo no es un Excel, faltan columnas o los datos de la prueba no son válidos.

Ejemplo: `curl -X POST -b cookie.txt --data-binary @resultados.xlsx -H "Content-Type: application/octet-stream" "http://localhost:3000/api/pruebas/importar?idExterno=2449-5790&nombre=Duatl%C3%B3n%20%C3%81guilas&deporte=duatlon&fecha=2026-02-15&sexo=M"`

## Menores de edad

Las clasificaciones de la federación incluyen a menores. **Por defecto no se importan**: se excluye a quien, por su año de nacimiento, pueda tener menos de 18 años en el año de la prueba (año de la prueba − año de nacimiento ≤ 18; por prudencia también cae quien cumple 18 ese año). Se descartan antes de guardar nada, así que su nombre y su año de nacimiento no llegan a la base de datos ni al log; la respuesta solo dice cuántos se han excluido (`menoresExcluidos`). Si todo el archivo son posibles menores, no se crea la prueba (400).

Para incluirlos hay que pedirlo expresamente: `soloMayores=false` en la petición o `--menores incluir` en el script. No debe hacerse con datos reales sin permiso de la federación.

## Eliminar una prueba

`DELETE /api/pruebas/:id` (solo administradores; 401 sin sesión, 403 si no es administrador, 404 si no existe) elimina la prueba con sus resultados, sanciones y el historial de Elo que generó. Los atletas y clubes que se quedan **sin ninguna otra prueba** también se eliminan, con su rating; quien sigue en otras pruebas se conserva. Responde `{ eliminada, idExterno, deporte, resultados, atletasEliminados, clubesEliminados }`. No se puede deshacer, pero la prueba se puede volver a importar con el mismo `idExterno`.

Después hay que **recalcular el ranking** de ese deporte, para que quienes siguen no conserven puntos de la prueba eliminada.

Script: `node scripts/borrar-pruebas.mjs --url <app> --email <admin> <idExterno> [<idExterno> …]`. Enseña qué pruebas va a eliminar y pide escribir `si` antes de borrar nada.

## Estructura del Excel

Columnas: `EVENTO, PHASE, ID, NOMBRE, AÑO, CLUB, FEDERACION, DORSAL, NACIMIENTO, 5 parciales, POSICION, POSICION_FINAL, ESTADO, TIEMPO` (más columnas a la derecha, que se ignoran). Se localizan por el nombre de la cabecera.

- Los 5 parciales son carrera, T1, ciclismo, T2, carrera (duatlón) o natación, T1, ciclismo, T2, carrera (triatlón). La clasificación de una prueba los muestra con esos nombres según su deporte (una columna por segmento); el importador es el mismo para los dos deportes, solo cambia `deporte=` en la petición. Las pruebas de triatlón se importan con las mismas columnas y se calculan en un ranking propio. Los títulos de algunos ficheros están mal puestos, por eso no se usan.
- El **atleta** se identifica por nombre normalizado + `NACIMIENTO` (el `ID` del Excel es de la prueba, no de la persona).
- **Posición**: se usa `POSICION_FINAL`, el orden real de llegada. `POSICION` deja fuera a los invitados.
- **Estado**: `DNF`, `DNS`, `DQ`/`DSQ` si lo indica la columna. Si no, un atleta con posición marcador (≥ 10000) o sin tiempo total no ha clasificado: con parciales es DNF y sin ellos DNS.
- Las filas con un parcial vacío vienen con las celdas desplazadas a la izquierda; por eso las columnas de resultado se leen por el contenido de cada celda, no por posición. En ese caso los parciales no se guardan y la fila se marca "para revisar".

## Qué se marca para revisar

- Mismo nombre que otro atleta pero con distinto año de nacimiento (posible homónimo o error de año).
- Parciales incompletos.

Se descartan, con motivo y número de fila, las filas sin año de nacimiento, sin posición siendo finalistas, con un estado desconocido o con un atleta repetido en el mismo archivo.

## Atomicidad

Si algo falla a mitad de la importación, se borran la prueba y los resultados ya creados, para poder reintentarla.

## Datos reales

Los Excel reales contienen nombres y años de nacimiento (incluidos menores). **No se suben al repositorio**; las pruebas usan Excel sintéticos (`test/helpers/excelSintetico.js`).

## Script de importación

Para subir uno o varios Excel sin escribir `curl` a mano:

```
node scripts/importar.mjs --fecha 2026-02-15 --email admin@correo.es "ruta\al\archivo.xlsx"
```

Pide la contraseña (o la lee de `IMPORTAR_PASSWORD`). Opciones: `--url` (por defecto `http://localhost:3000`) y `--deporte`. Del nombre del archivo, con el formato de la descarga (`2449-5790_aguilas-duatlon_elite-masculino.xlsx`), deduce el identificador, el nombre, el deporte, la categoría y el sexo. La fecha hay que indicarla porque el nombre del archivo no la trae; usa un comando por cada fecha.

## Mejor segmento y filtros en una prueba

Al abrir una prueba en **Resultados** se ve:

- **Mejor tiempo de cada segmento** (natación o carrera 1, T1, bici, T2, carrera): el tiempo y quién lo hizo (si hay empate, todos). Solo cuentan los finalistas con los 5 parciales completos y mayores que 0; abandonos y filas «para revisar» no entran. Lo calcula la API en `GET /api/pruebas/:id` (campo `mejoresSegmentos`, una posición por segmento, `null` si nadie tiene tiempo válido).
- En la clasificación, la marca ★ señala el mejor tiempo de cada segmento.
- **Filtros**: por atleta, por club (texto, sin importar tildes ni mayúsculas) y «Ordenar por» el mejor tiempo de natación/carrera 1, T1, bici, T2 o carrera (de menor a mayor; quien no tiene ese parcial va al final).
