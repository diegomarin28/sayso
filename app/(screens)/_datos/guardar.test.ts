import { afterEach, describe, expect, it, vi } from "vitest";
import { guardar, reintentarGuardado } from "./guardar";
import { guardarLocal, leerCaso, marcarPendiente, mezclarCasos, type ResumenServidor } from "./mis-casos";
import type { Foto } from "../../../shared";

/** Cómo responde el servidor a /api/casos en cada prueba. "cuenta" es la consulta de sesión (sin Supabase). */
let modo: "ok" | "red" | "401" = "ok";
/** Los cuerpos de los pedidos a /api/casos, en orden. */
const pedidos: { caso?: unknown; fotos?: { foto: { id: string } }[] }[] = [];

vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/cuenta") {
      return Response.json({ configurado: false, sesion: false, anonima: false, email: null, nombre: null });
    }
    if (url === "/api/casos" && init?.body) pedidos.push(JSON.parse(String(init.body)));
    if (modo === "red") throw new TypeError("fetch failed");
    if (modo === "401") return new Response("{}", { status: 401 });
    return Response.json({ guardado: true, fotos: [] });
  }),
);

const caso = (id: string) => ({
  id,
  clase: "otro" as const,
  sintoma: "no carga",
  estado: "captura" as const,
  creadoEn: "2026-10-21T10:00:00.000Z",
});

/** Espera a que la cola termine y el caso quede con el valor pedido. */
const esperarPendiente = (id: string, pendiente: boolean) =>
  vi.waitFor(() => expect(leerCaso(id)?.pendienteServidor).toBe(pendiente));

afterEach(() => {
  modo = "ok";
  pedidos.length = 0;
  vi.clearAllMocks();
});

const foto = (id: string, casoId: string): Foto => ({
  id,
  casoId,
  tipoPedido: "frente",
  url: `blob:${id}`,
  calidad: { nitidez: 0.9, encuadreOk: true },
  aceptada: true,
});
const imagen = { base64: "AAAA", mediaType: "image/jpeg" as const };

describe("guardar: el caso queda marcado si no llega al servidor", () => {
  it("un guardado que llega deja el caso sin marca", async () => {
    guardarLocal({ caso: caso("uno") });
    guardar({ caso: caso("uno") }, "uno");
    await esperarPendiente("uno", false);
  });

  it("sin red queda solo en el celular", async () => {
    modo = "red";
    guardarLocal({ caso: caso("dos") });
    guardar({ caso: caso("dos") }, "dos");
    await esperarPendiente("dos", true);
  });

  it("con la sesión vencida (401) queda solo en el celular", async () => {
    modo = "401";
    guardarLocal({ caso: caso("tres") });
    guardar({ caso: caso("tres") }, "tres");
    await esperarPendiente("tres", true);
  });

  it("un guardado que llega después limpia la marca", async () => {
    modo = "red";
    guardarLocal({ caso: caso("cuatro") });
    guardar({ caso: caso("cuatro") }, "cuatro");
    await esperarPendiente("cuatro", true);
    modo = "ok";
    guardar({ caso: caso("cuatro") }, "cuatro");
    await esperarPendiente("cuatro", false);
  });
});

describe("reintentarGuardado", () => {
  it("cuando llega, el caso deja de estar solo en el celular", async () => {
    modo = "red";
    guardarLocal({ caso: caso("cinco") });
    guardar({ caso: caso("cinco") }, "cinco");
    await esperarPendiente("cinco", true);

    modo = "ok";
    await expect(reintentarGuardado("cinco")).resolves.toBe("ok");
    expect(leerCaso("cinco")?.pendienteServidor).toBe(false);
  });

  it("sin red sigue marcado y devuelve fallo", async () => {
    modo = "red";
    guardarLocal({ caso: caso("seis") });
    guardar({ caso: caso("seis") }, "seis");
    await esperarPendiente("seis", true);

    await expect(reintentarGuardado("seis")).resolves.toBe("fallo");
    expect(leerCaso("seis")?.pendienteServidor).toBe(true);
  });

  it("con la sesión vencida devuelve sesion (para llevar a iniciar sesión)", async () => {
    modo = "401";
    guardarLocal({ caso: caso("siete") });
    await expect(reintentarGuardado("siete")).resolves.toBe("sesion");
    expect(leerCaso("siete")?.pendienteServidor).toBe(true);
  });

  it("un caso que no está en el celular no se puede reintentar", async () => {
    await expect(reintentarGuardado("no-existe")).resolves.toBe("fallo");
  });
});

describe("marcarPendiente y la mezcla con el servidor", () => {
  it("marcar no cambia la fecha de actualización del caso", () => {
    guardarLocal({ caso: caso("ocho") });
    const antes = leerCaso("ocho")?.actualizadoEn;
    marcarPendiente("ocho", true);
    expect(leerCaso("ocho")?.actualizadoEn).toBe(antes);
    expect(leerCaso("ocho")?.pendienteServidor).toBe(true);
  });

  it("la mezcla con el servidor conserva la marca de lo local", () => {
    guardarLocal({ caso: caso("nueve") });
    marcarPendiente("nueve", true);
    const local = leerCaso("nueve")!;
    const servidorCaso: ResumenServidor = {
      caso: caso("nueve"),
      tipoEquipo: null,
      ficha: null,
      cierre: null,
      tieneGuia: false,
      actualizadoEn: "2026-10-20T09:00:00.000Z",
    };
    const [r] = mezclarCasos([local], [servidorCaso]);
    expect(r.pendienteServidor).toBe(true);
  });
});

describe("fotos: pedidos de a 2 y fotos que no se guardan", () => {
  it("con 3 fotos manda 2 pedidos (2 y 1), y el segundo lleva solo sus fotos", async () => {
    guardarLocal({ caso: caso("pedidos") });
    guardar(
      {
        fotos: [
          { foto: foto("p1", "pedidos"), imagen },
          { foto: foto("p2", "pedidos"), imagen },
          { foto: foto("p3", "pedidos"), imagen },
        ],
      },
      "pedidos",
    );
    await vi.waitFor(() => expect(pedidos).toHaveLength(2));
    expect(pedidos.map((p) => p.fotos?.map((f) => f.foto.id))).toEqual([["p1", "p2"], ["p3"]]);
    expect(Object.keys(pedidos[1])).toEqual(["fotos"]);
  });

  it("sin el celular para guardarlas, las fotos que no llegan se cuentan como perdidas", async () => {
    modo = "red";
    guardarLocal({ caso: caso("sinCopia") });
    guardar({ fotos: [{ foto: foto("s1", "sinCopia"), imagen }, { foto: foto("s2", "sinCopia"), imagen }] }, "sinCopia");
    await vi.waitFor(() => expect(leerCaso("sinCopia")?.fotosSinCopia).toBe(2));
    expect(leerCaso("sinCopia")?.pendienteServidor).toBe(true);
  });
});
