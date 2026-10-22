import { z } from "zod";
import { Foto } from "../../../shared";

/**
 * Fotos que no llegaron al servidor (sin red o sesión vencida), guardadas en el celular hasta que el
 * reintento las sube. Van en IndexedDB porque una imagen no entra en localStorage. Se borran al subir
 * y al salir de la cuenta (`borrarLocal`). Si el navegador no tiene IndexedDB (modo privado), no se
 * guarda nada y `guardarFotosPendientes` devuelve cuántas se perdieron, para avisarlo.
 */

/** Tope por celular, igual que el de un caso en el servidor (`fotosPorCaso`): no se guarda sin límite. */
export const MAX_FOTOS_PENDIENTES = 20;
export const MAX_BYTES_PENDIENTES = 15 * 1024 * 1024;

const BASE = "sayso-fotos-pendientes";
const TIENDA = "fotos";

const Imagen = z.object({
  base64: z.string().min(1),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
const FotoPendiente = z.object({ casoId: z.string(), foto: Foto, imagen: Imagen.optional() });
export type FotoPendiente = z.infer<typeof FotoPendiente>;

let abierta: Promise<IDBDatabase | null> | null = null;

/** La base, o null si el navegador no tiene IndexedDB (o no la deja abrir). */
function base(): Promise<IDBDatabase | null> {
  abierta ??= new Promise((ok) => {
    if (typeof indexedDB === "undefined") return ok(null);
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TIENDA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => {
      console.warn("[fotos-pendientes] no se pudo abrir IndexedDB", req.error);
      ok(null);
    };
  });
  return abierta;
}

async function leerTodas(): Promise<FotoPendiente[] | null> {
  const db = await base();
  if (!db) return null;
  return new Promise((ok) => {
    const req = db.transaction(TIENDA, "readonly").objectStore(TIENDA).getAll();
    req.onsuccess = () =>
      ok(
        req.result.flatMap((x: unknown) => {
          const r = FotoPendiente.safeParse(x);
          return r.success ? [r.data] : [];
        }),
      );
    req.onerror = () => {
      console.warn("[fotos-pendientes] no se pudo leer", req.error);
      ok(null);
    };
  });
}

async function escribir(hacer: (tienda: IDBObjectStore) => void): Promise<boolean> {
  const db = await base();
  if (!db) return false;
  return new Promise((ok) => {
    try {
      const t = db.transaction(TIENDA, "readwrite");
      hacer(t.objectStore(TIENDA));
      t.oncomplete = () => ok(true);
      t.onerror = t.onabort = () => {
        console.warn("[fotos-pendientes] no se pudo escribir", t.error);
        ok(false);
      };
    } catch (e) {
      console.warn("[fotos-pendientes] no se pudo escribir", e);
      ok(false);
    }
  });
}

/**
 * Qué fotos entran en el celular. Una foto que ya estaba se reemplaza (no cuenta de nuevo); una nueva
 * entra mientras haya lugar por cantidad y por bytes. Devuelve las que entran y cuántas no.
 */
export function repartir(
  actuales: FotoPendiente[],
  nuevas: FotoPendiente[],
): { entran: FotoPendiente[]; no: number } {
  const ids = new Set(actuales.map((f) => f.foto.id));
  let cuantas = actuales.length;
  let bytes = actuales.reduce((n, f) => n + (f.imagen?.base64.length ?? 0), 0);
  const entran: FotoPendiente[] = [];
  let no = 0;
  for (const f of nuevas) {
    if (ids.has(f.foto.id)) {
      entran.push(f);
      continue;
    }
    const peso = f.imagen?.base64.length ?? 0;
    if (cuantas >= MAX_FOTOS_PENDIENTES || bytes + peso > MAX_BYTES_PENDIENTES) {
      no++;
      continue;
    }
    cuantas++;
    bytes += peso;
    ids.add(f.foto.id);
    entran.push(f);
  }
  return { entran, no };
}

/** Guarda las fotos que no llegaron. Devuelve cuántas no se pudieron guardar (tope, sin IndexedDB o error). */
export async function guardarFotosPendientes(nuevas: FotoPendiente[]): Promise<number> {
  if (!nuevas.length) return 0;
  const actuales = await leerTodas();
  if (!actuales) return nuevas.length;
  const { entran, no } = repartir(actuales, nuevas);
  if (!entran.length) return no;
  const ok = await escribir((t) => entran.forEach((f) => t.put(f, f.foto.id)));
  return ok ? no : nuevas.length;
}

/** Las fotos pendientes de un caso, para reenviarlas. Sin IndexedDB, no hay ninguna. */
export async function fotosPendientesDelCaso(casoId: string): Promise<FotoPendiente[]> {
  return ((await leerTodas()) ?? []).filter((f) => f.casoId === casoId);
}

/** Quita de la copia del celular las fotos que ya llegaron al servidor. */
export async function borrarFotosPendientes(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await escribir((t) => ids.forEach((id) => t.delete(id)));
}

/** Al salir de la cuenta: no queda ninguna foto del caso en el celular. */
export async function borrarTodasLasFotosPendientes(): Promise<void> {
  await escribir((t) => t.clear());
}
