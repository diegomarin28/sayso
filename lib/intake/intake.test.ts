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

describe("entender: avisar cuando no entendió (#149)", () => {
  it("un relato claro: claro y sin repregunta", async () => {
    const r = await entender("mi heladera no enfría", falso({ clase: "otro", tipoEquipo: "heladera", sintoma: "No enfría.", confianza: "alta", claro: true, repregunta: "" }));
    expect(r.claro).toBe(true);
    expect(r.repregunta).toBeUndefined();
  });

  it("equipo claro con un síntoma sin sentido ('notebook dddd'): la IA dice que no está claro y qué preguntar", async () => {
    const r = await entender(
      "notebook dddd",
      falso({ clase: "notebook", tipoEquipo: "notebook", sintoma: "dddd", confianza: "alta", claro: false, repregunta: "¿Qué le pasa a tu notebook?" }),
    );
    expect(r).toMatchObject({ claro: false, repregunta: "¿Qué le pasa a tu notebook?", tipoEquipo: "notebook" });
  });

  it("el código no confía en un 'claro' sin palabras de verdad ni equipo, y pone su propia pregunta", async () => {
    const sinPalabras = await entender("dddd", falso({ clase: "notebook", tipoEquipo: "notebook", sintoma: "dddd", confianza: "alta", claro: true, repregunta: "" }));
    expect(sinPalabras).toMatchObject({ claro: false, repregunta: "No te entendí bien. ¿Qué equipo es y qué le pasa?" });
    const sinEquipo = await entender("no anda", falso({ clase: "otro", tipoEquipo: "equipo", sintoma: "No anda.", confianza: "media", claro: true, repregunta: "" }));
    expect(sinEquipo.claro).toBe(false);
  });

  it("si la IA falla, no está claro (la pantalla vuelve a preguntar)", async () => {
    const r = await entender("algo raro", falso("basura"));
    expect(r.claro).toBe(false);
    expect(r.repregunta).toBeTruthy();
  });

  it("un problema dicho con pocas palabras con un equipo sí es claro (el modelo viejo sin 'claro' también)", async () => {
    const r = await entender("la tele no prende", falso({ clase: "otro", tipoEquipo: "televisor", sintoma: "No prende." }));
    expect(r.claro).toBe(true);
  });

  it("una pregunta peligrosa se bloquea aunque no esté claro el resto", async () => {
    const r = await entender("batería hinchada asdf", falso({ clase: "otro", tipoEquipo: "equipo", sintoma: "asdf", claro: false, repregunta: "¿Qué equipo es?" }));
    expect(r.seguridad.bloqueado).toBe(true);
    expect(r.claro).toBe(false);
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

describe("marca por el logo del frente (A2)", () => {
  it("si la etiqueta dio el modelo pero no la marca, la foto completa la marca sin pisar el modelo", () => {
    const desdeEtiqueta = { ...fichaVacia("c1", "otro"), modelo: { valor: "55P635", estado: "probable" as const, fuente: "chapa" } };
    const f = fichaConFoto(desdeEtiqueta, { marca: "TCL", modelo: null, confianza: "alta" });
    expect(f.marca).toEqual({ valor: "TCL", estado: "probable", fuente: "foto" });
    expect(f.modelo).toEqual({ valor: "55P635", estado: "probable", fuente: "chapa" });
  });
});

describe("fotos por TIPO de equipo (#229), nunca por modelo: dos variantes de cada tipo", () => {
  const pedidosIA = (...lista: Array<[PedidoDeFoto["tipo"], string]>) =>
    falso({ pedidos: lista.map(([tipo, instruccion]) => ({ tipo, instruccion, advertencia: null })) });

  it.each([["Apple Watch Series 7 (reloj inteligente)"], ["smartwatch Samsung Galaxy Watch 5"]])(
    "reloj (%s): no pide «el puerto de carga»; pide la parte de atrás, que es donde se carga",
    async (tipoEquipo) => {
      const llamar = pedidosIA(["etiqueta", "Foto de la etiqueta."], ["puertos", "Sacá una foto del puerto de carga."], ["otro", "Foto del cargador conectado."]);
      const { pedidos } = await decidirPedidos("otro", "no carga", llamar, tipoEquipo);
      const textos = pedidos.map((p) => p.instruccion).join(" | ");
      expect(textos).not.toMatch(/puerto/i);
      expect(pedidos.filter((p) => /parte de atrás.*contactos de carga/.test(p.instruccion))).toHaveLength(1);
      expect(pedidos.some((p) => p.tipo === "puertos")).toBe(false);
    },
  );

  it.each([
    ["tablet", "iPad 9.ª generación", "la tablet"],
    ["tablet", "tablet Samsung Galaxy Tab A8", "la tablet"],
    ["celular", "iPhone 11", "el celular"],
    ["celular", "celular Motorola Moto G32", "el celular"],
  ])("%s que no prende (%s): nada con el equipo prendido; la parte de atrás y el frente", async (_, tipoEquipo, equipo) => {
    const llamar = pedidosIA(["etiqueta", "Andá a Ajustes > General > Información y sacale una captura."], ["otro", "Prendé el equipo y sacá una foto de la pantalla de inicio."]);
    const { pedidos } = await decidirPedidos("otro", "no prende, la pantalla queda negra", llamar, tipoEquipo);
    const textos = pedidos.map((p) => p.instruccion).join(" | ");
    expect(textos).not.toMatch(/ajustes|informaci[oó]n|prend[eé] el|pantalla de inicio/i);
    expect(pedidos[0]).toEqual({ tipo: "etiqueta", instruccion: `Dá vuelta ${equipo} y sacá una foto de cerca a la parte de atrás, donde está grabado o impreso el modelo o el número de serie.` });
    expect(pedidos.some((p) => p.tipo === "frente")).toBe(true);
  });

  it.each([["notebook Lenovo IdeaPad 3"], ["laptop HP Pavilion 15"]])("notebook (%s) que sí prende: la lista de la IA no se toca", async (tipoEquipo) => {
    const lista: Array<[PedidoDeFoto["tipo"], string]> = [["etiqueta", "Dá vuelta la notebook y sacale una foto a la etiqueta."], ["otro", "Sacá una foto de cerca a la tecla P."]];
    const { pedidos } = await decidirPedidos("notebook", "la tecla P no anda", pedidosIA(...lista), tipoEquipo);
    expect(pedidos.map((p) => [p.tipo, p.instruccion])).toEqual(lista);
  });

  it("el síntoma «no prende» se reconoce con o sin tildes y en sus formas comunes", async () => {
    for (const sintoma of ["No enciende", "no me prende más", "no arranca", "no da señales", "está muerto"]) {
      const { pedidos } = await decidirPedidos("otro", sintoma, pedidosIA(["etiqueta", "Mirá en Configuración > Acerca del teléfono."], ["frente", "Foto del frente."]), "celular");
      expect(pedidos.map((p) => p.instruccion).join(" "), sintoma).not.toMatch(/configuraci/i);
    }
  });
});

describe("validador de fotos: juzga contra lo que se pidió (#229)", () => {
  it.each([["Sacá una foto de cerca a la tecla P."], ["Sacá una foto de cerca al conector de carga."]])(
    "le llega el pedido tal cual (%s) y acepta un detalle de cerca si se ve lo pedido",
    async (instruccion) => {
      let texto = "";
      let system = "";
      const llamar: LlamarIA = async (p) => {
        texto = JSON.stringify(p.contenido);
        system = p.system;
        return JSON.stringify({ nitidez: 0.85, encuadreOk: true, muestraLoPedido: true, motivo: null, confianza: "alta" });
      };
      const { foto } = await evaluarFoto({ casoId: "c1", tipoPedido: "otro", instruccion, imagen }, llamar);
      expect(texto).toContain(instruccion);
      expect(texto).not.toContain("lo que se le pidió a la persona");
      expect(system).toMatch(/de cerca.*no hace falta que se vea el equipo entero/);
      expect(system).toMatch(/Nunca digas que no sabés qué se pidió/);
      expect(foto.aceptada).toBe(true);
    },
  );

  it("sin el pedido (versión vieja de la pantalla), sigue con la descripción del tipo de foto", () => {
    expect(EntradaCalidad.parse({ casoId: "c", tipoPedido: "frente", imagen: { base64: "x", mediaType: "image/jpeg" } }).instruccion).toBeUndefined();
  });
});
