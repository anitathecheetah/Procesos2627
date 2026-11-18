# Procesos2627
[![CI](https://github.com/anitathecheetah/Procesos2627/actions/workflows/ci.yml/badge.svg)](https://github.com/anitathecheetah/Procesos2627/actions/workflows/ci.yml)

Proyecto de Ingeniería del Software curso 26-27
Bienvenidos al Proyecto de Procesos 26-27

**Aplicación desplegada:** https://procesos2627-960872498786.europe-west1.run.app (Google Cloud Run, se despliega solo con cada cambio en `main`).

# Sprint 1: Desarrollar la arquitectura base del proyecto
El objetivo del Sprint 1 es definir la arquitectura base de una aplicación tipo SaaS, organizada en capas y con gestión de usuarios.

## Arquitectura en capas

El backend sirve también el frontend (mismo origen). Toda la lógica de negocio vive en el servidor y el cliente solo se comunica con él a través de la API.

```
Cliente (navegador)   client/        interfaz servida por el backend
        |  HTTP/JSON, mismo origen
Capa API              server/api/    peticiones HTTP -> llamadas a la lógica
Capa lógica           server/logic/  reglas de gestión de usuarios
Capa de datos         server/data/   repositorio de usuarios
```

Frontera entre capas:

| Capa | Hace | No hace |
|---|---|---|
| `server/api` | Traducir HTTP a llamadas a la lógica y errores a códigos HTTP | Reglas de negocio, acceso a datos |
| `server/logic` | Reglas de usuarios y permisos | Conocer Express o la base de datos |
| `server/data` | Guardar y leer usuarios | Reglas de negocio, HTTP |
| `client/js/ui.js` | Pintar la interfaz | Hacer peticiones al servidor |
| `client/js/api.js` | Comunicarse con la API | Tocar el DOM |

## Tecnologías y justificación

| Tecnología | Para qué | Por qué |
|---|---|---|
| Node.js 22 + Express 5 | Backend y API REST | Un solo lenguaje (JavaScript) en servidor y cliente; Express es mínimo y deja ver las capas. |
| JavaScript con módulos ES (sin framework) en el cliente | Frontend | El proyecto es pequeño; separar `ui.js` y `api.js` basta para cumplir la separación interfaz / comunicación. |
| MongoDB Atlas (M0, gratis) | Persistencia | Gratuito, sin servidor propio que mantener y accesible desde Cloud Run. |
| bcryptjs | Hash de contraseñas | bcrypt es un estándar para contraseñas; la versión en JavaScript puro evita compilar código nativo en Docker y en el CI. |
| Cookies firmadas con HMAC (`node:crypto`) | Sesión | Sin dependencias extra; cookie `HttpOnly` y `SameSite=Lax`, e id de sesión aleatorio guardado en la base de datos. |
| `node:test` | Pruebas | Incluido en Node, sin dependencias. |
| GitHub Actions | Integración continua | Está junto al repositorio; ejecuta las pruebas con un MongoDB de servicio. |
| Docker + Google Cloud Run + Cloud Build | Despliegue continuo | Cloud Run ejecuta la imagen sin gestionar servidores y Cloud Build despliega al hacer push a `main`. |

## Ejecutar en local

Requisitos: Node.js 22 o superior.

```bash
npm install
npm start
```

La aplicación queda en http://localhost:3000 y la comprobación de salud en http://localhost:3000/api/salud.

## Ejecutar las pruebas

```bash
npm test
```

Ejecuta con `node:test` todas las pruebas de `test/`. Las pruebas con MongoDB real (`test/data/repositorioMongo.test.js`) solo se ejecutan si defines `MONGODB_URI_PRUEBA` (en el CI hay un MongoDB de servicio); sin ella se omiten. Hoy son pruebas de la API con peticiones HTTP reales (`test/api`). Se ejecutan automáticamente en GitHub Actions (workflow **CI**) en cada pull request y en cada cambio en `main`; no se integra un PR con el CI en rojo.

## Variables de entorno

Ver `.env.example` (solo nombres, sin valores reales). Copia el archivo a `.env` para usarlo en local; `.env` no se sube al repositorio.

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP (Cloud Run lo fija automáticamente). |
| `NODE_ENV` | `development`, `production` o `test`. |
| `ADMIN_EMAIL` | Email del administrador inicial. Quien se registre y confirme con ese email tiene rol `admin`; si ya existía, se promociona al arrancar (idempotente). |
| `LOG_LEVEL` | Nivel de log: `debug`, `info` (por defecto), `warn`, `error` o `silencio`. Se registran altas, confirmaciones, inicios de sesión (también los fallidos) y eliminaciones; nunca contraseñas. |
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas (es un secreto). Obligatoria en producción; en desarrollo, si falta, los datos se guardan en memoria y se pierden al reiniciar. |
| `MONGODB_DB` | Nombre de la base de datos (opcional; por defecto `procesos`). |
| `SECRETO_SESION` | Secreto con el que se firman las cookies de sesión. Obligatorio en producción; en desarrollo, si falta, se genera uno aleatorio (las sesiones se pierden al reiniciar). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `URL_PUBLICA` | Opcionales: envío del correo de confirmación de cuenta (ver [docs/correo-confirmacion.md](docs/correo-confirmacion.md)). Sin `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` y `URL_PUBLICA`, el enlace de confirmación se escribe en el log del servidor. `SMTP_PASS` es un secreto. |

## Acceso de administrador

El administrador no tiene contraseña por defecto. Se define con la variable `ADMIN_EMAIL`:

1. Pon en `.env` (o en las variables de Cloud Run) `ADMIN_EMAIL=tu-email@ejemplo.com`.
2. Regístrate en la aplicación con ese email y confirma el enlace recibido (en local aparece en el log del servidor). Si ya estabas registrada, el administrador se asigna al arrancar el servidor; hacerlo varias veces no cambia nada.
3. Al iniciar sesión verás el panel «Administración de usuarios» con el listado y el botón de eliminar.

## Cambiar la contraseña

Con la sesión iniciada, la tarjeta «Sesión iniciada» tiene el formulario «Cambiar contraseña». Pide la contraseña actual y la nueva dos veces. La nueva debe tener al menos 10 caracteres, un número y una mayúscula y ser distinta de la actual. La API es `PUT /api/usuarios/yo/password` con `{ "actual": "…", "nueva": "…" }` y responde 204; si algo falla responde 400 `{ error, codigo }` y no cambia nada. La contraseña se guarda cifrada (bcrypt) y nunca aparece en el log. Es la forma de sustituir una contraseña débil o que se haya compartido, también la del administrador.

## Secretos

Ningún secreto está en el código ni en el historial de git: se comprobó buscando cadenas de conexión, contraseñas y archivos `.env` en todos los commits. `.env` está en `.gitignore` y solo se versiona `.env.example` (con los nombres). Los secretos son `MONGODB_URI` y `SECRETO_SESION`. Si alguno se publica por error, hay que **cambiarlo** (nueva contraseña del usuario de Atlas, nuevo secreto de sesión), no solo borrarlo del repositorio.

## Flujo de trabajo (GitHub Flow)

1. Crear una rama por cambio: `git switch -c feature/<descripcion>`.
2. Programar y ejecutar `npm test` en local.
3. `git push -u origin feature/<descripcion>` y abrir un pull request contra `main`.
4. Esperar el CI en verde e integrar el PR (*Create a merge commit*).
5. El cambio en `main` se despliega automáticamente: un activador de Cloud Build construye la imagen con el `Dockerfile` y publica una revisión nueva en Cloud Run (guía en `docs/despliegue-cloud-run.md`).

Al cerrar cada hito se etiqueta el último commit de `main` (`hito-1`, `hito-2`, `hito-3`).

## Ranking Elo de duatlón y triatlón

Cada prueba importada se trata como duelos entre todos los participantes según su posición final; los DNF, DNS y descalificados no puntúan. El ranking se recalcula por fecha y es determinista. También hay un ranking de clubes (media del Elo de sus mejores atletas). La fórmula, sus decisiones y los límites están en [docs/ranking-elo.md](docs/ranking-elo.md). Con ese Elo se puede **predecir una carrera** (probabilidad de victoria, podio y top 10 de cada atleta, como Split Lab): ver [docs/prediccion.md](docs/prediccion.md). Cada prueba se abre en una página con pestañas (resumen, splits, clasificación y predicción) y la web usa un tema oscuro: ver [docs/paginas-de-carrera.md](docs/paginas-de-carrera.md). El administrador puede crear las **próximas carreras**, los usuarios apuntarse y, con el listado real de la federación, se compara quién fue de verdad: ver [docs/convocatorias.md](docs/convocatorias.md). La importación de Excel está en [docs/importacion-excel.md](docs/importacion-excel.md) y el modelo de datos en [docs/modelo-de-datos.md](docs/modelo-de-datos.md).
- [Preparar una carrera: cuenta atrás, tiempo y material](docs/preparacion.md)
- [Comunidad autónoma de la licencia](docs/comunidades.md)
- [Navegación: barra lateral y paneles](docs/navegacion.md)

## Licencia

MIT. Consulta el archivo [LICENSE](LICENSE).
