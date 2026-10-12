# Procesos2627
[![CI](https://github.com/anitathecheetah/Procesos2627/actions/workflows/ci.yml/badge.svg)](https://github.com/anitathecheetah/Procesos2627/actions/workflows/ci.yml)

Proyecto de Ingeniería del Software curso 26-27
Bienvenidos al Proyecto de Procesos 26-27

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

Ejecuta con `node:test` todas las pruebas de `test/`. Hoy son pruebas de la API con peticiones HTTP reales (`test/api`). Se ejecutan automáticamente en GitHub Actions (workflow **CI**) en cada pull request y en cada cambio en `main`; no se integra un PR con el CI en rojo.

## Variables de entorno

Ver `.env.example` (solo nombres, sin valores reales). Copia el archivo a `.env` para usarlo en local; `.env` no se sube al repositorio.

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP (Cloud Run lo fija automáticamente). |
| `NODE_ENV` | `development`, `production` o `test`. |

## Flujo de trabajo (GitHub Flow)

1. Crear una rama por cambio: `git switch -c feature/<descripcion>`.
2. Programar y ejecutar `npm test` en local.
3. `git push -u origin feature/<descripcion>` y abrir un pull request contra `main`.
4. Esperar el CI en verde e integrar el PR (*Create a merge commit*).
5. El cambio en `main` se despliega automáticamente (se configura con el PBI-03).

Al cerrar cada hito se etiqueta el último commit de `main` (`hito-1`, `hito-2`, `hito-3`).

## Licencia

MIT. Consulta el archivo [LICENSE](LICENSE).
