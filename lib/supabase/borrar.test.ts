import { describe, expect, it } from "vitest";
import { borrarCasos, borrarUsuario } from "./borrar";
import { BUCKET_FOTOS_USUARIOS, ErrorSupabase } from "./repo";
import { supabaseFalso } from "./supabase-falso";

const YO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const ALTA = "2026-01-01T00:00:00.000Z";

function escenario(fallar: Parameters<typeof supabaseFalso>[0]["fallar"] = []) {
  return supabaseFalso({
    tablas: {
      casos: [
        { id: "a", dueno: YO },
        { id: "b", dueno: YO },
        { id: "c", dueno: OTRO },
      ],
      fotos: [
        { id: "fa", caso_id: "a" },
        { id: "fc", caso_id: "c" },
      ],
      eventos: [{ id: "ea", caso_id: "a" }],
      guias: [{ caso_id: "b" }],
    },
    bucket: { [BUCKET_FOTOS_USUARIOS]: ["a/fa.jpg", "a/fa2.png", "b/fb.webp", "c/fc.jpg"] },
    usuarios: [
      { id: YO, email: "yo@ejemplo.com", created_at: ALTA },
      { id: OTRO, is_anonymous: true, created_at: ALTA },
    ],
    fallar,
  });
}

describe("borrarUsuario («Borrar cuenta», docs/login.md §5)", () => {
  it("borra sus archivos del bucket, sus casos con la cascada y el usuario, en ese orden", async () => {
    const s = escenario();
    expect(await borrarUsuario(s.db, YO)).toEqual({ casos: 2, archivos: 3 });
    expect(s.bucket[BUCKET_FOTOS_USUARIOS]).toEqual(["c/fc.jpg"]);
    expect(s.tablas.casos.map((c) => c.id)).toEqual(["c"]);
    expect(s.tablas.fotos.map((f) => f.id)).toEqual(["fc"]);
    expect(s.tablas.eventos).toEqual([]);
    expect(s.tablas.guias).toEqual([]);
    expect(s.usuarios.map((u) => u.id)).toEqual([OTRO]);
    expect(s.escrituras).toEqual(["remove:2", "remove:1", "delete:casos", "deleteUser"]);
  });

  it("sin casos borra solo el usuario", async () => {
    const s = escenario();
    s.tablas.casos = s.tablas.casos.filter((c) => c.dueno !== YO);
    expect(await borrarUsuario(s.db, YO)).toEqual({ casos: 0, archivos: 0 });
    expect(s.escrituras).toEqual(["deleteUser"]);
  });

  it("si fallan los archivos no borra filas ni el usuario", async () => {
    const s = escenario(["remove"]);
    await expect(borrarUsuario(s.db, YO)).rejects.toThrow(ErrorSupabase);
    expect(s.tablas.casos).toHaveLength(3);
    expect(s.usuarios).toHaveLength(2);
    expect(s.escrituras).toEqual([]);
  });

  it("si fallan las filas no borra el usuario (y los archivos ya no están)", async () => {
    const s = escenario(["delete:casos"]);
    await expect(borrarUsuario(s.db, YO)).rejects.toThrow(ErrorSupabase);
    expect(s.tablas.casos).toHaveLength(3);
    expect(s.usuarios).toHaveLength(2);
    expect(s.escrituras).toEqual(["remove:2", "remove:1"]);
  });

  it("se puede volver a correr después de una falla", async () => {
    const s = escenario(["deleteUser"]);
    await expect(borrarUsuario(s.db, YO)).rejects.toThrow(ErrorSupabase);
    const t = supabaseFalso({ tablas: s.tablas, bucket: s.bucket, usuarios: s.usuarios });
    expect(await borrarUsuario(t.db, YO)).toEqual({ casos: 0, archivos: 0 });
    expect(t.usuarios.map((u) => u.id)).toEqual([OTRO]);
  });
});

describe("borrarCasos", () => {
  it("borra solo esos casos y sus archivos", async () => {
    const s = escenario();
    expect(await borrarCasos(s.db, ["c"])).toEqual({ casos: 1, archivos: 1 });
    expect(s.bucket[BUCKET_FOTOS_USUARIOS]).toEqual(["a/fa.jpg", "a/fa2.png", "b/fb.webp"]);
    expect(s.tablas.casos.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("sin casos no hace nada", async () => {
    const s = escenario();
    expect(await borrarCasos(s.db, [])).toEqual({ casos: 0, archivos: 0 });
    expect(s.escrituras).toEqual([]);
  });
});
