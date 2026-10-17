import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { KnowledgePack } from "../../../shared";

/**
 * Un caso de evaluación vive FUERA del repo (carpeta ignorada, ej. manuales/<caso>/):
 *   caso.json  → de dónde sale el manual y la referencia leída a ojo
 *   kp.json    → knowledge pack de prueba
 *   paginas/   → imágenes que arma preparar.ts
 * El código no conoce ningún equipo ni manual: solo lee estos archivos.
 */
const Punto = z.tuple([z.number(), z.number()]);
export const Caso = z.object({
  fuente: z.object({
    url: z.url(),
    paginaExplosionada: z.number().int().positive(),
    paginaInterior: z.number().int().positive(),
    /** Recorte de la ilustración interior sobre la página a 220 dpi (geometría de ImageMagick). */
    recorteInterior: z.string().regex(/^\d+x\d+\+\d+\+\d+$/),
  }),
  referencia: z.object({
    nota: z.string().optional(),
    /** Esquinas de la carcasa en píxeles de paginas/interior.png. */
    esquinas: z.object({ BL: Punto, BR: Punto, FR: Punto, FL: Punto }),
    /** Centro de cada pieza identificable, en píxeles. */
    piezas: z.record(z.string(), Punto),
    excluidas: z.record(z.string(), z.string()).optional(),
  }),
});
export type Caso = z.infer<typeof Caso>;

export type CasoCargado = { nombre: string; dir: string; caso: Caso; kp: KnowledgePack };

export function cargarCaso(dir: string): CasoCargado {
  return {
    nombre: path.basename(dir),
    dir,
    caso: Caso.parse(JSON.parse(readFileSync(path.join(dir, "caso.json"), "utf8"))),
    kp: KnowledgePack.parse(JSON.parse(readFileSync(path.join(dir, "kp.json"), "utf8"))),
  };
}

/** Todas las subcarpetas de `raiz` que tienen caso.json y kp.json. */
export function cargarCasos(raiz: string): CasoCargado[] {
  return readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(raiz, d.name))
    .filter((dir) => existsSync(path.join(dir, "caso.json")) && existsSync(path.join(dir, "kp.json")))
    .map(cargarCaso);
}

export const imagenes = (c: CasoCargado) => ({
  explosionada: path.join(c.dir, "paginas", "explosionada.png"),
  interior: path.join(c.dir, "paginas", "interior.png"),
});
