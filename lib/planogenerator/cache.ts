import type { SupabaseClient } from "@supabase/supabase-js";
import { PlanoDePiezas, type KnowledgePack } from "../../shared";

/**
 * Caché del plano por marca + modelo (tabla `planos`, migración 003). Lo llena el
 * cartógrafo (/api/plano); nadie lo carga a mano. Sin Supabase, queda en memoria.
 */
export type PlanoGuardado = {
  plano: PlanoDePiezas;
  avisos: string[];
  manualUrl: string | null;
  /** Ids de pieza del pack con el que se generó. */
  piezasPedidas: string[];
};

export interface CachePlanos {
  get(clave: string): Promise<PlanoGuardado | null>;
  set(clave: string, marca: string, modelo: string, valor: PlanoGuardado): Promise<void>;
}

export function cachePlanosEnMemoria(): CachePlanos {
  const m = new Map<string, PlanoGuardado>();
  return {
    get: async (clave) => m.get(clave) ?? null,
    set: async (clave, _marca, _modelo, valor) => void m.set(clave, valor),
  };
}

export function cachePlanosSupabase(db: SupabaseClient): CachePlanos {
  return {
    async get(clave) {
      const { data, error } = await db.from("planos").select("plano, avisos, manual_url, piezas_pedidas").eq("clave", clave).maybeSingle();
      if (error) {
        console.error("[planos] leer caché", error.message);
        return null;
      }
      if (!data) return null;
      const plano = PlanoDePiezas.safeParse(data.plano);
      if (!plano.success) return null; // fila vieja o rota: se regenera
      return {
        plano: plano.data,
        avisos: (data.avisos as string[]) ?? [],
        manualUrl: data.manual_url ?? null,
        piezasPedidas: (data.piezas_pedidas as string[]) ?? [],
      };
    },
    async set(clave, marca, modelo, valor) {
      const { error } = await db.from("planos").upsert({
        clave,
        marca,
        modelo,
        plano: PlanoDePiezas.parse(valor.plano),
        avisos: valor.avisos,
        manual_url: valor.manualUrl,
        piezas_pedidas: valor.piezasPedidas,
      });
      if (error) console.error("[planos] guardar caché", error.message);
    },
  };
}

/**
 * El pack se arma por modelo + síntoma, el plano solo por modelo: un plano guardado sirve
 * si al generarlo ya se pidieron todas las piezas de este pack (aunque alguna no se haya
 * podido ubicar: regenerar no lo arreglaría).
 */
export function cubrePack(guardado: PlanoGuardado, kp: KnowledgePack): boolean {
  const pedidas = new Set(guardado.piezasPedidas);
  return kp.piezas.every((p) => pedidas.has(p.id));
}
