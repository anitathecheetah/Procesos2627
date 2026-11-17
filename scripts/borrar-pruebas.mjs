// Elimina pruebas (con sus resultados) de la app llamando a la API como administrador.
//
//   node scripts/borrar-pruebas.mjs --email tu@correo.es --url https://tu-app 9001-1 9001-2 9001-3
//   Los argumentos son los idExterno de las pruebas (los mismos que se pusieron al importar).
//   Antes de borrar enseña qué pruebas va a eliminar y pide escribir "si". La contraseña se lee de
//   IMPORTAR_PASSWORD o se pregunta. Después hay que recalcular el ranking de los deportes afectados.
import readline from "node:readline/promises";

const args = process.argv.slice(2);
const opciones = {};
const ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) opciones[args[i].slice(2)] = args[++i];
  else ids.push(args[i]);
}
const url = opciones.url ?? "http://localhost:3000";
if (!ids.length) {
  console.error("Uso: node scripts/borrar-pruebas.mjs [--email correo] [--url http://localhost:3000] idExterno ...");
  process.exit(1);
}

const pruebas = await (await fetch(`${url}/api/pruebas`)).json();
const aBorrar = ids.map((id) => ({ id, prueba: pruebas.find((p) => p.idExterno === id) }));
for (const { id, prueba } of aBorrar) {
  console.log(prueba ? `Se eliminará ${id}: ${prueba.nombre} (${prueba.deporte}, ${prueba.fecha}, ${prueba.participantes} participantes)` : `No existe la prueba ${id}`);
}
const existentes = aBorrar.filter((x) => x.prueba);
if (!existentes.length) process.exit(1);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
if ((await rl.question('Esto no se puede deshacer. Escribe "si" para continuar: ')).trim().toLowerCase() !== "si") {
  console.log("Cancelado.");
  process.exit(0);
}
const email = opciones.email ?? (await rl.question("Email de administrador: ")).trim();
const password = process.env.IMPORTAR_PASSWORD ?? (await rl.question("Contraseña: "));
rl.close();

const login = await fetch(`${url}/api/sesion`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.error(`No se pudo iniciar sesión (${login.status}): ${(await login.json()).error}`);
  process.exit(1);
}
const cookie = login.headers.getSetCookie()[0].split(";")[0];

const deportes = new Set();
for (const { id, prueba } of existentes) {
  const r = await fetch(`${url}/api/pruebas/${prueba.id}`, { method: "DELETE", headers: { Cookie: cookie } });
  const cuerpo = await r.json();
  if (r.ok) {
    deportes.add(cuerpo.deporte);
    console.log(`OK    ${id}: ${cuerpo.resultados} resultados, ${cuerpo.atletasEliminados} atletas y ${cuerpo.clubesEliminados} clubes eliminados`);
  } else {
    console.log(`ERROR ${id}: ${cuerpo.error} (${r.status})`);
  }
}
if (deportes.size) console.log(`Ahora recalcula el ranking de: ${[...deportes].join(", ")}`);
