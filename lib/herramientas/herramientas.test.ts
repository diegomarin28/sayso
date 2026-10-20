import { describe, expect, it } from "vitest";
import { describir, HERRAMIENTAS, herramientasDePasos, herramientasEn } from "./herramientas";

/** Por TIPO de herramienta: dos formas de nombrarla en un paso (manual, guía o chat). */
const CASOS: Array<[string, string, string]> = [
  ["iopener", "Colocá el iOpener en el centro del microondas y calentalo 30 segundos.", "Apoyá la bolsa térmica sobre el borde inferior."],
  ["pua", "Pasá una púa por el borde para soltar el pegamento.", "Hacé palanca suave con una espátula de plástico."],
  ["cinta", "Poné cinta sobre la pantalla rota antes de empezar.", "Despegá las tiras adhesivas de la batería tirando despacio."],
  ["ventosa", "Levantá el vidrio con una ventosa.", "Apoyá la VENTOSA cerca del borde."],
  ["destornillador_precision", "Sacá los tornillos con un destornillador Phillips #000.", "Usá un Pentalobe P2 para los dos tornillos de abajo."],
  ["pistola_calor", "Calentá el borde con una pistola de calor.", "Usá un decapador a baja temperatura."],
];

describe("herramientas que nombra un paso (#230)", () => {
  it.each(CASOS)("%s: se reconoce de dos formas", (id, uno, dos) => {
    expect(herramientasEn(uno).map((h) => h.id)).toContain(id);
    expect(herramientasEn(dos).map((h) => h.id)).toContain(id);
  });

  it("no confunde el equipo con una herramienta ni una tira de LED con cinta", () => {
    expect(herramientasEn("Abrí el secador de pelo y mirá el motor.")).toEqual([]);
    expect(herramientasEn("Revisá las tiras de LED de la retroiluminación.")).toEqual([]);
    expect(herramientasEn("Desenchufá el reloj inteligente de la pulsera de carga.")).toEqual([]);
  });

  it("cada herramienta dice qué es, para qué sirve y cómo se usa, en una línea (para el panel)", () => {
    for (const h of HERRAMIENTAS) {
      const linea = describir(h);
      expect(linea).toMatch(/^Es .+; sirve para .+\. .+\.$/);
      expect(linea).not.toMatch(/\n/);
    }
  });

  it("la lista del caso junta las de todos los pasos, sin repetir, en el orden del catálogo", () => {
    const pasos = [{ texto: "Calentá con el iOpener." }, { texto: "Pasá una púa." }, { texto: "Otra vez la púa y la ventosa." }, { texto: "Desenchufalo." }];
    expect(herramientasDePasos(pasos).map((h) => h.id)).toEqual(["iopener", "ventosa", "pua"]);
    expect(herramientasDePasos([{ texto: "Desenchufalo y esperá." }])).toEqual([]);
  });
});
