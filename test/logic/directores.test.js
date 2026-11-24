// Directores de club (PBI-55): solicitud, aprobación del administrador y panel del club.
import test from "node:test";
import assert from "node:assert/strict";
import { crearServicioDirectores } from "../../server/logic/directores.js";
import { crearServicioDominio } from "../../server/logic/dominio.js";
import { crearServicioUsuarios } from "../../server/logic/usuarios.js";
import { crearRepositorioMemoria } from "../../server/data/repositorioMemoria.js";
import { crearColeccionMemoria } from "../../server/data/coleccionMemoria.js";
import { UNICOS_DOMINIO } from "../../server/data/indicesDominio.js";

const codigo = (c) => (e) => e.codigo === c;
const cifrador = { cifrar: async (t) => `hash(${t})`, comparar: async (t, h) => h === `hash(${t})` };

async function preparar() {
  const repositorio = crearRepositorioMemoria();
  const usuarios = crearServicioUsuarios(repositorio, { cifrador, emailAdmin: "admin@correo.es" });
  const registrar = async (nombre, email) => {
    const u = await usuarios.alta({ nombre, email, password: "ClaveSegura123" });
    await repositorio.actualizar({ ...(await repositorio.buscarPorId(u.id)), estado: "activo" });
    return u.id;
  };
  const admin = await registrar("Admin", "admin@correo.es");
  const ana = await registrar("Ana", "ana@correo.es");
  const luis = await registrar("Luis", "luis@correo.es");
  const repos = Object.fromEntries(Object.entries(UNICOS_DOMINIO).map(([n, u]) => [n, crearColeccionMemoria({ unicos: u })]));
  const dominio = crearServicioDominio(repos);
  const albacete = await dominio.obtenerOCrearClub("Triatlón Albacete");
  const otro = await dominio.obtenerOCrearClub("Otro Club");
  return { admin, ana, luis, repos, dominio, albacete, otro, servicio: crearServicioDirectores({ repos, usuarios, dominio, catalogo: [] }) };
}

test("lista de clubes por orden alfabético", async () => {
  const { servicio } = await preparar();
  assert.deepEqual((await servicio.clubes()).map((c) => c.nombre), ["Otro Club", "Triatlón Albacete"]);
});

test("solicita un club de la lista, el admin aprueba y la persona ve su panel", async () => {
  const { servicio, admin, ana, albacete, repos } = await preparar();
  await assert.rejects(servicio.panel(ana), codigo("PROHIBIDO")); // antes de aprobar no ve nada
  const s = await servicio.solicitar(ana, { clubId: albacete.id });
  assert.equal(s.estado, "pendiente");
  await assert.rejects(servicio.panel(ana), codigo("PROHIBIDO"));
  assert.equal((await servicio.pendientes(admin))[0].solicitante.email, "ana@correo.es");
  await servicio.resolver(admin, s.id, { aprobar: true });
  assert.equal((await servicio.miSolicitud(ana)).estado, "aprobada");

  await repos.atletas.crear({ id: "a1", clave: "k1", nombre: "Atleta Uno" });
  await repos.atletas.crear({ id: "a2", clave: "k2", nombre: "Atleta Dos" });
  await repos.resultados.crear({ id: "r1", pruebaId: "p1", atletaId: "a1", clubId: albacete.id, estado: "finalizado" });
  await repos.resultados.crear({ id: "r2", pruebaId: "p2", atletaId: "a1", clubId: albacete.id, estado: "dnf" });
  await repos.resultados.crear({ id: "r3", pruebaId: "p1", atletaId: "a2", clubId: albacete.id, estado: "finalizado" });
  await repos.ratings.crear({ id: "e1", deporte: "duatlon", atletaId: "a1", clubId: albacete.id, rating: 1600.4, pruebas: 2 });
  await repos.ratings.crear({ id: "e2", deporte: "duatlon", atletaId: "a2", clubId: albacete.id, rating: 1500, pruebas: 1 });
  await repos.ratings.crear({ id: "e3", deporte: "duatlon", atletaId: "a9", clubId: "otro", rating: 1900, pruebas: 1 });
  const p = await servicio.panel(ana);
  assert.equal(p.club.nombre, "Triatlón Albacete");
  assert.deepEqual([p.atletas, p.pruebas, p.resultados, p.finalizados, p.vacio], [2, 2, 3, 2, false]);
  assert.deepEqual(p.deportes, [{ deporte: "duatlon", atletas: 2, mediaElo: 1550, top: [
    { atletaId: "a1", nombre: "Atleta Uno", rating: 1600, pruebas: 2 }, { atletaId: "a2", nombre: "Atleta Dos", rating: 1500, pruebas: 1 }] }]);
});

test("club que no está en la lista: se crea al aprobar y el panel sale vacío con aviso; mismo nombre = mismo club", async () => {
  const { servicio, admin, ana, luis, repos } = await preparar();
  const s = await servicio.solicitar(ana, { nombreClub: "  Club   Nuevo " });
  assert.equal(s.clubNuevo, true);
  assert.equal(s.nombreClub, "Club Nuevo");
  const ok = await servicio.resolver(admin, s.id, { aprobar: true, nombreClub: "Club Nuevo de Albacete" });
  assert.equal(ok.nombreClub, "Club Nuevo de Albacete");
  const p = await servicio.panel(ana);
  assert.equal(p.vacio, true);
  assert.match(p.aviso, /Todavía no hay resultados/);
  const n = (await repos.clubes.listar()).length;
  const s2 = await servicio.solicitar(luis, { nombreClub: "club nuevo de albacete" });
  await servicio.resolver(admin, s2.id, { aprobar: true });
  assert.equal((await repos.clubes.listar()).length, n); // reutiliza el club por su nombre normalizado
});

