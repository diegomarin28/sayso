import type { ReactNode } from "react";
import { Pantalla } from "./experto";
import { Volver } from "./volver";

/**
 * Página de texto legal (términos y privacidad). Mientras sea un borrador lo dice arriba de todo:
 * lo revisan las personas antes de publicar (Ley 25.326); ningún agente lo da por bueno.
 */
export function PaginaLegal({ titulo, version, children }: { titulo: string; version: string; children: ReactNode }) {
  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <Volver />
      </header>
      <p className="rounded-2xl border border-probable/40 bg-probable/10 p-4 text-sm text-probable">
        <strong>Borrador para revisar.</strong> Este texto todavía no es definitivo: lo tienen que revisar y completar
        las personas responsables de Sayso antes de publicarlo.
      </p>
      <article className="flex flex-col gap-4 text-sm leading-relaxed text-texto-suave [&_h2]:mt-4 [&_h2]:font-titulo [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-texto [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-texto">
        <h1 className="font-titulo text-3xl font-bold text-texto">{titulo}</h1>
        <p className="font-mono text-xs">Versión {version}</p>
        {children}
      </article>
    </Pantalla>
  );
}
