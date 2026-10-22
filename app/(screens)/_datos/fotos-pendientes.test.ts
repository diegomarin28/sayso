import { describe, expect, it } from "vitest";
import {
  fotosPendientesDelCaso,
  guardarFotosPendientes,
  MAX_FOTOS_PENDIENTES,
  repartir,
  type FotoPendiente,
} from "./fotos-pendientes";
import type { Foto } from "../../../shared";

const foto = (id: string, casoId = "caso"): Foto => ({
  id,
  casoId,
  tipoPedido: "frente",
  url: `blob:${id}`,
  calidad: { nitidez: 0.9, encuadreOk: true },
  aceptada: true,
});

/** Una foto con una imagen de `bytes` caracteres en base64 (el tope se mide en eso). */
const pendiente = (id: string, bytes = 10): FotoPendiente => ({
  casoId: "caso",
  foto: foto(id),
  imagen: { base64: "A".repeat(bytes), mediaType: "image/jpeg" },
});

describe("repartir: qué fotos entran en el celular", () => {
  it("entran todas mientras haya lugar por cantidad", () => {
    const nuevas = Array.from({ length: 3 }, (_, i) => pendiente(`f${i}`));
    const { entran, no } = repartir([], nuevas);
    expect(entran).toHaveLength(3);
    expect(no).toBe(0);
  });

  it("al llegar al tope de fotos, el resto no entra y se cuenta", () => {
    const actuales = Array.from({ length: MAX_FOTOS_PENDIENTES - 1 }, (_, i) => pendiente(`a${i}`));
    const { entran, no } = repartir(actuales, [pendiente("n1"), pendiente("n2")]);
    expect(entran.map((f) => f.foto.id)).toEqual(["n1"]);
    expect(no).toBe(1);
  });

  it("al pasar el tope de bytes, no entra la foto que no cabe", () => {
    const { entran, no } = repartir([pendiente("grande", 15 * 1024 * 1024 - 5)], [pendiente("chica", 4), pendiente("otra", 10)]);
    expect(entran.map((f) => f.foto.id)).toEqual(["chica"]);
    expect(no).toBe(1);
  });

  it("una foto que ya estaba se reemplaza y no cuenta para el tope", () => {
    const actuales = Array.from({ length: MAX_FOTOS_PENDIENTES }, (_, i) => pendiente(`a${i}`));
    const { entran, no } = repartir(actuales, [pendiente("a3", 99)]);
    expect(entran.map((f) => f.foto.id)).toEqual(["a3"]);
    expect(no).toBe(0);
  });
});

describe("sin IndexedDB (modo de prueba de Node)", () => {
  it("no guarda nada y devuelve todas como no guardadas: no se pierden en silencio", async () => {
    expect(await guardarFotosPendientes([pendiente("x1"), pendiente("x2")])).toBe(2);
  });

  it("no hay fotos pendientes para reenviar", async () => {
    expect(await fotosPendientesDelCaso("caso")).toEqual([]);
  });
});