test("el admin puede unir una solicitud de club nuevo a uno existente", async () => {
  const { servicio, admin, ana, albacete } = await preparar();
  const s = await servicio.solicitar(ana, { nombreClub: "Triatlon Albacete Res" });
  await servicio.resolver(admin, s.id, { aprobar: true, clubId: albacete.id });
  assert.equal((await servicio.panel(ana)).club.id, albacete.id);
});

test("rechazar deja sin acceso y permite volver a solicitar", async () => {
  const { servicio, admin, ana, albacete } = await preparar();
  const s = await servicio.solicitar(ana, { clubId: albacete.id });
  await servicio.resolver(admin, s.id, { aprobar: false });
  await assert.rejects(servicio.panel(ana), codigo("PROHIBIDO"));
  assert.equal((await servicio.solicitar(ana, { clubId: albacete.id })).estado, "pendiente");
});

test("ERROR: validaciones y permisos", async () => {
  const { servicio, admin, ana, luis, albacete } = await preparar();
  await assert.rejects(servicio.solicitar(undefined, { clubId: albacete.id }), codigo("NO_AUTENTICADO"));
  await assert.rejects(servicio.solicitar(ana, {}), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.solicitar(ana, { clubId: albacete.id, nombreClub: "X club" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.solicitar(ana, { nombreClub: "ab" }), codigo("DATOS_INVALIDOS"));
  await assert.rejects(servicio.solicitar(ana, { clubId: "no-existe" }), codigo("NO_ENCONTRADO"));
  const s = await servicio.solicitar(ana, { clubId: albacete.id });
  await assert.rejects(servicio.solicitar(ana, { clubId: albacete.id }), codigo("DATOS_INVALIDOS")); // ya tiene una
  await assert.rejects(servicio.pendientes(luis), codigo("PROHIBIDO"));
  await assert.rejects(servicio.resolver(luis, s.id, { aprobar: true }), codigo("PROHIBIDO"));
  await assert.rejects(servicio.resolver(admin, "no-existe", { aprobar: true }), codigo("NO_ENCONTRADO"));
  await servicio.resolver(admin, s.id, { aprobar: true });
  await assert.rejects(servicio.resolver(admin, s.id, { aprobar: false }), codigo("DATOS_INVALIDOS")); // ya resuelta
  await assert.rejects(servicio.panel(luis), codigo("PROHIBIDO")); // otra persona no ve el panel
});

test("catálogo FETRI: sale en la lista, se solicita y al aprobar se crea el club (una sola vez)", async () => {
  const { repos, dominio, admin, ana, luis, albacete, otro } = await preparar();
  const catalogo = [
    { id: "fetri:TRIATLON ALBACETE", clave: "TRIATLON ALBACETE", nombre: "Triatlón Albacete", comunidad: "Castilla-La Mancha" },
    { id: "fetri:CLUB OFICIAL", clave: "CLUB OFICIAL", nombre: "CLUB OFICIAL", comunidad: "Galicia" },
  ];
  const servicio = crearServicioDirectores({ repos, usuarios: { exigirAdministrador: async () => {}, datosPublicos: async () => null }, dominio, catalogo });
  const lista = await servicio.clubes();
  assert.equal(lista.filter((c) => c.nombre.toLowerCase().includes("albacete")).length, 1); // el existente tapa al del catálogo
  const oficial = lista.find((c) => c.nombre === "CLUB OFICIAL");
  assert.equal(oficial.comunidad, "Galicia");
  const s = await servicio.solicitar(ana, { clubId: oficial.id });
  assert.equal(s.clubNuevo, false);
  const antes = (await repos.clubes.listar()).length;
  await servicio.resolver(admin, s.id, { aprobar: true });
  assert.equal((await repos.clubes.listar()).length, antes + 1);
  assert.equal((await servicio.panel(ana)).club.nombre, "CLUB OFICIAL");
  const s2 = await servicio.solicitar(luis, { clubId: "fetri:CLUB OFICIAL" }); // mismo club: se reutiliza
  assert.equal(s2.clubId, (await servicio.panel(ana)).club.id);
  await assert.rejects(servicio.solicitar(admin, { clubId: "fetri:NO EXISTE" }), codigo("NO_ENCONTRADO"));
  void albacete; void otro;
});

test("el catálogo real de la FETRI se carga completo y sin duplicados", async () => {
  const { cargarCatalogoClubes } = await import("../../server/logic/catalogoClubes.js");
  const c = cargarCatalogoClubes();
  assert.ok(c.length >= 640 && c.length <= 660, `clubes: ${c.length}`);
  assert.equal(new Set(c.map((x) => x.clave)).size, c.length);
  assert.ok(c.some((x) => x.nombre === "CLUB TRIATLÓN ALBACETE RES" && x.comunidad === "Castilla-La Mancha"));
});
