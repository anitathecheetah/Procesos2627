# Directores de club (PBI-55)

Un director técnico puede tener, además de su cuenta de deportista, acceso a las estadísticas de los atletas de su club.

## Flujo
1. En «Mi perfil», tarjeta «Director de club»: eliges tu club de la lista (los clubes que existen en la app) o, si no aparece,
   «Mi club no está en la lista» y escribes el nombre.
2. La solicitud queda **pendiente**. Mientras no se apruebe no se ve ningún dato (403).
3. El administrador ve las solicitudes en «Administración», y las **aprueba** o **rechaza**. En un club nuevo puede corregir
   el nombre; por API también puede unirlo a un club existente (`clubId`) si es el mismo con otra grafía.
4. Un club nuevo se crea con el mismo criterio de nombre normalizado que la importación: cuando se importen pruebas en las que
   figure con ese nombre, sus atletas aparecerán en el panel. Hasta entonces el panel sale vacío con un aviso.
5. Si la solicitud se rechaza se puede volver a solicitar. Cada persona tiene una solicitud vigente a la vez.

## Panel del club
Atletas, pruebas, resultados (y finalizados) del club y, por deporte, atletas con ranking, Elo medio y los 10 mejores.
Solo datos públicos de los resultados: **nunca** el perfil privado (peso, altura, material).

## API
- `GET /api/clubes` (sesión) · `POST /api/directores/solicitudes` `{clubId}` o `{nombreClub}` · `GET /api/directores/solicitudes/yo`
- `GET /api/directores/solicitudes` y `PUT /api/directores/solicitudes/:id` `{aprobar, clubId?, nombreClub?}` (solo administrador)
- `GET /api/directores/panel` (solo director aprobado)
- Colección `solicitudesClub`. Un club con una solicitud no se borra al eliminar sus pruebas.

## Catálogo de clubes de la FETRI
`server/data/clubes-fetri-2026.txt` contiene los 658 clubes distintos del Ranking Nacional de Clubes 2026
(https://live.triatlon.org/Rankings/RkClub, copiado el 24/11/2026), con su comunidad autónoma cuando la web la indica
(unos 240 no la traen). La lista de la solicitud mezcla los clubes que ya existen en la app con los del catálogo que aún no
existen (id `fetri:…`). Al aprobar una solicitud de un club del catálogo, el club se crea si no existe. Un club del catálogo
no cuenta como «club nuevo» y se identifica por su nombre normalizado, igual que en la importación.
Limitación: si el Excel de resultados escribe el club de otra forma (p. ej. «TRIATLON ALBACETE RES» y «CLUB TRIATLÓN ALBACETE
RES»), son clubes distintos para la app; el administrador puede unirlos al aprobar (`clubId`).

## Más adelante
Unir clubes desde la pantalla de administración y actualizar el catálogo cada temporada.

## Dónde está en la web
La sección del menú «Mi perfil» (antes «Cuenta») reúne tres tarjetas: **Mi cuenta** (sesión, contraseña, eliminar cuenta),
**Mi perfil y mi material** y **Director de club**.

## Unir clubes desde Administración
En «Solicitudes de director de club», cada solicitud cuyo club aún no existe (nuevo o del catálogo) lleva un desplegable:
«Crear club nuevo» (o «Club del catálogo») o «Unir a: <club existente>». Sirve para el mismo club escrito de otra forma
(p. ej. «TRIATLON ALBACETE RES» y «CLUB TRIATLÓN ALBACETE RES»): al aprobar, la solicitud queda asociada al club elegido y no se
crea uno duplicado.
