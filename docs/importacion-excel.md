# Importación de resultados desde Excel

Un administrador sube la clasificación de **una categoría de una prueba** (por ejemplo, "Élite masculino") en el `.xlsx` que ofrece la web de resultados de la federación. El archivo se lee en memoria y **no se guarda**; solo se guardan los resultados.

## Endpoint

`POST /api/pruebas/importar?idExterno=…&nombre=…&deporte=duatlon|triatlon&fecha=AAAA-MM-DD[&tipo=individual|liga][&categoria=…][&sexo=M|F]`

- Cuerpo: el archivo `.xlsx` en binario. Máximo 10 MB.
- Solo administradores (401 sin sesión, 403 si no es administrador).
- `idExterno` identifica la prueba en la web de origen (por ejemplo `2449-5790`): reimportarla devuelve **409** y no duplica nada.
- Respuesta **201**: `{ prueba, importados, descartadas: [{fila, motivo}], revisar: [{atleta, dorsal, motivos}] }`.
- Errores: 400 si el archivo no es un Excel, faltan columnas o los datos de la prueba no son válidos.

Ejemplo: `curl -X POST -b cookie.txt --data-binary @resultados.xlsx -H "Content-Type: application/octet-stream" "http://localhost:3000/api/pruebas/importar?idExterno=2449-5790&nombre=Duatl%C3%B3n%20%C3%81guilas&deporte=duatlon&fecha=2026-02-15&sexo=M"`

## Estructura del Excel

Columnas: `EVENTO, PHASE, ID, NOMBRE, AÑO, CLUB, FEDERACION, DORSAL, NACIMIENTO, 5 parciales, POSICION, POSICION_FINAL, ESTADO, TIEMPO` (más columnas a la derecha, que se ignoran). Se localizan por el nombre de la cabecera.

- Los 5 parciales son carrera, T1, ciclismo, T2, carrera (duatlón) o natación, T1, ciclismo, T2, carrera (triatlón). Los títulos de algunos ficheros están mal puestos, por eso no se usan.
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
