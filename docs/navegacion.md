# Navegación: barra lateral y paneles

La web se organiza en **secciones**, cada una en su propio panel. Se cambia de sección con la barra lateral de la izquierda; solo se ve el panel de la sección activa.

| Sección | Dirección | Contenido actual |
|---|---|---|
| Inicio | `#/inicio` | Presentación (se ampliará en el PBI-45) |
| Carreras | `#/carreras` | Resultados, pruebas y búsqueda de atletas |
| Rankings | `#/rankings` | Ranking Elo de atletas y clubes |
| Predicción | `#/prediccion` | Predicción de una carrera |
| Próximas carreras | `#/proximas` | Convocatorias, inscripciones y material |
| Cuenta | `#/cuenta` | Registro, inicio de sesión, cambio de contraseña (se separará en el PBI-43) |
| Admin | `#/admin` | Administración de usuarios. Solo la ve el administrador |

## Cómo funciona

- **Enrutado por la dirección.** La sección está en la parte `#` de la URL, así que funcionan el botón atrás, recargar y compartir el enlace. Una dirección desconocida lleva a Inicio.
- **Admin.** El enlace solo se pinta si la persona es administradora. Si alguien entra en `#/admin` sin serlo, ve Inicio. Es solo presentación: el servidor sigue comprobando el rol en cada petición.
- **Móvil.** Por debajo de 48 rem la barra se oculta y se abre con el botón ☰. Se cierra al elegir una sección o con Escape.
- **Accesibilidad.** La barra es un `nav` con etiqueta, la sección activa lleva `aria-current="page"` y el botón de menú indica `aria-expanded`.

## Código

- `client/js/rutas.js`: lista de secciones y funciones puras (`seccionDeHash`, `seccionesVisibles`). Tiene pruebas en `test/client/rutas.test.js`.
- `client/js/navegacion.js`: pinta la barra y muestra/oculta los paneles (DOM).
- `client/index.html`: cada panel es un `div.panel` con `data-seccion`.

Para añadir una sección: una entrada en `SECCIONES`, un `div.panel` con su `data-seccion` y nada más.
