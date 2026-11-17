# Predicción de posiciones de una carrera

Para una carrera por venir (por ejemplo, el clasificatorio de Águilas de 2027) la web calcula, a partir del Elo, cuántas opciones tiene cada atleta de ganar, de subir al podio y de quedar entre los 10 primeros. Es una estimación, no una garantía: no sabe quién está lesionado, el recorrido ni el día que tendrá cada uno.

## Cómo se calcula

1. **Datos:** el Elo actual de cada atleta de la lista de salida (el del último recálculo del ranking; ver [ranking-elo.md](ranking-elo.md)).
2. **Modelo:** cada día, el rendimiento de un atleta es su Elo más un factor de suerte (ruido de Gumbel de escala 400/ln 10). Con esa escala, la probabilidad de que A llegue antes que B es exactamente la de la fórmula Elo, `1 / (1 + 10^((Rb − Ra) / 400))`. Por tanto, la predicción es coherente con el ranking: 400 puntos más de Elo son un 91 % de ganar el duelo.
3. **Simulación:** se corre la carrera 5000 veces (entre 100 y 20000) y se cuenta cuántas veces queda cada atleta en cada puesto.
4. **Resultado por atleta:** posición media, probabilidad de victoria, de podio y de top 10, y el **rango**: del puesto que se alcanza o supera en el 10 % de las simulaciones al que se alcanza en el 90 % (el 80 % de las veces acaba entre esos dos puestos).

El generador de números aleatorios usa una semilla fija: con los mismos datos, la predicción es siempre la misma.

## Lista de salida

Se puede usar:

- **La lista de salida oficial de una carrera futura** (la sube el administrador, ver [convocatorias.md](convocatorias.md)): se predice a **todos** los que van a competir. Quien no tiene Elo en el deporte parte de 1500 y sale marcado (`sinHistorial`). Es la opción recomendada y la que viene elegida si existe.
- **Una prueba anterior** (p. ej. Águilas 2026): **todos** sus participantes (salvo los que no salieron), sin recortar la lista, con su Elo actual. Quien tiene ya otra prueba posterior tiene el Elo actualizado.
- **Los mejores del ranking** (por defecto 100, hasta 300), filtrando por sexo. Es solo una aproximación: no sabe quién va a competir de verdad.

Mientras la federación no publique la lista de salida, la edición anterior es la mejor aproximación.

## Comparar con el resultado real («predicción vs resultado»)

Con una prueba ya disputada y `retrospectiva=true`, la predicción usa el Elo que tenía cada atleta **antes** de esa prueba y añade su puesto real. Se muestra el **error medio**: diferencia media, en puestos, entre el orden previsto y el real entre quienes terminaron. Sirve para ver si el modelo acierta. Hace falta que el ranking esté recalculado con esa prueba.

## API

`GET /api/prediccion/:deporte` (pública)

| Parámetro | Significado |
|---|---|
| `convocatoria` | id de una carrera futura con lista de salida oficial |
| `base` | id de la prueba cuyos participantes forman la lista de salida (no se combina con `convocatoria`) |
| `sexo` | `M` o `F` (solo sin `base`) |
| `maximo` | máximo de atletas, solo sin `base` (2–300, por defecto 100) |
| `simulaciones` | 100–20000 (por defecto 5000) |
| `retrospectiva` | `true`: Elo previo a la prueba base y resultado real (necesita `base`) |

Devuelve `{ deporte, simulaciones, retrospectiva, base, errorMedio?, filas }`; cada fila tiene `posicionPrevista`, `atleta`, `club`, `rating`, `posicionMedia`, `probVictoria`, `probPodio`, `probTop10`, `rango` y, con `retrospectiva`, `posicionReal`. Errores: 400 (parámetros no válidos o menos de 2 atletas con ranking) y 404 (prueba base inexistente).

En la web está en la tarjeta **Predicción de una carrera**; al abrirla ya viene elegida la prueba de Águilas más reciente.
