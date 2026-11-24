# Perfil y material del atleta (PBI-42)

Cada usuario puede guardar en su cuenta («Mi perfil y material») datos que **solo él puede ver**.

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
`permitido`, `prohibido` o `por confirmar` (por defecto) al crear la carrera, y «Preparar carrera» lo muestra y recomienda la bici.

Las pruebas **cross** (triatlón, duatlón o aquatlón cross) se corren con **MTB**; en el resto no se admite MTB. El administrador
marca «Cross» al crear la carrera y «Preparar carrera» recomienda la MTB (el drafting entonces no influye en la bici).

## Más adelante
Elegir el material usado en cada carrera al apuntarse (fase 2).
