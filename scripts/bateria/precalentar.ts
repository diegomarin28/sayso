import { ClaseEquipo, Ficha } from "../../shared";
import { Corte, postJson, RespKnowledge, RespPlano, textoOrigen, type Opciones } from "./bateria";
import { CASOS_DEMO } from "./casos";

/**
 * Precalentar: deja en la caché de Supabase el manual (búsqueda, vistas), el pack y el plano de
 * cada equipo, antes de las pruebas. Solo corre /api/knowledge y /api/plano (sin recepción ni chat).
 * Cachés: el manual y el plano se guardan por marca + modelo; el pack, por marca + modelo + síntoma
 * (con otro síntoma se vuelve a armar, pero desde el manual ya guardado: lo caro es la búsqueda).
 */

export type EquipoPrecalentar = { marca: string; modelo: string; tipoEquipo: string; clase: ClaseEquipo };

export type FilaPrecalentar = {
  equipo: string;
  /** El pack ya estaba en la caché (no gastó). */
  yaEstaba: boolean | null;
  manual: string;
  verificado: boolean | null;
  vistas: string;
  plano: string;
  usd: number;
  segundos: number;
  nota?: string;
};

/** Equipos de la demo (`--demo`): los mismos casos del ensayo general (CASOS_DEMO en casos.ts). */
export const EQUIPOS_DEMO = CASOS_DEMO.map((c) => `${c.marca}|${c.modelo}|${c.tipoEquipo}`).join("; ");

/** Síntoma con el que se guarda el pack precalentado (el pack se guarda por marca + modelo + síntoma). */
export const SINTOMA_PRECALENTAR = "Revisión general: cómo está armado por dentro y qué piezas tiene.";

/** Clase a partir del tipo de equipo escrito (para la lista de `--equipos`). */
export function claseDe(tipo: string): ClaseEquipo {
  const t = tipo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/notebook|laptop|portatil/.test(t)) return "notebook";
  if (/split|aire/.test(t)) return "split";
  if (/lavarropa|lavadora/.test(t)) return "lavarropas";
  return "otro";
}

/** `"HP|250 G9|notebook; Samsung|Galaxy A15|celular"` → equipos. El tipo es opcional (sin tipo: "otro"). */
export function leerEquipos(texto: string): EquipoPrecalentar[] {
  return texto
    .split(/[;\n]/)
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => {
      const [marca, modelo, tipo] = e.split("|").map((x) => x.trim());
      if (!marca || !modelo) throw new Error(`Equipo mal escrito: "${e}" (formato: Marca|Modelo|tipo)`);
      const tipoEquipo = tipo || "equipo";
      return { marca, modelo, tipoEquipo, clase: claseDe(tipoEquipo) };
    });
}

export async function precalentar(
  equipos: EquipoPrecalentar[],
  o: Pick<Opciones, "base" | "topeUsd" | "fetch" | "esperaMs" | "log">,
): Promise<{ filas: FilaPrecalentar[]; totalUsd: number; cortado: boolean }> {
  const filas: FilaPrecalentar[] = [];
  let totalUsd = 0;
  let cortado = false;
  for (const [i, eq] of equipos.entries()) {
    const fila: FilaPrecalentar = { equipo: `${eq.marca} ${eq.modelo} (${eq.tipoEquipo})`, yaEstaba: null, manual: "—", verificado: null, vistas: "—", plano: "—", usd: 0, segundos: 0 };
    filas.push(fila);
    if (cortado) {
      fila.nota = "no corrido (se cortó antes)";
      continue;
    }
    const t0 = Date.now();
    const antes = (paso: string) => {
      const gastado = totalUsd + fila.usd;
      if (gastado > o.topeUsd) throw new Corte(`corte antes de ${paso}: US$ ${gastado.toFixed(3)} > tope US$ ${o.topeUsd}`);
    };
    try {
      // La persona escribió marca y modelo (como en la ficha confirmada): la clave de las cachés.
      const confirmado = (valor: string) => ({ valor, estado: "confirmado" as const, fuente: "usuario" });
      const nada = { valor: null, estado: "desconocido" as const };
      const ficha = Ficha.parse({
        casoId: `precalentar-${i + 1}`,
        clase: eq.clase,
        marca: confirmado(eq.marca),
        modelo: confirmado(eq.modelo),
        serie: nada,
        anio: nada,
        confirmadaPorUsuario: true,
      });

      antes("knowledge");
      const k = await postJson(o, "/api/knowledge", { ficha, sintoma: SINTOMA_PRECALENTAR, tipoEquipo: eq.tipoEquipo }, RespKnowledge);
      fila.usd += k.usd;
      fila.yaEstaba = k.datos.desdeCache ?? null;
      fila.manual = k.datos.manualFileId ? (k.datos.pack.fuentes[0]?.doc ?? "manual") : k.datos.pack.fuentes.length ? "guía pública" : "—";
      fila.verificado = k.datos.pack.verificado;
      fila.vistas = `interior ${k.datos.paginaVistaInterior ?? "—"} · explosionada ${k.datos.paginasVistaExplosionada.join(", ") || "—"}`;

      antes("plano");
      const p = await postJson(
        o,
        "/api/plano",
        {
          casoId: ficha.casoId,
          ficha,
          tipoEquipo: eq.tipoEquipo,
          knowledgePack: k.datos.pack,
          manualFileId: k.datos.manualFileId,
          manualUrl: k.datos.manualUrl,
          paginasVistaExplosionada: k.datos.paginasVistaExplosionada,
          paginaVistaInterior: k.datos.paginaVistaInterior,
        },
        RespPlano,
      );
      fila.usd += p.usd;
      fila.plano = `${p.datos.desdeCache ? "ya estaba · " : ""}${textoOrigen(p.datos.origen, p.datos.plano)}`;
    } catch (e) {
      if (e instanceof Corte) cortado = true;
      fila.nota = (e as Error).message;
    }
    fila.segundos = (Date.now() - t0) / 1000;
    totalUsd += fila.usd;
    o.log?.(`${fila.equipo}: US$ ${fila.usd.toFixed(3)} · ${fila.segundos.toFixed(0)} s${fila.nota ? ` · ${fila.nota}` : ""} (acumulado US$ ${totalUsd.toFixed(3)})`);
  }
  return { filas, totalUsd, cortado };
}

export function tablaPrecalentar(filas: FilaPrecalentar[], totalUsd: number): string {
  const sino = (v: boolean | null) => (v === null ? "—" : v ? "sí" : "no");
  return [
    "| Equipo | Ya estaba | Manual | Verificado | Vistas (páginas) | Plano 3D | Costo | Tiempo | Nota |",
    "|---|---|---|---|---|---|---|---|---|",
    ...filas.map(
      (f) =>
        `| ${f.equipo} | ${sino(f.yaEstaba)} | ${f.manual} | ${sino(f.verificado)} | ${f.vistas} | ${f.plano} | US$ ${f.usd.toFixed(3)} | ${f.segundos.toFixed(0)} s | ${f.nota ?? ""} |`,
    ),
    "",
    `Total: US$ ${totalUsd.toFixed(3)}`,
  ].join("\n");
}
