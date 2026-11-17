# Página de cada carrera (estilo Split Lab)

Al abrir una prueba en **Resultados** se muestra con pestañas (se navega con el ratón o con las flechas, Inicio y Fin del teclado). Toda la web usa un tema oscuro.

| Pestaña | Qué muestra |
|---|---|
| **Resumen** | Finalizados sobre salidos, tiempo medio de cada segmento, podio con sus parciales y los 3 mejores de cada segmento. |
| **Splits** | Tiempo de cada finalista en cada segmento y su puesto en él (número pequeño); el mejor tiempo de cada segmento en verde. Alterna «Tiempo» / «Puestos», se ordena pulsando una cabecera y se descarga en CSV (separado por `;`, para Excel). |
| **Clasificación** | Mejor tiempo de cada segmento, y la clasificación con filtros por atleta y club y orden por segmento (PBI-25). |
| **Predicción** | La predicción hecha con el Elo de antes de la prueba comparada con el resultado real (PBI-26, ver [prediccion.md](prediccion.md)). |

## Ritmos y distancias

Sobre las pestañas hay un selector de **distancias de la prueba**, y de ellas salen los ritmos (PBI-35):

- **Natación:** min por 100 m. **Bici:** km/h. **Carrera:** min por km (en duatlón, las dos carreras, cada una con su distancia). T1 y T2 solo tienen tiempo.
- Los ritmos aparecen bajo cada media del **Resumen**, junto al tiempo de los 3 mejores de cada segmento y en **Splits** con el botón **Ritmo**. Los ritmos en min:seg se truncan al segundo, como en Split Lab.
- Distancias predefinidas: triatlón súper sprint (300 m · 8 km · 2,5 km), sprint (750 m · 20 km · 5 km) y estándar/olímpica (1,5 km · 40 km · 10 km); duatlón sprint (5 km · 20 km · 2,5 km) y estándar (10 km · 40 km · 5 km). También se pueden escribir **personalizadas**. Por defecto: triatlón estándar y duatlón sprint.
- La elección se recuerda por deporte en el navegador de cada persona; todavía no se guarda en la prueba. Si una prueba tiene otras distancias, hay que elegirlas.
- Los cálculos están en `client/js/ritmos.js` (sin DOM, con pruebas).

## Cómo se calcula

- Los segmentos son los 5 parciales: natación (carrera 1 en duatlón), T1, bici, T2 y carrera.
- El **puesto en un segmento** se calcula entre los finalistas con ese tiempo válido (mayor que 0); si dos atletas empatan, comparten el mejor puesto.
- Los abandonos y los finalistas con parciales incompletos no entran en puestos, medias ni mejores de segmento, pero siguen en la Clasificación.
- Los cálculos están en `client/js/segmentos.js` (sin DOM, con pruebas) y las pestañas en `client/js/pestanas.js`.

## Pendiente (hito S2 Hito 4)

Gráficos «Carrera» y «Posiciones», comparar atletas, análisis por clubes, predicción visual con rangos, configuración de distancias y ritmos, y la repetición animada.
