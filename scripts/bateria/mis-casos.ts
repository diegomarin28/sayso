import type { SupabaseClient } from "@supabase/supabase-js";
import { Ficha, KnowledgePack } from "../../shared";
import { CasoGuardado } from "../../app/(screens)/_datos/mis-casos";
import { normalizar } from "../../lib/intake/chapa";
import type { Armado } from "../../lib/knowledge/armar";
import { claveManual } from "../../lib/knowledge/manuales";
import type { PlanoGuardado } from "../../lib/planogenerator/cache";
import { terminarGuardado } from "../../lib/planogenerator/obtener";
import type { CasoPrueba } from "./casos";

/**
 * "Mis casos" de prueba con lo que YA está en la caché de Supabase (sin IA): el último pack guardado de
 * cada equipo (tabla `knowledge_packs`) y su plano (`planos`). Sirve para revisar en tamaño celular cómo
 * se ve la guía y el 3D de los equipos de la demo antes de presentarla: se cargan en el localStorage
 * del navegador (`sayso:mis-casos:v1`) y se abren desde "Mis casos". Datos de prueba: no van al producto.
 */

/** Lo que guarda /api/knowledge en `knowledge_packs.armado` (JSON: el pack se vuelve a validar). */
export type ArmadoGuardado = Pick<Armado, "manual" | "vistas" | "vistaInterior" | "imagenesPaginas"> & { pack: unknown };

export function casoGuardado(c: CasoPrueba, armado: ArmadoGuardado, plano: PlanoGuardado, ahora = new Date().toISOString()): CasoGuardado {
  const pack = KnowledgePack.parse(armado.pack);
  const casoId = `prueba-${c.id}`;
  const terminado = terminarGuardado(plano.plano, pack, c.tipoEquipo);
  const confirmado = (valor: string) => ({ valor, estado: "confirmado" as const, fuente: "usuario" });
  const nada = { valor: null, estado: "desconocido" as const };
  return CasoGuardado.parse({
    caso: { id: casoId, clase: c.clase, sintoma: c.relato, estado: "guia", creadoEn: ahora },
    tipoEquipo: c.tipoEquipo,
    ficha: Ficha.parse({ casoId, clase: c.clase, marca: confirmado(c.marca), modelo: confirmado(c.modelo), serie: nada, anio: nada, confirmadaPorUsuario: true }),
    guia: {
      preparado: {
        pack,
        manualUrl: armado.manual?.url ?? null,
        manualFileId: armado.manual?.fileId ?? null,
        // Igual que /api/knowledge.
        paginasVistaExplosionada: armado.vistas?.explosionada ? [armado.vistas.explosionada] : [],
        paginaVistaInterior: armado.vistas?.interior ?? null,
        imagenesPaginas: armado.imagenesPaginas ?? {},
        vistaInterior: armado.vistaInterior ?? null,
        desdeCache: true,
      },
      // Como lo devuelve hoy /api/plano al leer la caché (esqueleto del tipo y piezas sueltas con el código actual).
      plano: { plano: terminado.plano, origen: "ia", avisos: [...plano.avisos, ...terminado.avisos] },
    },
    actualizadoEn: ahora,
  });
}

export type ResultadoMisCasos = { casos: CasoGuardado[]; faltan: { id: string; falta: string }[] };

/** Para cada equipo: el pack más nuevo de esa marca + modelo (cualquier síntoma) y su plano. */
export async function misCasosDeLaCache(db: SupabaseClient, casos: CasoPrueba[]): Promise<ResultadoMisCasos> {
  const r: ResultadoMisCasos = { casos: [], faltan: [] };
  for (const c of casos) {
    const prefijo = `${normalizar(c.marca)}|${normalizar(c.modelo)}|`;
    const packs = await db
      .from("knowledge_packs")
      .select("armado")
      .like("clave", `${prefijo.replace(/[%_\\]/g, "\\$&")}%`)
      .order("creado_en", { ascending: false })
      .limit(1);
    const planos = await db.from("planos").select("plano, avisos, manual_url, piezas_pedidas").eq("clave", claveManual(c.marca, c.modelo)).maybeSingle();
    const armado = packs.data?.[0]?.armado as ArmadoGuardado | undefined;
    if (!armado) {
      r.faltan.push({ id: c.id, falta: packs.error?.message ?? "no hay pack guardado" });
      continue;
    }
    if (!planos.data) {
      r.faltan.push({ id: c.id, falta: planos.error?.message ?? "no hay plano guardado" });
      continue;
    }
    const plano: PlanoGuardado = {
      plano: planos.data.plano,
      avisos: planos.data.avisos ?? [],
      manualUrl: planos.data.manual_url ?? null,
      piezasPedidas: planos.data.piezas_pedidas ?? [],
    };
    try {
      r.casos.push(casoGuardado(c, armado, plano));
    } catch (e) {
      r.faltan.push({ id: c.id, falta: `lo guardado no valida: ${(e as Error).message.slice(0, 200)}` });
    }
  }
  return r;
}
