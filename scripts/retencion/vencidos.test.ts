import { describe, expect, it } from "vitest";
import { BUCKET_FOTOS_USUARIOS } from "../../lib/supabase/repo";
import { supabaseFalso, type Usuario } from "../../lib/supabase/supabase-falso";
import { limiteDe, retencion } from "./vencidos";

const AHORA = new Date("2026-10-20T12:00:00.000Z");
const VIEJO = "2026-06-01T00:00:00.000Z"; // más de 90 días
const RECIENTE = "2026-10-01T00:00:00.000Z";

const VENCIDA = "aaaaaaaa-0000-4000-8000-000000000001";
const ANON_ACTIVA = "aaaaaaaa-0000-4000-8000-000000000002";
const ANON_CASO_RECIENTE = "aaaaaaaa-0000-4000-8000-000000000003";
const CON_EMAIL = "aaaaaaaa-0000-4000-8000-000000000004";
const ANON_CON_EMAIL = "aaaaaaaa-0000-4000-8000-000000000005";
const NUNCA_INGRESO = "aaaaaaaa-0000-4000-8000-000000000006";

function escenario() {
  const usuarios: Usuario[] = [
    { id: VENCIDA, is_anonymous: true, last_sign_in_at: VIEJO, created_at: VIEJO },
    { id: ANON_ACTIVA, is_anonymous: true, last_sign_in_at: RECIENTE, created_at: VIEJO },
    { id: ANON_CASO_RECIENTE, is_anonymous: true, last_sign_in_at: VIEJO, created_at: VIEJO },
    { id: CON_EMAIL, email: "persona@ejemplo.com", last_sign_in_at: VIEJO, created_at: VIEJO },
    // Una cuenta con email nunca se borra, aunque venga marcada como anónima.
    { id: ANON_CON_EMAIL, is_anonymous: true, email: "otra@ejemplo.com", last_sign_in_at: VIEJO, created_at: VIEJO },
    { id: NUNCA_INGRESO, is_anonymous: true, created_at: VIEJO },
  ];
  return supabaseFalso({
    usuarios,
    tablas: {
      casos: [
        { id: "v1", dueno: VENCIDA, dispositivo: null, actualizado_en: VIEJO },
        { id: "v2", dueno: VENCIDA, dispositivo: null, actualizado_en: VIEJO },
        { id: "act", dueno: ANON_ACTIVA, dispositivo: null, actualizado_en: VIEJO },
        { id: "rec-viejo", dueno: ANON_CASO_RECIENTE, dispositivo: null, actualizado_en: VIEJO },
        { id: "rec-nuevo", dueno: ANON_CASO_RECIENTE, dispositivo: null, actualizado_en: RECIENTE },
        { id: "mail", dueno: CON_EMAIL, dispositivo: null, actualizado_en: VIEJO },
        { id: "huerfano", dueno: null, dispositivo: null, actualizado_en: VIEJO },
        { id: "huerfano-reciente", dueno: null, dispositivo: null, actualizado_en: RECIENTE },
        // Sin reclamar: tiene dispositivo, no es huérfano.
        { id: "sin-reclamar", dueno: null, dispositivo: "d-1", actualizado_en: VIEJO },
      ],
      fotos: [{ id: "f1", caso_id: "v1" }, { id: "fh", caso_id: "huerfano" }, { id: "fm", caso_id: "mail" }],
    },
    bucket: {
      [BUCKET_FOTOS_USUARIOS]: ["v1/f1.jpg", "v2/f2.jpg", "huerfano/fh.jpg", "mail/fm.jpg", "rec-nuevo/fr.jpg", "huerfano-reciente/x.jpg", "sin-reclamar/s.jpg"],
    },
  });
}

