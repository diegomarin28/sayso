import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { supabaseServidor } from "@/lib/supabase/cliente";
import { CASOS_DEMO } from "@/scripts/bateria/casos";
import { misCasosDeLaCache } from "@/scripts/bateria/mis-casos";
import { LabDemo } from "./LabDemo";

/**
 * Ensayo de la demo en el celular, SIN IA: carga los equipos de la demo (`CASOS_DEMO`) en "Mis casos" con
 * lo que ya está en la caché de Supabase (el último pack de cada uno y su plano). No es una de las 6
 * pantallas: solo en desarrollo o con NEXT_PUBLIC_DATOS=fixture (así el chat también responde simulado).
 */
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DATOS !== "fixture") notFound();
  return (
    <Suspense fallback={<p className="p-4 text-sm text-texto-suave">Buscando los equipos en la caché…</p>}>
      <ConCasos />
    </Suspense>
  );
}

async function ConCasos() {
  await connection(); // se lee en cada pedido: la caché cambia
  const db = supabaseServidor();
  if (!db) return <LabDemo casos={[]} faltan={[{ id: "supabase", falta: "Sin Supabase: faltan las claves en .env.local." }]} />;
  const { casos, faltan } = await misCasosDeLaCache(db, CASOS_DEMO);
  return <LabDemo casos={casos} faltan={faltan} />;
}
