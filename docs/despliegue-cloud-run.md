# Despliegue continuo en Google Cloud Run

Cada push a `main` construye la imagen con el `Dockerfile` y despliega una nueva revisión.

## Pasos en la consola de Google Cloud (una sola vez)

1. Crear/seleccionar un proyecto y activar las APIs **Cloud Run**, **Cloud Build** y **Artifact Registry**.
2. Cloud Run → **Crear servicio** → *Implementar continuamente desde un repositorio* → **Configurar con Cloud Build**.
3. Conectar el repositorio `anitathecheetah/Procesos2627`, rama `main`, tipo de compilación **Dockerfile** (`/Dockerfile`).
4. Región (p. ej. `europe-west1`), permitir invocaciones sin autenticar, y crear.
5. Comprobar que `https://<url-del-servicio>/api/salud` devuelve `{"estado":"ok"}`.

## Variables de entorno
Se configuran en Cloud Run (servicio → **Editar y desplegar nueva revisión → Variables y secretos**). Nunca en el repositorio.

| Variable | Valor | Tipo |
|---|---|---|
| `NODE_ENV` | `production` | Variable |
| `MONGODB_URI` | Cadena de Atlas con la contraseña | Secreto (mejor en Secret Manager) |
| `SECRETO_SESION` | Cadena aleatoria larga (p. ej. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | Secreto |
| `ADMIN_EMAIL` | Email del administrador | Variable |
| `LOG_LEVEL` | `info` | Variable (opcional) |

`PORT` lo fija Cloud Run solo. En producción el servidor **no arranca** si faltan `MONGODB_URI` o `SECRETO_SESION`, para no desplegar por error con datos en memoria o sin secreto.

### Atlas debe aceptar a Cloud Run
Cloud Run no tiene IP fija. En Atlas → **Network Access** hay que permitir `0.0.0.0/0` (la protección es el usuario y la contraseña de la base de datos).

### Comprobar el arranque
Tras desplegar, abrir `https://<url-del-servicio>/api/salud` (debe responder `{"estado":"ok"}`) y registrar un usuario. Si la revisión no arranca, los **Registros** de Cloud Run indican qué variable falta.

## Probar la imagen en local
```bash
docker build -t procesos2627 .
docker run --rm -p 8080:8080 -e PORT=8080 procesos2627
```

URL desplegada: _(completar tras el primer despliegue)_
