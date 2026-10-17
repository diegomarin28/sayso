import { normalizar } from "../intake/chapa";
import type { Candidato } from "./buscar";

/**
 * Manuales oficiales conocidos (URL pública del fabricante, verificada a mano).
 * Se prueban ANTES de la búsqueda web, porque muchos PDFs de fabricantes no están
 * bien indexados. Agregar acá las notebooks de prueba y de la demo.
 * No se suben los PDFs al repo: solo la URL.
 */
const CONOCIDOS: { marca: string; modelos: string[]; candidato: Candidato }[] = [
  {
    marca: "lenovo",
    modelos: ["ThinkPad E14 Gen 2", "ThinkPad E15 Gen 2", "20TA", "20TB", "20T6", "20T7"],
    candidato: {
      titulo: "ThinkPad E14 Gen 2 and E15 Gen 2 Hardware Maintenance Manual",
      url: "https://download.lenovo.com/pccbbs/mobiles_pdf/e14_gen2_e15_gen2_hmm_en.pdf",
      fuente: "fabricante",
      modeloExacto: true,
    },
  },
];

export function manualConocido(marca: string | null, modelo: string): Candidato | null {
  const m = normalizar(modelo);
  const encontrado = CONOCIDOS.find(
    (c) => (!marca || normalizar(marca) === normalizar(c.marca)) && c.modelos.some((x) => m.includes(normalizar(x))),
  );
  return encontrado?.candidato ?? null;
}
