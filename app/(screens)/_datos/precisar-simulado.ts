import type { Ficha } from "../../../shared";

/**
 * Modelo ambiguo en el modo fixture (#359), para probar la pregunta sin gastar IA. Imita a
 * `/api/ficha`: solo "MacBook Air" (sin año ni chip) es una familia. Con la respuesta arma el
 * nombre solo con lo que dijo la persona (año y chip); si no dijo ninguno, vuelve a preguntar.
 */

type Precisar = { pregunta: string; dondeMirar: string };

const FAMILIA = "macbook air";

const PREGUNTA: Precisar = {
  pregunta: "¿De qué año es tu MacBook Air, o qué chip tiene?",
  dondeMirar: "En el menú Apple > Acerca de esta Mac, o en la caja.",
};

export function precisarSimulado(
  ficha: Ficha,
  precision: string | null | undefined,
): { ficha: Ficha; precisar?: Precisar; cambiados: "modelo"[] } {
  const modelo = ficha.modelo.valor?.trim() ?? "";
  if (modelo.toLowerCase() !== FAMILIA) return { ficha, cambiados: [] };
  // Sin respuesta, pregunta; "" es "No sé" y no pregunta más.
  if (precision === undefined || precision === null) return { ficha, precisar: PREGUNTA, cambiados: [] };
  if (!precision.trim()) return { ficha, cambiados: [] };
  const chip = precision.match(/\bm\d\b/i)?.[0].toUpperCase();
  const anio = precision.match(/\b(?:19|20)\d{2}\b/)?.[0];
  if (!chip && !anio) return { ficha, precisar: PREGUNTA, cambiados: [] };
  const valor = [modelo, chip, anio].filter(Boolean).join(" ");
  return {
    ficha: { ...ficha, modelo: { valor, estado: "confirmado", fuente: "usuario" } },
    cambiados: ["modelo"],
  };
}
