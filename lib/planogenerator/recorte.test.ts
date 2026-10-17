import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { MAX_PAGINAS_RECORTE, paginasRecorte, recortarManual, recortarPdf } from "./recorte";

/** PDF de prueba: la página n mide 100 + n de ancho, así se reconoce cuál quedó en el recorte. */
async function pdfDePrueba(hojas: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let n = 1; n <= hojas; n++) doc.addPage([100 + n, 200]);
  return doc.save();
}

async function anchos(base64: string): Promise<number[]> {
  const doc = await PDFDocument.load(Buffer.from(base64, "base64"));
  return doc.getPages().map((p) => p.getWidth());
}

describe("recortarPdf", () => {
  it("copia solo las páginas pedidas, en el orden pedido", async () => {
    const r = await recortarPdf(await pdfDePrueba(10), [7, 2]);
    expect(r?.paginas).toEqual([7, 2]);
    expect(await anchos(r!.base64)).toEqual([107, 102]);
  });

  it("descarta repetidas y las que no existen, y respeta el máximo", async () => {
    const r = await recortarPdf(await pdfDePrueba(10), [3, 3, 0, 11, 1, 4, 5, 6]);
    expect(r?.paginas).toEqual([3, 1, 4, 5, 6].slice(0, MAX_PAGINAS_RECORTE));
  });

  it("null si no queda ninguna página o si no es un PDF", async () => {
    expect(await recortarPdf(await pdfDePrueba(3), [4, 9])).toBeNull();
    expect(await recortarPdf(new TextEncoder().encode("%PDF- roto"), [1])).toBeNull();
  });
});

describe("paginasRecorte", () => {
  it("la vista interior primero; sin vista interior no hay recorte", () => {
    expect(paginasRecorte(51, [12])).toEqual([51, 12]);
    expect(paginasRecorte(51)).toEqual([51]);
    expect(paginasRecorte(null, [12])).toBeNull();
    expect(paginasRecorte(undefined)).toBeNull();
  });
});

describe("recortarManual", () => {
  it("baja el manual y lo recorta; si la descarga falla, null", async () => {
    const pdf = await pdfDePrueba(5);
    const ok = await recortarManual("https://ej.com/m.pdf", [2], async () => new Response(Buffer.from(pdf)));
    expect(ok?.paginas).toEqual([2]);
    const falla = await recortarManual("https://ej.com/m.pdf", [2], async () => new Response("no", { status: 404 }));
    expect(falla).toBeNull();
  });
});
