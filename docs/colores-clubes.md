# Colores de los clubes de Primera División

Los 22 clubes que juegan en Primera División de la liga de triatlón (Iberdrola y Suzuki) o de duatlón en 2026 tienen un color
(o varios) asociado: el de su maillot. Los eligió el usuario. Las clasificaciones de las divisiones salen de
https://live.triatlon.org/leagues (24/11/2026). La liga general (todas las competiciones) queda fuera por ahora.

## Dónde se ven
Un punto de color junto al nombre del club en el **ranking** (de atletas y de clubes). Con varios colores el punto lleva franjas;
al pasar el ratón sale la descripción («naranja y azul», «cebra (blanco y negro)»...). Los clubes sin color no llevan punto.

## Cómo funciona
- Tabla en `server/logic/coloresClubes.js` (`COLORES_CLUBES`), con colores `#rrggbb` y una descripción.
- El color va con el **club**, no con la división: si un club sube o baja, mantiene su color. Se reconoce por el nombre
  normalizado (sin tildes ni mayúsculas) y por variantes habituales («Peñota Dental Alusigma», «Triatlón Albacete Res»...).
- La API de ranking y la consulta de resultados añaden `colores` y `descripcionColor` al club cuando lo tiene.
- Solo entran en el estilo valores `#rrggbb` (nada de texto libre).

## Cómo añadir o cambiar un color
Editar `COLORES_CLUBES` (y `VARIANTES` si el club se escribe de otra forma en los Excel) y ajustar el test.
