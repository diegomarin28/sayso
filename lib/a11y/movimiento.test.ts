import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Toda animación de globals.css tiene que apagarse con `prefers-reduced-motion: reduce`. El caso que
 * motivó esto: «Pensando» (`.marca[data-estado="pensando"] .marca-capa-*`) tiene más especificidad que
 * `.marca-capa-*`, así que la regla general no lo apagaba.
 */
// Sin comentarios: no deben contarse como parte de un selector.
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Cuerpo del bloque que empieza en `inicio` (llaves balanceadas). */
function bloque(texto: string, inicio: number): string {
  let nivel = 0;
  for (let i = texto.indexOf("{", inicio); i < texto.length; i++) {
    if (texto[i] === "{") nivel++;
    if (texto[i] === "}" && --nivel === 0) return texto.slice(texto.indexOf("{", inicio) + 1, i);
  }
  return "";
}

const iMedia = css.indexOf("@media (prefers-reduced-motion: reduce)");
const reducido = bloque(css, iMedia);
const fuera = css.slice(0, iMedia) + css.slice(css.indexOf("{", iMedia) + reducido.length + 2);

/** Selectores de las reglas que animan (animation / animation-name con algo distinto de none). */
function conAnimacion(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const [, selectores, cuerpo] = m;
    if (!/animation(-name)?\s*:\s*(?!none\b)\S/.test(cuerpo)) continue;
    for (const s of selectores.split(",")) out.push(s.trim().replace(/\s+/g, " "));
  }
  return out;
}

const apagados = new Set(
  Array.from(reducido.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter(([, , cuerpo]) => /animation\s*:/.test(cuerpo))
    .flatMap(([, selectores]) => selectores.split(",").map((s) => s.trim().replace(/\s+/g, " "))),
);

describe("prefers-reduced-motion", () => {
  it("hay un bloque que lo contempla", () => {
    expect(iMedia).toBeGreaterThan(0);
    expect(reducido.length).toBeGreaterThan(0);
  });

  it("cada regla con animación tiene su anulación con el mismo selector", () => {
    const sinApagar = conAnimacion(fuera).filter((s) => !apagados.has(s));
    expect(sinApagar).toEqual([]);
  });

  it("«Pensando» se apaga con su propio selector (no alcanza el de `.marca-capa-*`)", () => {
    expect(apagados.has('.marca[data-estado="pensando"] .marca-capa-arriba')).toBe(true);
    expect(apagados.has('.marca[data-estado="pensando"] .marca-capa-abajo')).toBe(true);
  });
});
