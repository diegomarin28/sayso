import { describe, expect, it } from "vitest";
import { coreografiaEjemplo, type Coreografia } from "../../../shared";
import { fotoParaPaso, paginaParaPaso } from "./pagina-manual";

const imagen = (pagina: number) => (pagina === 54 ? "https://ej.com/p54.png" : null);
const paso = (c: Partial<Coreografia>): Coreografia => ({ ...coreografiaEjemplo[0], ...c });
const cita = { doc: "HMM", pagina: 54, estado: "VERIFICADO" as const };

describe('"Ver en el manual"', () => {
  it("aparece si el paso cita una página que tiene imagen", () => {
    expect(paginaParaPaso(paso({ cita, riesgo: "bajo" }), imagen)).toEqual({ url: "https://ej.com/p54.png", pagina: 54, doc: "HMM" });
  });

  it("no aparece sin cita, sin página, sin imagen o sin el campo de /api/knowledge", () => {
    expect(paginaParaPaso(paso({ cita: undefined, riesgo: "bajo" }), imagen)).toBeNull();
    expect(paginaParaPaso(paso({ cita: { doc: "HMM", estado: "NO_VERIFICABLE" }, riesgo: "bajo" }), imagen)).toBeNull();
    expect(paginaParaPaso(paso({ cita: { ...cita, pagina: 12 }, riesgo: "bajo" }), imagen)).toBeNull();
    expect(paginaParaPaso(paso({ cita, riesgo: "bajo" }), undefined)).toBeNull();
    expect(paginaParaPaso(undefined, imagen)).toBeNull();
  });

  it("nunca en un paso bloqueado", () => {
    expect(paginaParaPaso(paso({ cita, riesgo: "alto" }), imagen)).toBeNull();
  });
});

describe('"Ver la foto del paso" (guías con fotos, ej. iFixit)', () => {
  const URL_PASO = "https://www.ifixit.com/Guide/Fono+X21+Battery+Replacement/2#s101";
  const fotos: Record<string, string> = { [URL_PASO]: "https://img.ej/101-0.standard" };
  const fotoDePaso = (url: string) => fotos[url];
  const citaWeb = { doc: "Fono X21 Battery Replacement", url: URL_PASO, estado: "VERIFICADO" as const };

  it("aparece si el paso cita un paso que tiene foto", () => {
    expect(fotoParaPaso(paso({ cita: citaWeb, riesgo: "bajo" }), fotoDePaso)).toEqual({ url: "https://img.ej/101-0.standard", foto: true, doc: "Fono X21 Battery Replacement" });
  });

  it("no aparece sin URL en la cita, sin foto para esa URL, sin la función, ni en un paso bloqueado", () => {
    expect(fotoParaPaso(paso({ cita, riesgo: "bajo" }), fotoDePaso)).toBeNull();
    expect(fotoParaPaso(paso({ cita: { ...citaWeb, url: `${URL_PASO}9` }, riesgo: "bajo" }), fotoDePaso)).toBeNull();
    expect(fotoParaPaso(paso({ cita: citaWeb, riesgo: "bajo" }), undefined)).toBeNull();
    expect(fotoParaPaso(paso({ cita: citaWeb, riesgo: "alto" }), fotoDePaso)).toBeNull();
  });
});
