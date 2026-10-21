import { describe, expect, it } from "vitest";
import type { CasoGuardado, GuiaGuardada } from "../_datos/mis-casos";
import { charlaDelCaso } from "./charla";

const dato = (valor: string | null) => ({ valor, estado: "confirmado" as const, fuente: "chapa" as const });
const ficha = {
  casoId: "a",
  marca: dato("EJEMPLO"),
  modelo: dato("NB-15"),
  numeroSerie: dato(null),
  anio: dato(null),
  clase: "notebook" as const,
} as unknown as CasoGuardado["ficha"];
const guia = {
  preparado: {
    pack: {
      pasos: [
        { orden: 2, texto: "Aflojá los tornillos del ventilador." },
        { orden: 1, texto: "Apagá y quitá la tapa." },
      ],
      piezas: [{ id: "ventilador_1", nombre: "Ventilador" }],
    },
  },
} as unknown as GuiaGuardada;

const caso = (extra: Partial<CasoGuardado> = {}): CasoGuardado => ({
  caso: { id: "a", clase: "notebook", sintoma: "hace ruido", estado: "captura", creadoEn: "2026-10-20T10:00:00.000Z" },
  tipoEquipo: "notebook",
  ficha: null,
  guia: null,
  cierre: null,
  guiaEnServidor: false,
  actualizadoEn: "2026-10-20T10:00:00.000Z",
  ...extra,
});

describe("charlaDelCaso", () => {
  it("sin fotos todavía: lo que contó, el equipo y dónde quedó", () => {
    const m = charlaDelCaso(caso());
    expect(m.map((x) => x.de)).toEqual(["yo", "ia", "ia"]);
    expect(m[1]).toEqual({ de: "ia", texto: "Entendí que es tu notebook." });
    expect(m.at(-1)).toEqual({ de: "ia", texto: "Quedamos en las fotos." });
  });

  it("con ficha y guía: los datos leídos y los pasos en orden", () => {
    const m = charlaDelCaso(caso({ ficha, guia }));
    const datos = m.find((x) => "texto" in x && x.texto === "Esto leí de tu equipo:");
    expect(datos && "lista" in datos && datos.lista).toEqual(["Marca: EJEMPLO", "Modelo: NB-15"]);
    const pasos = m.find((x) => "texto" in x && x.texto.startsWith("Armé la guía"));
    expect(pasos && "texto" in pasos && pasos.texto).toBe("Armé la guía para tu EJEMPLO NB-15: 2 pasos.");
    expect(pasos && "lista" in pasos && pasos.lista).toEqual(["Apagá y quitá la tapa.", "Aflojá los tornillos del ventilador."]);
    expect(JSON.stringify(m.at(-1))).toContain("Quedamos en la guía");
  });

  it("cerrado esperando un repuesto: lo dice la persona, con la pieza", () => {
    const m = charlaDelCaso(
      caso({ ficha, guia, cierre: { estado: "esperando_repuesto", pieza: "ventilador_1", ts: "2026-10-20T11:00:00.000Z" } }),
    );
    expect(m.at(-2)).toEqual({ de: "yo", texto: "Pedí el repuesto: ventilador" });
    expect(m.at(-1)!.de).toBe("ia");
  });

  it("guía solo en el servidor: lo avisa sin inventar pasos", () => {
    const m = charlaDelCaso(caso({ ficha, guiaEnServidor: true }));
    expect(m).toContainEqual({ de: "ia", texto: "La guía de este caso está guardada en tu cuenta." });
  });

  it("con las fotos del servidor: van después del equipo, como mensaje de la persona", () => {
    const fotos = [{ tipo: "frente", url: "https://x/firmada" }];
    const m = charlaDelCaso(caso(), fotos);
    expect(m[2]).toEqual({ de: "ia", texto: "Te pedí unas fotos para reconocer el modelo." });
    expect(m[3]).toEqual({ de: "fotos", fotos });
  });
});
