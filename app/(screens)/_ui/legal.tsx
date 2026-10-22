import type { ReactNode } from "react";
import { Pantalla } from "./experto";
import { Volver } from "./volver";

/**
 * Página de texto legal (términos y privacidad). Los textos los revisan las personas antes de
 * publicar (Ley 25.326); ningún agente los da por buenos. Sin cartel de borrador desde el rediseño
 * (lo pidió Iaio). Mientras Sayso sea una demo, los textos lo dicen en vez de completar datos de una empresa.
 */
export function PaginaLegal({ titulo, version, children }: { titulo: string; version: string; children: ReactNode }) {
  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <Volver />
      </header>
      <article className="flex flex-col gap-4 text-sm leading-relaxed text-texto-suave [&_h2]:mt-4 [&_h2]:font-titulo [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-texto [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-texto">
        <h1 className="font-titulo text-3xl font-bold text-texto">{titulo}</h1>
        <p className="font-mono text-xs">Versión {version}</p>
        {children}
      </article>
    </Pantalla>
  );
}
