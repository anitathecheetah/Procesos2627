# Despliegue continuo en Google Cloud Run

Cada push a `main` construye la imagen con el `Dockerfile` y despliega una nueva revisión.

## Pasos en la consola de Google Cloud (una sola vez)

1. Crear/seleccionar un proyecto y activar las APIs **Cloud Run**, **Cloud Build** y **Artifact Registry**.
2. Cloud Run → **Crear servicio** → *Implementar continuamente desde un repositorio* → **Configurar con Cloud Build**.
3. Conectar el repositorio `anitathecheetah/Procesos2627`, rama `main`, tipo de compilación **Dockerfile** (`/Dockerfile`).
4. Región (p. ej. `europe-west1`), permitir invocaciones sin autenticar, y crear.
5. Comprobar que `https://<url-del-servicio>/api/salud` devuelve `{"estado":"ok"}`.

## Variables de entorno
Se configuran en Cloud Run (servicio → Editar y desplegar nueva revisión → Variables). Nunca en el repositorio.

## Probar la imagen en local
```bash
docker build -t procesos2627 .
docker run --rm -p 8080:8080 -e PORT=8080 procesos2627
```

URL desplegada: _(completar tras el primer despliegue)_
