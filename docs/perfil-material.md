# Perfil y material del atleta (PBI-54)

Cada usuario puede guardar en «Mi perfil» (tarjeta «Mi perfil y mi material») datos que **solo él puede ver**.

## Qué se guarda
- Nombre, apellidos, club (texto libre).
- Fecha de nacimiento (la **edad se calcula** al leer, para que no se quede anticuada).
- Altura (100–230 cm) y peso (30–250 kg), opcionales. Son datos personales: no salen en ninguna lista ni ranking.
- Zapatillas: triatlón → 1 de correr + ciclismo; duatlón → **2 huecos de correr** (hay dos carreras) + ciclismo.
- Neopreno: modelo y tipo (integral / corto).
- Bicis: hasta 5 (el formulario ofrece 3), con tipo ruta, contrarreloj o MTB.

## API
- `GET /api/usuarios/yo/perfil` → perfil propio (vacío si no hay nada guardado) con `edad`.
- `PUT /api/usuarios/yo/perfil` → sustituye el perfil completo. 400 `DATOS_INVALIDOS` si algo no es válido; 401 sin sesión.
- Al eliminar la cuenta se borra también el perfil.
- Colección `perfiles` (una por usuario, `id = usuarioId`).

## Neopreno en cada carrera
Que el neopreno sea obligatorio, opcional o prohibido depende de la temperatura del agua y del aire y lo decide la
organización según el reglamento. Por eso **no se fijan umbrales de temperatura**: el administrador indica la regla al
crear el triatlón (`obligatorio`, `opcional`, `prohibido` o `por confirmar`, el valor por defecto; en duatlón no aplica).
«Preparar carrera» la muestra y adapta la recomendación:
obligatorio → se avisa de que es obligatorio; opcional → decide con la temperatura confirmada; prohibido → no se recomienda;
por confirmar → mirar el reglamento.

## Drafting y tipo de bici
Con drafting solo se permite la bici de ruta; la de contrarreloj solo vale en pruebas sin drafting. El administrador indica
`permitido`, `prohibido` o `por confirmar` (por defecto) al crear la carrera, y «Preparar carrera» lo muestra.

Las pruebas **cross** (triatlón, duatlón o aquatlón cross) se corren con **MTB**; en el resto no se admite MTB. El administrador
marca «Cross» al crear la carrera (el drafting entonces no influye en la bici).

### Elegir la bici en «Preparar carrera»
Ya no hay una recomendación genérica de bici: quien está apuntado elige en «Mi bici para esta carrera» una de las bicis de su perfil. Las que no valen (MTB fuera de cross, contrarreloj con drafting, o ruta/contrarreloj en cross) salen deshabilitadas con el motivo; con drafting «por confirmar» la contrarreloj vale con un aviso. La elección se guarda en la inscripción.

Nota: en las bases reguladoras de 2026 de la FETRI el drafting depende de la **categoría** dentro de una misma prueba
(élite, sub-23, juvenil, júnior y grupos de edad sprint con drafting; grupos de edad estándar sin drafting; contrarreloj por
equipos sin drafting). El ajuste por carrera es una simplificación.

## Más adelante
Elegir también el resto del material (zapatillas, neopreno) por carrera (fase 2).

## Club del perfil
El campo **Club** es un buscador: al escribir se sugieren los clubes ya subidos (los de la app y los del catálogo de la FETRI). Si el
texto coincide con uno (sin importar mayúsculas ni tildes) se guarda con su nombre oficial. Si no aparece, se puede escribir libremente:
el perfil muestra «Club pendiente de validar por el administrador» y el club aparece en la tarjeta **Clubes propuestos en los perfiles**
de administración (solo el nombre y en cuántos perfiles está, nunca de quién). El administrador puede **validarlo** (tal cual o con el
nombre corregido, creando el club), **unirlo** a un club de la lista o **descartarlo** (se vacía el club de esos perfiles).
API (admin): `GET /api/clubes/propuestos` y `PUT /api/clubes/propuestos` con `{ nombre, clubId? | nombreClub? | descartar? }`.
