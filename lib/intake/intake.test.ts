import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Caso, Ficha, Foto, PedidoDeFoto } from "../../shared";
import { ErrorIA, pedirJson, type LlamarIA } from "../ia/claude";
import { decidirAceptacion, evaluarFoto } from "./calidad";
import { estadoCampo, fichaConFoto, fichaVacia, leerChapa, reconocerPorFoto } from "./chapa";
import { EntradaCalidad, EntradaChapa } from "./entrada";
import { entender } from "./entender";
import { decidirPedidos, pedidosBase } from "./pedidos";

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

  it("la IA arma la lista según el tipo de equipo, sin repetir tipos y con tope", async () => {
    let pedido = "";
    const llamar: LlamarIA = async (p) => {
      pedido = JSON.stringify(p.contenido);
      return JSON.stringify({
        pedidos: [
          { tipo: "etiqueta", instruccion: "Abrí la puerta y sacale una foto a la etiqueta de la pared lateral.", advertencia: null },
          { tipo: "etiqueta", instruccion: "otra etiqueta", advertencia: null },
          { tipo: "frente", instruccion: "Foto de la heladera entera.", advertencia: null },
          { tipo: "otro", instruccion: "Foto del motor de atrás.", advertencia: "Desenchufala antes" },
          { tipo: "otro", instruccion: "Foto del congelador.", advertencia: null },
          { tipo: "interior", instruccion: "Foto adentro.", advertencia: null },
          { tipo: "puertos", instruccion: "una de más", advertencia: null },
        ],
      });
    };
    const { pedidos, porIA } = await decidirPedidos("otro", "no enfría", llamar, "heladera no frost");
    expect(porIA).toBe(true);
    expect(pedido).toContain("heladera no frost");
    expect(pedidos.map((p) => p.tipo)).toEqual(["etiqueta", "frente", "otro", "otro", "interior"]);
    expect(pedidos[2].advertencia).toBe("Desenchufala antes");
    pedidos.forEach((p) => PedidoDeFoto.parse(p));
  });

  it("si la IA no pide la etiqueta, el código la agrega", async () => {
    const llamar = falso({ pedidos: [{ tipo: "frente", instruccion: "Foto del microondas.", advertencia: null }] });
    const { pedidos } = await decidirPedidos("otro", "no calienta", llamar, "microondas");
    expect(pedidos.map((p) => p.tipo)).toEqual(["etiqueta", "frente"]);
  });

  it("si la IA falla, va la lista fija de la clase", async () => {
    const { pedidos, porIA } = await decidirPedidos("notebook", "x", falso("basura"));
    expect(porIA).toBe(false);
    expect(pedidos.map((p) => p.tipo)).toEqual(["etiqueta", "frente", "puertos"]);
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

describe("entender", () => {
  it("saca clase y síntoma de la IA y arma un Caso válido", async () => {
    const llamar = falso({ clase: "notebook", tipoEquipo: "Notebook gamer", sintoma: "Se apaga sola." });
    const r = await entender("mi compu portátil se apaga sola", llamar, "c9");
    expect(Caso.parse(r.caso)).toMatchObject({ id: "c9", clase: "notebook", sintoma: "Se apaga sola.", estado: "captura" });
    expect(r.porIA).toBe(true);
    expect(r.tipoEquipo).toBe("notebook gamer");
    expect(r.seguridad.bloqueado).toBe(false);
  });

  it("si la IA falla, usa 'otro' y el texto tal cual", async () => {
    const r = await entender("  algo raro  ", falso("basura"));
    expect(r.caso.clase).toBe("otro");
    expect(r.caso.sintoma).toBe("algo raro");
    expect(r.porIA).toBe(false);
  });

  it("bloquea por el texto de la persona aunque la IA lo resuma suave", async () => {
    const r = await entender("huele a gas cerca del calefón", falso({ clase: "otro", tipoEquipo: "calefón", sintoma: "Hay un olor." }));
    expect(r.seguridad.bloqueado).toBe(true);
  });
});

describe("reconocer por foto", () => {
  it("lo que sale de la foto queda probable (fuente foto) y solo llena lo desconocido", async () => {
    const llamar = falso({ marca: "Samsung", modelo: "Galaxy A54", confianza: "media" });
    const r = await reconocerPorFoto({ clase: "otro", tipoEquipo: "celular", imagenes: [imagen] }, llamar);
    const conMarca = { ...fichaVacia("c1", "otro"), marca: { valor: "Samsung", estado: "confirmado" as const, fuente: "chapa" } };
    const f = fichaConFoto(conMarca, r);
    expect(f.marca.estado).toBe("confirmado");
    expect(f.modelo).toEqual({ valor: "Galaxy A54", estado: "probable", fuente: "foto" });
    expect(f.confirmadaPorUsuario).toBe(false);
  });

  it("con confianza baja no se usa el modelo", () => {
    const f = fichaConFoto(fichaVacia("c1", "otro"), { marca: "LG", modelo: "XYZ-123", confianza: "baja" });
    expect(f.marca.estado).toBe("probable");
    expect(f.modelo.estado).toBe("desconocido");
  });

  it("la entrada de chapa acepta solo fotos del frente, pero no ninguna foto", () => {
    expect(EntradaChapa.safeParse({ casoId: "c1", clase: "otro", imagenesFrente: [imagen] }).success).toBe(true);
    expect(EntradaChapa.safeParse({ casoId: "c1", clase: "otro" }).success).toBe(false);
  });
});

describe("chapa: marca y año deducidos (A1)", () => {
  it("lo que no está escrito en la etiqueta queda probable con fuente deducido", () => {
    const t = "iPhone 13 Model A2633";
    expect(estadoCampo({ valor: "Apple", lectura: "dudosa" }, t)).toEqual({ valor: "Apple", estado: "probable", fuente: "deducido" });
    expect(estadoCampo({ valor: "2021", lectura: "dudosa" }, t)).toEqual({ valor: "2021", estado: "probable", fuente: "deducido" });
    expect(estadoCampo({ valor: "iPhone 13", lectura: "clara" }, t)).toEqual({ valor: "iPhone 13", estado: "confirmado", fuente: "chapa" });
  });
});
