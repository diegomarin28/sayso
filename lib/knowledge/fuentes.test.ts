import { describe, expect, it } from "vitest";
import { manualDelModelo, sinVerificar, type Fuente } from "./fuentes";

/**
 * Los manuales que el bibliotecario guardó en Supabase hasta el 20/10 (modelo confirmado, título, URL y fuente
 * tal cual): la regla es por códigos del modelo y por la fuente, nunca por marca.
 */
const OFICIALES: [string, string, string][] = [
  ["iPhone 13", "iPhone 13 Repair Manual - Apple Support", "https://support.apple.com/en-us/100402"],
  ["E1504FA-L1419W", "ASUS E1504FA User's Manual (English Edition, E25366)", "https://dlcdnets.asus.com/pub/ASUS/nb/E1504FA/0409_E25366_E1504_V2_A.pdf?model=E1504FA"],
  ["MacBook Air 13 pulgadas, M4, 2025", "MacBook Air (13-inch, M4, 2025) Repair Manual", "https://support.apple.com/en-us/122003"],
  ["ThinkPad T480", "T480 Hardware Maintenance Manual", "https://download.lenovo.com/pccbbs/mobiles_pdf/t480_hmm_en.pdf"],
  ["Latitude 5490", "Latitude 5490 Owner's Manual", "https://dl.dell.com/topicspdf/latitude-14-5490-laptop_owners-manual_en-us.pdf"],
  ["ThinkPad T14 Gen 2", "T14 Gen 2 and P14s Gen 2 Hardware Maintenance Manual", "https://download.lenovo.com/pccbbs/mobiles_pdf/t14_gen2_p14s_gen2_hmm_en.pdf"],
  ["ThinkPad E14 Gen 2", "E14 Gen 2/R14 Gen 2/E15 Gen 2 Hardware Maintenance Manual", "https://download.lenovo.com/pccbbs/mobiles_pdf/e14_gen2_e15_gen2_hmm_en.pdf"],
  ["MacBook Air M1 2020", "MacBook Air (M1, 2020) Repair Manual", "https://support.apple.com/en-us/100586"],
  ["MacBook Air M1 A2337", "MacBook Air (M1, 2020) Repair Manual", "https://support.apple.com/en-us/100586"],
  ["LaserJet Pro M404dn", "Repair Manual HP LaserJet Pro M304, M305, M404, M405", "https://kaas.hpcloud.hp.com/pdf-public/pdf_11503727_en-US-1.pdf"],
  ["MacBook Air 15 pulgadas, M3, 2024", "MacBook Air (15-inch, M3, 2024) Repair Manual", "https://support.apple.com/en-us/119580"],
  ["iPhone 16", "iPhone 16 Repair Manual - Apple Support", "https://support.apple.com/en-us/120652"],
  ["iPad mini (6.ª generación)", "iPad mini (6th generation) Repair Manual", "https://support.apple.com/ej/ipad-mini-6"],
  ["Galaxy Watch4 SM-R860", "Galaxy Watch4 User Manual", "https://ej.fabricante/watch4.pdf"],
  ["Pantalla Lux", "Pantalla Lux User Guide", "https://ej.fabricante/lux.pdf"],
];

describe("manualDelModelo: VERIFICADO solo con el manual oficial de ESTE modelo", () => {
  it.each(OFICIALES)("«%s» con «%s» → oficial", (modelo, titulo, url) => {
    expect(manualDelModelo(modelo, { titulo, url, fuente: "fabricante" })).toEqual({ oficial: true });
  });

  it.each<[string, string, string, Fuente]>([
    ["iPad A1395", "iPad 2 Wi-Fi (A1395, EMC 2415) Repair", "https://www.ifixit.com/Device/iPad_2_Wi-Fi_EMC_2415", "ifixit"],
    ["Latitude 5420", "Latitude 5420 Service Manual (Regulatory Model: P137G)", "https://cdn.cs.1worldsync.com/syndication/mediaserverredirect/e41a/original.pdf", "otro"],
  ])("«%s»: una página de iFixit o una copia en otro sitio no es el manual oficial", (modelo, titulo, url, fuente) => {
    expect(manualDelModelo(modelo, { titulo, url, fuente })).toEqual({ oficial: false, motivo: "tercero" });
  });

  it.each([
    ["MacBook Air", "MacBook Air (13-inch, M5) Repair Manual", "https://support.apple.com/en-us/125721"],
    ["MacBook Pro", "MacBook Pro (16-inch, M5 Pro or M5 Max) Repair Manual", "https://support.apple.com/en-us/125836"],
  ])("«%s» sin año ni chip: el manual de una variante («%s») no se puede confirmar", (modelo, titulo, url) => {
    expect(manualDelModelo(modelo, { titulo, url, fuente: "fabricante" })).toEqual({ oficial: false, motivo: "sin_modelo" });
  });

  it.each([
    ["MacBook Air 13 pulgadas, M4, 2025", "MacBook Air (13-inch, M5) Repair Manual", "https://support.apple.com/en-us/125721"],
    ["MacBook Air M1 A2337", "MacBook Air (M2, 2022) Repair Manual", "https://support.apple.com/en-us/111867"],
    ["ThinkPad T480", "T490 Hardware Maintenance Manual", "https://download.lenovo.com/pccbbs/mobiles_pdf/t490_hmm_en.pdf"],
    ["Pantalla 55V6C", "Pantalla 55C722 Service Manual", "https://ej.fabricante/55c722.pdf"],
  ])("«%s» con el manual de otro modelo («%s») → no", (modelo, titulo, url) => {
    expect(manualDelModelo(modelo, { titulo, url, fuente: "fabricante" })).toEqual({ oficial: false, motivo: "otro_modelo" });
  });

  it("un «13» suelto en la URL no confirma un modelo: tiene que estar como palabra", () => {
    expect(manualDelModelo("Fono 13", { titulo: "Fono 12 Repair Manual", url: "https://ej.fabricante/en-us/100413", fuente: "fabricante" }).oficial).toBe(false);
  });

  it("sin fuente conocida (una guía guardada antes de la regla) se decide solo por el modelo", () => {
    expect(manualDelModelo("iPhone 13", { titulo: "iPhone 13 Repair Manual", url: "https://ej" }).oficial).toBe(true);
    expect(manualDelModelo("MacBook Air", { titulo: "MacBook Air (13-inch, M5) Repair Manual", url: "https://ej" }).oficial).toBe(false);
  });
});

describe("sinVerificar", () => {
  it("baja solo las citas VERIFICADO; las demás y su página quedan igual", () => {
    const pasos = [
      { orden: 1, cita: { doc: "Manual", pagina: 12, estado: "VERIFICADO" as const } },
      { orden: 2, cita: { doc: "Guía", url: "https://ej", estado: "NO_VERIFICABLE" as const } },
      { orden: 3 },
    ];
    expect(sinVerificar(pasos)).toEqual([
      { orden: 1, cita: { doc: "Manual", pagina: 12, estado: "NO_VERIFICABLE" } },
      { orden: 2, cita: { doc: "Guía", url: "https://ej", estado: "NO_VERIFICABLE" } },
      { orden: 3 },
    ]);
  });
});
