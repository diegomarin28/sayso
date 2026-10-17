import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Ficha, Foto, PedidoDeFoto } from "../../shared";
import { ErrorIA, pedirJson, type LlamarIA } from "../ia/claude";
import { decidirAceptacion, evaluarFoto } from "./calidad";
import { estadoCampo, leerChapa } from "./chapa";
import { EntradaCalidad } from "./entrada";
import { decidirPedidos, MAX_EXTRA, pedidosBase } from "./pedidos";

/** Simula al modelo devolviendo, en orden, cada respuesta de la lista. */
function falso(...respuestas: unknown[]): LlamarIA & { llamadas: number } {
  let i = 0;
  const f = Object.assign(
    async () => {
      f.llamadas++;
      const r = respuestas[Math.min(i++, respuestas.length - 1)];
      return typeof r === "string" ? r : JSON.stringify(r);
    },
    { llamadas: 0 },
  );
  return f;
}

const imagen = { base64: "AAAA", mediaType: "image/jpeg" as const };

describe("pedirJson", () => {
  const S = z.object({ n: z.number().min(0).max(1) });

  it("reintenta una vez si no valida", async () => {
    const llamar = falso({ n: 5 }, { n: 0.5 });
    expect(await pedirJson(S, { modelo: "x", system: "", contenido: [] }, llamar)).toEqual({ n: 0.5 });
    expect(llamar.llamadas).toBe(2);
  });

  it("falla con ErrorIA si no valida dos veces", async () => {
    const llamar = falso("no es json", { n: 5 });
    await expect(pedirJson(S, { modelo: "x", system: "", contenido: [] }, llamar)).rejects.toBeInstanceOf(ErrorIA);
    expect(llamar.llamadas).toBe(2);
  });
});

describe("decidirPedidos", () => {
  it("notebook pide al menos etiqueta, frente y puertos", () => {
    const tipos = pedidosBase("notebook").map((p) => p.tipo);
    expect(tipos).toEqual(["etiqueta", "frente", "puertos"]);
  });

  it("agrega extras de la IA, sin duplicar tipos base y con tope", async () => {
    const llamar = falso({
      extras: [
        { tipo: "etiqueta", instruccion: "otra etiqueta", advertencia: null },
        { tipo: "otro", instruccion: "Foto del cargador y su ficha", advertencia: null },
        { tipo: "interior", instruccion: "Foto por la rejilla", advertencia: "Apagala antes" },
        { tipo: "otro", instruccion: "Una más", advertencia: null },
      ],
    });
    const { pedidos, extrasDeIA } = await decidirPedidos("notebook", "no carga la batería", llamar);
    expect(extrasDeIA).toBe(MAX_EXTRA);
    expect(pedidos.filter((p) => p.tipo === "etiqueta")).toHaveLength(1);
    expect(pedidos[4].advertencia).toBe("Apagala antes");
    pedidos.forEach((p) => PedidoDeFoto.parse(p));
  });

  it("si la IA falla, devuelve solo la base", async () => {
    const llamar = falso("basura");
    const { pedidos, extrasDeIA } = await decidirPedidos("notebook", "x", llamar);
    expect(extrasDeIA).toBe(0);
    expect(pedidos).toHaveLength(3);
  });
});

describe("calidad", () => {
  it("rechaza una foto movida aunque el modelo diga que el encuadre está bien", async () => {
    const llamar = falso({ nitidez: 0.3, encuadreOk: true, muestraLoPedido: true, motivo: "Salió movida." });
    const { foto } = await evaluarFoto({ casoId: "c1", tipoPedido: "etiqueta", imagen }, llamar);
    expect(Foto.parse(foto).aceptada).toBe(false);
    expect(foto.motivoRechazo).toBe("Salió movida.");
  });

  it("acepta una foto nítida y bien encuadrada", async () => {
    const llamar = falso({ nitidez: 0.9, encuadreOk: true, muestraLoPedido: true, motivo: null });
    const { foto } = await evaluarFoto({ casoId: "c1", tipoPedido: "frente", imagen, url: "u" }, llamar);
    expect(foto.aceptada).toBe(true);
    expect(foto.motivoRechazo).toBeUndefined();
    expect(foto.url).toBe("u");
  });

  it("acota la nitidez a [0,1] y pone motivo por defecto", () => {
    expect(decidirAceptacion({ nitidez: -2, encuadreOk: true, muestraLoPedido: true, motivo: null }).motivoRechazo).toMatch(
      /movida/,
    );
    expect(decidirAceptacion({ nitidez: 1, encuadreOk: true, muestraLoPedido: false, motivo: null }).aceptada).toBe(false);
  });

  it("valida la entrada y saca el prefijo data:", () => {
    const r = EntradaCalidad.parse({
      casoId: "c1",
      tipoPedido: "etiqueta",
      imagen: { base64: "data:image/jpeg;base64,QUJD", mediaType: "image/jpeg" },
    });
    expect(r.imagen.base64).toBe("QUJD");
    expect(EntradaCalidad.safeParse({ casoId: "c1", tipoPedido: "x", imagen }).success).toBe(false);
  });
});

describe("chapa", () => {
  const transcripcion = "LENOVO  Type: 20XW-CTO1WW  S/N: PF2ABC12  Made in China 2021";

  it("confirma solo lo que se lee claro y aparece en la transcripción", () => {
    expect(estadoCampo({ valor: "20XWCTO1WW", lectura: "clara" }, transcripcion).estado).toBe("confirmado");
    expect(estadoCampo({ valor: "PF2ABC12", lectura: "dudosa" }, transcripcion).estado).toBe("probable");
    // inventado: no aparece en la etiqueta → nunca confirmado
    expect(estadoCampo({ valor: "ThinkPad E14", lectura: "clara" }, transcripcion).estado).toBe("probable");
    expect(estadoCampo({ valor: null, lectura: "clara" }, transcripcion)).toEqual({ valor: null, estado: "desconocido" });
    expect(estadoCampo({ valor: "  ", lectura: "clara" }, transcripcion).estado).toBe("desconocido");
  });

  it("arma una Ficha válida sin confirmar por el usuario", async () => {
    const llamar = falso({
      transcripcion,
      marca: { valor: "Lenovo", lectura: "clara" },
      modelo: { valor: "20XW-CTO1WW", lectura: "clara" },
      serie: { valor: "PF2ABC1?", lectura: "dudosa" },
      anio: { valor: null, lectura: "dudosa" },
    });
    const { ficha } = await leerChapa({ casoId: "c1", clase: "notebook", imagenes: [imagen] }, llamar);
    Ficha.parse(ficha);
    expect(ficha.confirmadaPorUsuario).toBe(false);
    expect(ficha.marca.estado).toBe("confirmado");
    expect(ficha.modelo).toEqual({ valor: "20XW-CTO1WW", estado: "confirmado", fuente: "chapa" });
    expect(ficha.serie.estado).toBe("probable");
    expect(ficha.anio.estado).toBe("desconocido");
  });
});
