# Modelo de datos del dominio deportivo

Ranking de duatlón y triatlón (y, más adelante, otros deportes) a partir de los resultados publicados por la federación. El modelo vive en la capa de datos (`server/data`) y la lógica en `server/logic/dominio.js`.

## Entidades

| Colección | Campos | Único |
|---|---|---|
| `atletas` | `id`, `clave`, `nombre`, `anioNacimiento`, `sexo?` | `clave` |
| `clubes` | `id`, `clave`, `nombre` | `clave` |
| `pertenencias` | `id`, `atletaId`, `temporada`, `clubId` | `atletaId + temporada` |
| `pruebas` | `id`, `idExterno`, `nombre`, `deporte`, `tipo`, `fecha`, `temporada`, `categoria?` | `idExterno` |
| `resultados` | `id`, `pruebaId`, `atletaId`, `dorsal`, `posicion?`, `tiempoTotal?`, `parciales[]`, `estado` | `pruebaId + atletaId` |
| `sanciones` | `id`, `pruebaId`, `dorsal`, `accion`, `infraccion` | — |

`resultados` y `sanciones` se rellenan en los PBI-15 y PBI-16; sus colecciones e índices ya existen.

## Relaciones

```
club 1 ── n pertenencia n ── 1 atleta
prueba 1 ── n resultado n ── 1 atleta
prueba 1 ── n sanción      (se vincula al resultado por prueba + dorsal)
```

## Decisiones

- **Identidad del atleta.** Los identificadores de la web de resultados son por prueba, no por persona. Un atleta se identifica por `clave` = nombre normalizado (sin tildes, mayúsculas, sin paréntesis ni espacios sobrantes) + `|` + año de nacimiento, por ejemplo `JESUS NARRO MINANO|1990`. Dos personas con el mismo nombre y año se distinguirán a mano ("a revisar", PBI-15).
- **Club por temporada.** Los atletas cambian de club cada año, así que el club no está en el atleta sino en `pertenencias`. Un atleta tiene como máximo un club por temporada.
- **Deporte.** Un ranking independiente por deporte (`duatlon`, `triatlon`). Añadir otro (acuatlón, Hyrox…) es añadir un valor al catálogo.
- **Tipo de prueba.** `individual` (campeonatos) o `liga` (por equipos de clubes). Ambas alimentan el Elo.
- **Estados de un resultado.** `finalizado`, `dnf`, `dns`, `dq`. Se guardan todos, pero solo `finalizado` cuenta para el Elo.
- **Sanciones.** El acta indica dorsal, hasta tres pares acción + infracción. Acciones: `DSQ`, `ST`. Infracciones: `LM`, `OTH`.
- **Sin datos personales en el repositorio.** Los Excel reales no se suben; los tests usan datos sintéticos.

## Repositorios

`coleccionMemoria.js` y `coleccionMongo.js` cumplen el mismo contrato (`crear`, `actualizar`, `buscarPorId`, `buscarUno`, `listar`, `eliminar`). `test/data/contratoDominio.js` ejecuta la misma batería contra ambos. Los índices únicos están en `server/data/indicesDominio.js` y se usan tanto en memoria como en MongoDB.
