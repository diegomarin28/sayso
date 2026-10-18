import type { Accion, Coreografia, Pieza } from "../../../shared";

/**
 * B6: cuando el experto nombra una pieza, el 3D va a ella y la resalta solo, aunque la IA no
 * haya puesto las marcas. Solo piezas que existen en el plano, solo si el paso no resalta nada
 * y nunca en un paso bloqueado. Sin IA: compara el texto con los nombres del knowledge pack.
 */

/** Zoom de la cámara al ir a la pieza nombrada (igual que las respuestas simuladas). */
const ZOOM_PIEZA = 1.4;

/** Minúsculas, sin tildes, solo letras y números separados por un espacio. */
const normalizar = (t: string) =>
  ` ${t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** Formas con que se puede nombrar una pieza: su nombre y su id en palabras, en singular y en plural. */
function formas(p: Pick<Pieza, "id" | "nombre">): string[] {
  const base = [normalizar(p.nombre), normalizar(p.id.replace(/_/g, " "))].map((f) => f.trim()).filter((f) => f.length >= 3);
  // Plural y singular en español: "batería(s)", "ventilador(es)".
  const variantes = (f: string) => [f, `${f}s`, `${f}es`, ...(f.endsWith("es") ? [f.slice(0, -2)] : []), ...(f.endsWith("s") ? [f.slice(0, -1)] : [])];
  return [...new Set(base.flatMap(variantes))];
}

/** La pieza del plano que nombra el texto (la de nombre más largo, si nombra varias). */
export function piezaNombrada(texto: string, piezas: Pick<Pieza, "id" | "nombre">[], idsPlano: Set<string>): string | null {
  const t = normalizar(texto);
  let mejor: { id: string; largo: number } | null = null;
  for (const p of piezas) {
    if (!idsPlano.has(p.id)) continue;
    for (const f of formas(p)) {
      if (t.includes(` ${f} `) && (!mejor || f.length > mejor.largo)) mejor = { id: p.id, largo: f.length };
    }
  }
  return mejor?.id ?? null;
}

/** Si el paso no resalta nada y nombra una pieza del plano, le suma "ir a la pieza" y "resaltarla". */
export function conPiezaNombrada(c: Coreografia, piezas: Pick<Pieza, "id" | "nombre">[], idsPlano: Set<string>): Coreografia {
  if (c.riesgo === "alto" || c.acciones.some((a) => a.t === "resaltar")) return c;
  const id = piezaNombrada(c.dice, piezas, idsPlano);
  if (!id) return c;
  const ir: Accion[] = [
    { t: "camara", objetivo: id, zoom: ZOOM_PIEZA },
    { t: "resaltar", pieza: id },
  ];
  // Si el paso ya movía la cámara, se respeta ese encuadre y solo se resalta.
  const yaEncuadra = c.acciones.some((a) => a.t === "camara");
  return { ...c, acciones: [...c.acciones, ...(yaEncuadra ? ir.slice(1) : ir)] };
}
