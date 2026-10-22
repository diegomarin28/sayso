import { z } from "zod";
import { Caso, Ficha } from "../../../shared";
import { Guia } from "../../../lib/supabase/guia";
import { borrarTodasLasFotosPendientes } from "./fotos-pendientes";

/**
 * "Mis casos": copia en el celular (localStorage) de los casos de la sesión, para abrir rápido y sin
 * red. En el servidor son de la sesión (docs/login.md §6): la lista del servidor se mezcla con la local
 * por `actualizadoEn` (`mezclarCasos`). Retomar un caso usa lo guardado: no gasta IA.
 * Si el navegador no deja guardar (modo privado, almacenamiento lleno), la app sigue igual.
 */

const CLAVE_CASOS = "sayso:mis-casos:v1";
const CLAVE_DISPOSITIVO = "sayso:dispositivo";
const MAX_CASOS = 30;

export const EstadoCierre = z.enum(["resuelto", "esperando_repuesto", "derivado"]);
export type EstadoCierre = z.infer<typeof EstadoCierre>;

export const Cierre = z.object({
  estado: EstadoCierre,
  /** Pieza que se pidió (id del pack), solo para "esperando_repuesto". */
  pieza: z.string().optional(),
  /** Publicación donde se compró (la abrió la persona desde "Repuestos"). */
  compraUrl: z.string().url().optional(),
  ts: z.string(),
});
export type Cierre = z.infer<typeof Cierre>;

export const CasoGuardado = z.object({
  caso: Caso,
  tipoEquipo: z.string().nullable().default(null),
  ficha: Ficha.nullable().default(null),
  guia: Guia.nullable().default(null),
  cierre: Cierre.nullable().default(null),
  /** El servidor tiene la guía (vino de otro celular): se baja al abrir el caso, sin IA. */
  guiaEnServidor: z.boolean().default(false),
  /** Lo último no llegó al servidor (sin red o sesión vencida): "Reintentar guardado" lo manda. Solo local. */
  pendienteServidor: z.boolean().default(false),
  /** Fotos que no se pudieron guardar ni en el servidor ni en el celular (tope o sin IndexedDB). Solo local. */
  fotosSinCopia: z.number().int().min(0).default(0),
  actualizadoEn: z.string(),
});
export type CasoGuardado = z.infer<typeof CasoGuardado>;
export type GuiaGuardada = z.infer<typeof Guia>;

/** Un caso de `GET /api/casos`: lo mismo que lo local, sin la guía. */
export const ResumenServidor = z.object({
  caso: Caso,
  tipoEquipo: z.string().nullable(),
  ficha: Ficha.nullable(),
  cierre: Cierre.nullable(),
  tieneGuia: z.boolean(),
  actualizadoEn: z.string(),
});
export type ResumenServidor = z.infer<typeof ResumenServidor>;

let memoria: CasoGuardado[] = []; // si localStorage no está disponible
const oyentes = new Set<() => void>();

function leerTodos(): CasoGuardado[] {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_CASOS) ?? "[]");
    if (!Array.isArray(crudo)) return memoria;
    // Lo que no valida (por ejemplo, de una versión vieja) se descarta en vez de romper la lista.
    return crudo.map((c) => CasoGuardado.safeParse(c)).flatMap((r) => (r.success ? [r.data] : []));
  } catch {
    return memoria;
  }
}

function escribirTodos(casos: CasoGuardado[]) {
  const recortados = [...casos]
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
    .slice(0, MAX_CASOS);
  memoria = recortados;
  try {
    localStorage.setItem(CLAVE_CASOS, JSON.stringify(recortados));
  } catch {
    // modo privado o lleno: queda en memoria mientras dure la pestaña
  }
  oyentes.forEach((o) => o());
}

