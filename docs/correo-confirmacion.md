# Confirmación de cuenta por correo

Al registrarse, la cuenta queda **pendiente** y se envía un correo con un enlace (`/api/confirmar?token=…`). Al abrirlo, la cuenta pasa a **activa** y se puede iniciar sesión.

## Cómo funciona

- `server/logic/correo.js` envía el correo con [nodemailer](https://nodemailer.com) por SMTP.
- El correo lleva el texto y una versión HTML. El nombre del usuario se escapa en el HTML.
- **Si el envío falla, el registro no falla:** la cuenta queda pendiente y el error, con el enlace de confirmación, se escribe en el log del servidor para que un administrador pueda recuperarlo.
- **Si no hay configuración de correo**, todo funciona como antes: el enlace se escribe en el log (`Confirmación de …`).

## Variables de entorno

| Variable | Descripción |
|---|---|
| `SMTP_HOST` | Servidor SMTP, por ejemplo `smtp.gmail.com` |
| `SMTP_PORT` | Puerto (por defecto 465, con TLS) |
| `SMTP_USER` | Usuario SMTP (el correo remitente) |
| `SMTP_PASS` | Contraseña SMTP. **Es un secreto**: en Cloud Run, como secreto o variable, nunca en el repositorio |
| `SMTP_FROM` | Remitente que verá el usuario (por defecto `SMTP_USER`) |
| `URL_PUBLICA` | Dirección pública de la app, sin barra final, para construir el enlace (por ejemplo `https://procesos2627-960872498786.europe-west1.run.app`) |

Hacen falta las cuatro primeras (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) y `URL_PUBLICA`; si falta alguna, no se envía correo.

## Configurarlo con una cuenta de Gmail

1. En la cuenta de Google que enviará los correos, activa la **verificación en dos pasos**.
2. Entra en <https://myaccount.google.com/apppasswords> y crea una **contraseña de aplicación** (16 caracteres). Úsala como `SMTP_PASS`; no es la contraseña normal de la cuenta.
3. En Cloud Run → servicio → pestaña **Contenedores** → **Variables y secretos**, añade `SMTP_HOST=smtp.gmail.com`, `SMTP_USER`, `SMTP_PASS` y `URL_PUBLICA`.
4. Pulsa **Volver a implementar**.
5. Regístrate con un correo tuyo y comprueba que llega (mira también la carpeta de spam).

Gmail limita el envío diario (unos 500 correos); basta para este proyecto.

## Pruebas

Se hacen con el envío simulado de nodemailer (`jsonTransport`): no sale ningún correo real. Cubren el contenido del correo, el escape del nombre, el fallo del servidor de correo sin romper el registro y el flujo completo registro → correo → enlace → cuenta activa → inicio de sesión.
