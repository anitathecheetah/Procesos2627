# Preparar una carrera (PBI-40)

En «Próximas carreras»:

- Cada carrera muestra **cuántos días faltan** (hoy, mañana, «Faltan N días», «Hace N días»). Se calcula en el servidor con la fecha de España.
- Quien tiene sesión y está apuntado ve arriba **«Tu próxima carrera»** con su cuenta atrás.
- **«Preparar carrera»** abre la previsión del tiempo y el material recomendado.

## Previsión del tiempo
Se usa [Open-Meteo](https://open-meteo.com) (gratuita, sin clave). El servidor localiza el **lugar** de la carrera (el administrador lo escribe al crearla; lo que va entre paréntesis se ignora) y pide la previsión de esa fecha: temperatura mínima y máxima, probabilidad de lluvia y viento máximo. Open-Meteo solo prevé unos **16 días**; antes de eso se explica cuándo aparecerá. Las respuestas se guardan 1 hora y, si el servicio falla o no encuentra el lugar, la carrera se muestra igual sin previsión.

## Material recomendado
Reglas sencillas (`server/logic/preparacion.js`): camiseta térmica y guantes con frío (mínima ≤ 8 °C o máxima ≤ 14 °C), gorra, crema y sales con calor (≥ 27 °C), cortavientos y gafas transparentes con probabilidad de lluvia ≥ 40 %, aviso sobre ruedas altas con viento ≥ 30 km/h, nutrición siempre y neopreno/antiempañante en triatlón. Cada sugerencia explica el motivo y enlaza a una **búsqueda** para comparar reseñas actuales: la app no guarda una base de productos ni inventa valoraciones.

## API
`GET /api/convocatorias/:id/preparacion` (público) → `{ carrera, diasRestantes, tiempo, sinPrevision, recomendaciones }`. `GET /api/convocatorias` añade `diasRestantes`.
