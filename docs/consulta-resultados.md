# Consulta de pruebas y atletas

Endpoints públicos (no exigen sesión), de solo lectura:

| Endpoint | Devuelve |
|---|---|
| `GET /api/pruebas?deporte=duatlon\|triatlon&temporada=2026` | Pruebas, las más recientes primero, con el número de participantes |
| `GET /api/pruebas/:id` | La prueba y su clasificación: finalistas por posición, luego descalificados, abandonos (DNF) y no salidos (DNS). Cada fila lleva atleta, club, dorsal, tiempo, parciales y sanciones |
| `GET /api/atletas?q=texto` | Búsqueda por nombre (mínimo 2 letras): ignora tildes, mayúsculas y el orden de las palabras. Máximo 50 resultados |
| `GET /api/atletas/:id` | Ficha: clubes por temporada e historial de resultados con sus sanciones |
| `GET /api/pruebas/:id/sanciones` | Sanciones de la prueba |

Errores: 400 (filtro o búsqueda inválidos) y 404 (prueba o atleta inexistente), siempre como `{ error, codigo }`.

## Interfaz

La página principal muestra el listado de pruebas con filtro por deporte, el detalle de la clasificación y un buscador de atletas con su ficha. Todo el texto se inserta con `textContent`, nunca como HTML.

## Privacidad

Los resultados incluyen el nombre y el año de nacimiento de los atletas, algunos menores. Antes de publicar datos reales hay que tener el permiso de la federación (ver el aviso legal de su web de resultados).