describe("retención de 90 días (#347)", () => {
  it("el límite es 90 días antes", () => {
    expect(limiteDe(AHORA)).toBe("2026-07-22T12:00:00.000Z");
  });

  it("sin --aplicar solo cuenta: no borra nada", async () => {
    const s = escenario();
    const antes = JSON.stringify([s.tablas, s.bucket, s.usuarios]);
    const r = await retencion(s.db, { aplicar: false, ahora: AHORA });
    expect(r).toMatchObject({ aplicado: false, sesiones: 2, casosDeSesiones: 2, casosHuerfanos: 1, archivos: 0, errores: [] });
    expect(s.escrituras).toEqual([]);
    expect(JSON.stringify([s.tablas, s.bucket, s.usuarios])).toBe(antes);
  });

  it("no devuelve emails ni contenido de los casos", async () => {
    const r = await retencion(escenario().db, { aplicar: false, ahora: AHORA });
    expect(JSON.stringify(r)).not.toMatch(/@|v1|huerfano/);
  });

  it("con --aplicar borra las sesiones anónimas vencidas y los huérfanos viejos, con sus archivos", async () => {
    const s = escenario();
    const r = await retencion(s.db, { aplicar: true, ahora: AHORA });
    expect(r).toEqual({ aplicado: true, sesiones: 2, casosDeSesiones: 2, casosHuerfanos: 1, archivos: 3, salteadas: 0, errores: [] });
    expect(s.usuarios.map((u) => u.id).sort()).toEqual([ANON_ACTIVA, ANON_CASO_RECIENTE, CON_EMAIL, ANON_CON_EMAIL].sort());
    expect(s.tablas.casos.map((c) => c.id).sort()).toEqual(
      ["act", "rec-viejo", "rec-nuevo", "mail", "huerfano-reciente", "sin-reclamar"].sort(),
    );
    expect(s.tablas.fotos.map((f) => f.id)).toEqual(["fm"]);
    expect(s.bucket[BUCKET_FOTOS_USUARIOS]).toEqual(["mail/fm.jpg", "rec-nuevo/fr.jpg", "huerfano-reciente/x.jpg", "sin-reclamar/s.jpg"]);
  });

  it("nunca toca cuentas con email ni casos recientes", async () => {
    const s = escenario();
    await retencion(s.db, { aplicar: true, ahora: AHORA });
    expect(s.usuarios.some((u) => u.id === CON_EMAIL)).toBe(true);
    expect(s.usuarios.some((u) => u.id === ANON_CON_EMAIL)).toBe(true);
    expect(s.tablas.casos.some((c) => c.id === "mail")).toBe(true);
    expect(s.tablas.casos.some((c) => c.id === "rec-nuevo")).toBe(true);
    expect(s.tablas.casos.some((c) => c.id === "huerfano-reciente")).toBe(true);
  });

  it("saltea una sesión que guardó sus casos con un email entre la lista y el borrado", async () => {
    const s = escenario();
    const vencida = s.usuarios.find((u) => u.id === VENCIDA)!;
    const getUserById = s.db.auth.admin.getUserById.bind(s.db.auth.admin);
    s.db.auth.admin.getUserById = async (id: string) => {
      if (id === VENCIDA) Object.assign(vencida, { email: "nueva@ejemplo.com", is_anonymous: false });
      return getUserById(id);
    };
    const r = await retencion(s.db, { aplicar: true, ahora: AHORA });
    expect(r).toMatchObject({ sesiones: 1, salteadas: 1, errores: [] });
    expect(s.usuarios.some((u) => u.id === VENCIDA)).toBe(true);
    expect(s.tablas.casos.some((c) => c.id === "v1")).toBe(true);
    expect(s.bucket[BUCKET_FOTOS_USUARIOS]).toContain("v1/f1.jpg");
  });

  it("si falla un borrado lo anota y sigue con lo demás", async () => {
    const s = escenario();
    const original = s.db.auth.admin.deleteUser.bind(s.db.auth.admin);
    s.db.auth.admin.deleteUser = async (id: string) =>
      id === VENCIDA ? { data: { user: null }, error: { message: "caída" } } as never : original(id);
    const r = await retencion(s.db, { aplicar: true, ahora: AHORA });
    expect(r.sesiones).toBe(1);
    expect(r.errores).toEqual(["borrar usuario: caída"]);
    expect(s.tablas.casos.some((c) => c.id === "huerfano")).toBe(false);
  });
});
