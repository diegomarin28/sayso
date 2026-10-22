import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contraste, mezclar } from "./contraste";

const RAIZ = join(__dirname, "../..");
const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");
const token = (n: string) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))![1];

const FONDO = token("fondo");
const SUPERFICIE = token("superficie");
const MINIMO_TEXTO = 4.5; // WCAG AA, texto normal

describe("contraste de los tokens de la identidad", () => {
  it("la razón de contraste coincide con valores conocidos", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  // El texto de cada color sobre el fondo y sobre las tarjetas (el ámbar y el cian son de marca y no se tocan).
  it.each(["texto", "texto-suave", "acento", "dato", "marca", "confirmado", "probable", "desconocido", "peligro"])(
    "%s llega a 4,5:1 sobre el fondo y sobre la superficie",
    (n) => {
      expect(contraste(token(n), FONDO)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
      expect(contraste(token(n), SUPERFICIE)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    },
  );

  it("el texto negro de los botones de ámbar", () => {
    expect(contraste("#000000", token("acento"))).toBeGreaterThanOrEqual(7);
  });
});

/** Todos los .tsx de app y components, menos los tests. */
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return n === "node_modules" ? [] : archivos(ruta);
    return ruta.endsWith(".tsx") && !ruta.endsWith(".test.tsx") ? [ruta] : [];
  });
}

describe("texto con opacidad", () => {
  // `text-texto-suave/60` y parecidos bajan el contraste: ninguno puede quedar bajo el mínimo (los placeholders también cuentan).
  it("ningún text-* ni placeholder:text-* con opacidad baja de 4,5:1 sobre el fondo", () => {
    const malos: string[] = [];
    const patron = /(?:placeholder:)?text-(texto-suave|desconocido|texto|dato|marca)\/(\d+)/g;
    for (const f of [...archivos(join(RAIZ, "app")), ...archivos(join(RAIZ, "components"))]) {
      for (const m of readFileSync(f, "utf8").matchAll(patron)) {
        const visto = mezclar(token(m[1]), FONDO, Number(m[2]) / 100);
        if (contraste(visto, FONDO) < MINIMO_TEXTO) malos.push(`${f.replace(RAIZ, "")}: ${m[0]}`);
      }
    }
    expect(malos).toEqual([]);
  });
});
