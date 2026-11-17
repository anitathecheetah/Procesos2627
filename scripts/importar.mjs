// Importa uno o varios Excel de resultados llamando a la API (inicia sesión como administrador).
//
//   node scripts/importar.mjs --fecha 2026-02-15 archivo1.xlsx archivo2.xlsx
//   opciones: --url http://localhost:3000  --email tu@correo.es  --fecha AAAA-MM-DD
//             --deporte duatlon|triatlon (por defecto se deduce del nombre del archivo)
//             --menores excluir|incluir (por defecto excluir: no se importa a quien pueda ser menor de edad)
//   La contraseña se lee de la variable IMPORTAR_PASSWORD o se pregunta por teclado.
//
// Del nombre del archivo (p. ej. 2449-5790_aguilas-duatlon_elite-masculino.xlsx) se deduce:
//   idExterno = 2449-5790 · nombre = "aguilas duatlon" · deporte = duatlon · categoria = elite-masculino · sexo = M
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";

const args = process.argv.slice(2);
const opciones = {};
const archivos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) opciones[args[i].slice(2)] = args[++i];
  else archivos.push(args[i]);
}
const url = opciones.url ?? "http://localhost:3000";
if (opciones.menores && !["excluir", "incluir"].includes(opciones.menores)) {
  console.error("--menores debe ser excluir o incluir");
  process.exit(1);
}
if (!archivos.length || !opciones.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(opciones.fecha)) {
  console.error("Uso: node scripts/importar.mjs --fecha AAAA-MM-DD [--email correo] [--url http://localhost:3000] archivo.xlsx ...");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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

for (const archivo of archivos) {
  const base = path.basename(archivo, path.extname(archivo));
  const [id, nombre = base, categoria = ""] = base.split("_");
  const deporte = opciones.deporte ?? (/triatlon/i.test(base) ? "triatlon" : /duatlon/i.test(base) ? "duatlon" : "");
  const sexo = /femenin/i.test(categoria) ? "F" : /masculin/i.test(categoria) ? "M" : "";
  const consulta = new URLSearchParams({
    idExterno: id, nombre: nombre.replaceAll("-", " "), deporte, fecha: opciones.fecha, categoria, ...(sexo ? { sexo } : {}),
    soloMayores: String(opciones.menores !== "incluir"),
  });
  const respuesta = await fetch(`${url}/api/pruebas/importar?${consulta}`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/octet-stream" }, body: await readFile(archivo),
  });
  const cuerpo = await respuesta.json();
  if (respuesta.ok) {
    console.log(`OK    ${base}: ${cuerpo.importados} resultados, ${cuerpo.descartadas.length} descartadas, ${cuerpo.revisar.length} para revisar, ${cuerpo.menoresExcluidos} menores excluidos`);
  } else {
    console.log(`ERROR ${base}: ${cuerpo.error} (${respuesta.status})`);
  }
}