/** Para `useSyncExternalStore`: avisa cuando cambia la lista (por ejemplo, al llegar la del servidor). */
export function suscribirCasos(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Id anónimo de antes del login (#331), si este celular tiene uno. Ya no se crean: solo se manda
 * para que el servidor pase sus casos a la sesión (reclamo, docs/login.md §4) y después se borra.
 */
export function dispositivoViejo(): string | undefined {
  try {
    return localStorage.getItem(CLAVE_DISPOSITIVO) ?? undefined;
  } catch {
    return undefined;
  }
}

/** El servidor ya reclamó los casos del dispositivo: desde ahí no da permiso sobre nada. */
export function olvidarDispositivo(id: string) {
  try {
    if (localStorage.getItem(CLAVE_DISPOSITIVO) === id) localStorage.removeItem(CLAVE_DISPOSITIVO);
  } catch {
    // sin localStorage no había dispositivo
  }
}

/** Texto crudo guardado: sirve como "versión" para leerlo con useSyncExternalStore sin desajustes. */
export function firmaCasos(): string {
  try {
    return localStorage.getItem(CLAVE_CASOS) ?? "[]";
  } catch {
    return JSON.stringify(memoria);
  }
}

/** Los casos de este dispositivo, el más reciente primero. */
export function listarCasos(): CasoGuardado[] {
  return leerTodos().sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

export function leerCaso(id: string): CasoGuardado | null {
  return leerTodos().find((c) => c.caso.id === id) ?? null;
}

type Cambio = Partial<Omit<CasoGuardado, "caso" | "actualizadoEn">> & { caso: Caso };

/** Crea o actualiza un caso (se mezcla con lo ya guardado). */
export function guardarLocal(cambio: Cambio) {
  const todos = leerTodos();
  const previo = todos.find((c) => c.caso.id === cambio.caso.id);
  const r = CasoGuardado.safeParse({ ...previo, ...cambio, actualizadoEn: new Date().toISOString() });
  if (!r.success) {
    console.warn("[mis-casos] no se guardó: no valida", r.error.issues[0]);
    return;
  }
  escribirTodos([r.data, ...todos.filter((c) => c.caso.id !== cambio.caso.id)]);
}

/**
 * Junta la lista del servidor con la local. Por caso gana el lado actualizado más reciente, sin
 * borrar lo que el otro tiene y él no (ficha, cierre). La guía local nunca se pisa: el servidor no la
 * cambia una vez escrita. Los casos que solo están en un lado quedan.
 */
export function mezclarCasos(locales: CasoGuardado[], servidor: ResumenServidor[]): CasoGuardado[] {
  const porId = new Map(locales.map((c) => [c.caso.id, c]));
  for (const { tieneGuia, ...s } of servidor) {
    const local = porId.get(s.caso.id);
    if (!local) {
      porId.set(s.caso.id, { ...s, guia: null, guiaEnServidor: tieneGuia, pendienteServidor: false, fotosSinCopia: 0 });
      continue;
    }
    const nuevo = s.actualizadoEn > local.actualizadoEn ? s : local;
    const viejo = nuevo === s ? local : s;
    porId.set(s.caso.id, {
      caso: nuevo.caso,
      tipoEquipo: nuevo.tipoEquipo ?? viejo.tipoEquipo,
      ficha: nuevo.ficha ?? viejo.ficha,
      cierre: nuevo.cierre ?? viejo.cierre,
      guia: local.guia,
      guiaEnServidor: tieneGuia,
      pendienteServidor: local.pendienteServidor,
      fotosSinCopia: local.fotosSinCopia,
      actualizadoEn: nuevo.actualizadoEn,
    });
  }
  return [...porId.values()];
}

/** Guarda en el celular la lista de casos que trajo el servidor. */
export function mezclarDelServidor(servidor: ResumenServidor[]) {
  escribirTodos(mezclarCasos(leerTodos(), servidor));
}

/** Marca si el caso no llegó al servidor. No cambia `actualizadoEn`: no es un cambio de la persona. */
export function marcarPendiente(id: string, pendiente: boolean) {
  const todos = leerTodos();
  if (!todos.some((c) => c.caso.id === id && c.pendienteServidor !== pendiente)) return;
  escribirTodos(todos.map((c) => (c.caso.id === id ? { ...c, pendienteServidor: pendiente } : c)));
}

/** Suma fotos que no se pudieron guardar. No cambia `actualizadoEn`: el caso no cambió por eso. */
export function sumarFotosSinCopia(id: string, cuantas: number) {
  if (cuantas <= 0) return;
  escribirTodos(leerTodos().map((c) => (c.caso.id === id ? { ...c, fotosSinCopia: c.fotosSinCopia + cuantas } : c)));
}

/** La guía bajada del servidor al abrir un caso: no cambia `actualizadoEn` (abrir no es un cambio). */
export function guardarGuiaBajada(id: string, guia: GuiaGuardada) {
  escribirTodos(leerTodos().map((c) => (c.caso.id === id ? { ...c, guia } : c)));
}

/** Borra la copia local de los casos (al borrar la cuenta o salir de ella: siguen en el servidor). */
export function borrarLocal() {
  memoria = [];
  try {
    localStorage.removeItem(CLAVE_CASOS);
  } catch {
    // sin localStorage solo estaban en memoria
  }
  void borrarTodasLasFotosPendientes();
  oyentes.forEach((o) => o());
}

export const TEXTO_ESTADO: Record<EstadoCierre | "en_curso", string> = {
  resuelto: "Resuelto",
  esperando_repuesto: "Esperando repuesto",
  derivado: "Derivado a técnico",
  en_curso: "En curso",
};
