import test from "node:test";
import assert from "node:assert/strict";
import { OTRO_CLUB, cuerpoSolicitud, textoEstadoSolicitud } from "../../client/js/solicitudClub.js";

test("cuerpoSolicitud: club de la lista o nombre nuevo", () => {
  assert.deepEqual(cuerpoSolicitud({ club: "c1", nombreClub: "ignorado" }), { clubId: "c1" });
  assert.deepEqual(cuerpoSolicitud({ club: OTRO_CLUB, nombreClub: "  Mi Club " }), { nombreClub: "Mi Club" });
});

test("textoEstadoSolicitud", () => {
  assert.equal(textoEstadoSolicitud(null), "");
  assert.match(textoEstadoSolicitud({ estado: "pendiente", nombreClub: "X", clubNuevo: true }), /\(club nuevo\).*pendiente/);
  assert.match(textoEstadoSolicitud({ estado: "aprobada", nombreClub: "X" }), /Eres director de X/);
  assert.match(textoEstadoSolicitud({ estado: "rechazada", nombreClub: "X" }), /rechazada/);
});

import { cuerpoResolucion, esDelCatalogo } from "../../client/js/solicitudClub.js";

test("cuerpoResolucion: unir a un club existente, club nuevo o club del catálogo", () => {
  assert.deepEqual(cuerpoResolucion({ clubNuevo: true, nombreClub: "X" }, { clubId: "c1", nombreClub: "Y" }), { aprobar: true, clubId: "c1" });
  assert.deepEqual(cuerpoResolucion({ clubNuevo: true, nombreClub: "X" }, { nombreClub: "  Y  " }), { aprobar: true, nombreClub: "Y" });
  assert.deepEqual(cuerpoResolucion({ clubNuevo: true, nombreClub: "X" }, { nombreClub: " " }), { aprobar: true, nombreClub: "X" });
  assert.deepEqual(cuerpoResolucion({ clubNuevo: false, nombreClub: "X" }), { aprobar: true });
  assert.ok(esDelCatalogo("fetri:ABC") && !esDelCatalogo("uuid-1"));
});
