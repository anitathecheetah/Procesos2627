// Punto de entrada del backend: arranca el servidor HTTP.
import { crearApp } from "./app.js";

const PORT = process.env.PORT || 3000;

crearApp().listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
