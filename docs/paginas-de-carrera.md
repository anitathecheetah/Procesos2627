# Página de cada carrera (estilo Split Lab)

Al abrir una prueba en **Resultados** se muestra con pestañas (se navega con el ratón o con las flechas, Inicio y Fin del teclado). Toda la web usa un tema oscuro.

| Pestaña | Qué muestra |
|---|---|
| **Resumen** | Finalizados sobre salidos, tiempo medio de cada segmento, podio con sus parciales y los 3 mejores de cada segmento. |
| **Splits** | Tiempo de cada finalista en cada segmento y su puesto en él (número pequeño); el mejor tiempo de cada segmento en verde. Alterna «Tiempo» / «Puestos», se ordena pulsando una cabecera y se descarga en CSV (separado por `;`, para Excel). |
| **Clasificación** | Mejor tiempo de cada segmento, y la clasificación con filtros por atleta y club y orden por segmento (PBI-25). |
| **Predicción** | La predicción hecha con el Elo de antes de la prueba comparada con el resultado real (PBI-26, ver [prediccion.md](prediccion.md)). |

## Cómo se calcula

- Los segmentos son los 5 parciales: natación (carrera 1 en duatlón), T1, bici, T2 y carrera.
- El **puesto en un segmento** se calcula entre los finalistas con ese tiempo válido (mayor que 0); si dos atletas empatan, comparten el mejor puesto.
- Los abandonos y los finalistas con parciales incompletos no entran en puestos, medias ni mejores de segmento, pero siguen en la Clasificación.
- Los cálculos están en `client/js/segmentos.js` (sin DOM, con pruebas) y las pestañas en `client/js/pestanas.js`.

## Pendiente (hito S3 Hito 1)

Gráficos «Carrera» y «Posiciones», comparar atletas, análisis por clubes, predicción visual con rangos, configuración de distancias y ritmos, y la repetición animada.
