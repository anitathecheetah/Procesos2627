# Ranking Elo

Un ranking independiente por deporte (duatlón y triatlón), calculado con las pruebas importadas. Un atleta que corre ambos deportes tiene un rating distinto en cada uno. Las pruebas son por categoría (masculina o femenina), así que no hay duelos entre sexos; el ranking se puede filtrar con `sexo=M|F` (el sexo sale del atleta, que se toma de la categoría de la prueba importada).

## Fórmula

- **Rating inicial:** 1500 la primera vez que un atleta puntúa en un deporte.
- **Una carrera son duelos.** Cada participante se enfrenta a cada uno de los demás. Gana el duelo quien llegó antes (posición final menor). Misma posición: empate (0,5).
- **Probabilidad esperada** de que A gane a B: `E = 1 / (1 + 10^((Rb − Ra) / 400))`.
- **Cambio por duelo:** `Kduelo · (resultado − E)`, con `resultado` 1, 0,5 o 0.
- **Peso de la carrera:** `Kduelo = K / (n − 1)`, con `K = 32` y `n` los participantes que puntúan. Así una carrera pesa lo mismo con 20 que con 100 participantes: el cambio de un atleta en una prueba nunca supera K.
- Todos los cambios de una carrera se calculan con los ratings de **antes** de la carrera y se aplican a la vez. La suma de los cambios es 0: no se crean ni se pierden puntos.

## Quién puntúa

- Cuentan solo los **finalizados** con posición. **DNF, DNS y descalificados** (por el estado del Excel o por una sanción DSQ) quedan guardados pero no puntúan en esa prueba.
- La posición que se usa es la final real (los invitados ocupan su puesto en la llegada).
- Una prueba con menos de 2 participantes que puntúen no mueve a nadie.
- Todas las pruebas puntúan por igual, sean campeonatos individuales o ligas de clubes.

## Determinismo y recálculo

El recálculo borra el ranking del deporte y lo reconstruye recorriendo las pruebas **por fecha** (a igual fecha, por su identificador externo). Con los mismos resultados da siempre el mismo ranking, da igual el orden en que se importaron.

Hay que recalcular después de importar pruebas nuevas o cargar sanciones: ni la importación ni las sanciones lo hacen solas. El botón **Recalcular el ranking** de la página lo hace (solo administradores).

## Historial

Tras cada prueba se guarda el rating de antes y de después de cada atleta (`historialElo`). Aparece en su ficha (`GET /api/atletas/:id`, campo `elo`).

## API

- `GET /api/ranking/:deporte?pagina=1&tamano=50&minPruebas=1&sexo=M`: ranking de mayor a menor rating, paginado (tamaño máximo 100). Público.
- `POST /api/ranking/:deporte/recalcular`: recalcula (solo administradores) y devuelve `{ deporte, pruebas, atletas }`.

## Límites de esta versión

K fijo (sin K mayor para novatos), sin envejecimiento del rating por inactividad y sin pesos por tipo de prueba. Son ajustes posibles cuando haya más datos para calibrarlos.
