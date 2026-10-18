import { describir, herramientasDePasos } from "../../lib/herramientas/herramientas";
import { hrefSeguro } from "./fuente";
import { enlaceMercadoLibre } from "./textos";

/**
 * "Herramientas que necesitás" (#230): las que nombran los pasos del caso, con qué es cada una y dónde
 * conseguirla (una búsqueda en Mercado Libre, o una ferretería o casa de electrónica). Sin herramientas, nada.
 * Nunca compra: el link abre la búsqueda.
 */
export function Herramientas({ pasos, className = "" }: { pasos: ReadonlyArray<{ texto: string }>; className?: string }) {
  const lista = herramientasDePasos(pasos);
  if (!lista.length) return null;
  return (
    <section className={`flex flex-col gap-3 ${className}`} aria-label="Herramientas que necesitás">
      <h2 className="text-lg font-semibold">Herramientas que necesitás</h2>
      <ul className="flex flex-col gap-3">
        {lista.map((h) => {
          const href = hrefSeguro(enlaceMercadoLibre(h.busqueda));
          return (
            <li key={h.id} className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4">
              <p className="font-semibold">{h.nombre}</p>
              <p className="text-sm text-texto-suave">{describir(h)}</p>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-borde px-4 py-2 text-center text-sm font-semibold text-texto"
                >
                  Buscarla en Mercado Libre
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-texto-suave">También las conseguís en una ferretería o en una casa de electrónica. El link solo abre la búsqueda: no compramos nada.</p>
    </section>
  );
}
