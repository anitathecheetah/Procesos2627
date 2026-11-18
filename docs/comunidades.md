# Comunidad autónoma de la licencia (PBI-41)

Igual que Split Lab clasifica por país, aquí se clasifica por **comunidad autónoma**. Ojo: no es de dónde es el atleta, sino la **federación autonómica en la que sacó su licencia federativa**.

## De dónde sale
El Excel de la federación trae la columna `FEDERACION` con un código corto (por ejemplo `MAD`). Al importar se guarda ese código **tal cual** en cada resultado (`federacion`). La comunidad se deduce al consultar con el catálogo de `server/logic/catalogos.js` (`COMUNIDADES`: las 17 comunidades más Ceuta y Melilla, con su código y alias como `CV`, `Cataluña` o `Euskadi`). Como no se guarda el nombre, **corregir el catálogo arregla también las pruebas ya importadas**, sin reimportar. Un código que no se reconoce se muestra tal cual y no rompe nada; un Excel sin la columna se importa igual, sin comunidad.

Las pruebas importadas antes de este cambio no tienen `federacion`: hay que borrarlas e importarlas otra vez para que la tengan.

## Dónde se ve
- **Clasificación de una prueba:** columna «Licencia» y filtro «Comunidad de la licencia» (solo con las comunidades que aparecen en esa prueba).
- **Ranking de atletas:** columna «Licencia» y filtro por comunidad. Como la licencia puede cambiar de una temporada a otra, se usa la de la **última prueba** en la que corrió el atleta.
- API: `GET /api/comunidades` (catálogo), `GET /api/ranking/:deporte?comunidad=Cataluña`, y cada fila de clasificación y de ranking lleva `comunidad`.

## Límites
- El filtro por comunidad es del ranking de atletas; el de clubes no se filtra (un club puede tener atletas con licencias de varias comunidades).
- Los códigos reales que usa la federación hay que contrastarlos con un Excel real; si alguno no se reconoce, basta con añadirlo como alias en `COMUNIDADES`.
