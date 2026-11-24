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

## Más adelante
Cargar como catálogo la lista oficial de clubes de la FETRI.

## Dónde está en la web
La sección del menú «Mi perfil» (antes «Cuenta») reúne tres tarjetas: **Mi cuenta** (sesión, contraseña, eliminar cuenta),
**Mi perfil y mi material** y **Director de club**.

## Unir clubes desde Administración
En «Solicitudes de director de club», cada solicitud cuyo club aún no existe (nuevo o del catálogo) lleva un desplegable:
«Crear club nuevo» (o «Club del catálogo») o «Unir a: <club existente>». Sirve para el mismo club escrito de otra forma
(p. ej. «TRIATLON ALBACETE RES» y «CLUB TRIATLÓN ALBACETE RES»): al aprobar, la solicitud queda asociada al club elegido y no se
crea uno duplicado.
