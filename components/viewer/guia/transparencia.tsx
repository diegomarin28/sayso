"use client";

import type { ReactNode } from "react";
import type { Coreografia, KnowledgePack, PlanoDePiezas } from "../../../shared";
import { resumenOrigen, textoResumen, todoDelManual } from "../origen";

/**
 * "¿De dónde sale esto?" (plan §10, transparencia para el jurado): qué manual se usó y si está
 * verificado, de dónde sale cada pieza del 3D, qué cita cada paso de la respuesta y qué hizo la
 * IA y qué el código. Todo sale de los datos del caso (pack, plano y pasos): nada fijo por equipo.
 */

export type DatosTransparencia = {
  manual:
    | { tipo: "verificado"; titulo: string; url?: string; pasosCitados: number; pasosTotal: number }
    | { tipo: "guia_publica"; fuentes: { doc: string; url?: string }[]; pasosTotal: number };
  tresD: { generico: boolean; resumen: string; todoDelManual: boolean; medidasEstimadas: boolean };
  respuesta: { paso: number; texto: string; cita: string; verificada: boolean; bloqueado: boolean }[];
};

/** Lo que dice la cita de un paso (igual que la etiqueta de la tarjeta). */
export function textoCita(c: Coreografia): { cita: string; verificada: boolean } {
  if (c.riesgo === "alto") return { cita: "Bloqueado por seguridad (regla fija del código)", verificada: false };
  const verificada = c.cita?.estado === "VERIFICADO";
  if (verificada) return { cita: `${c.cita?.doc ? `${c.cita.doc}, ` : ""}${c.cita?.pagina ? `página ${c.cita.pagina}` : "manual"}`, verificada };
  return { cita: c.cita?.pagina ? `página ${c.cita.pagina} · no verificado` : "NO VERIFICADO", verificada };
}

export function datosTransparencia(pack: KnowledgePack, plano: PlanoDePiezas, origenPlano: "ia" | "plantilla", pasos: (Coreografia | undefined)[]): DatosTransparencia {
  const fuente = pack.fuentes[0];
  const manual: DatosTransparencia["manual"] =
    pack.verificado && fuente
      ? {
          tipo: "verificado",
          titulo: fuente.doc,
          ...(fuente.url ? { url: fuente.url } : {}),
          pasosCitados: pack.pasos.filter((p) => p.cita?.estado === "VERIFICADO").length,
          pasosTotal: pack.pasos.length,
        }
      : { tipo: "guia_publica", fuentes: pack.fuentes, pasosTotal: pack.pasos.length };
  const r = resumenOrigen(plano);
  return {
    manual,
    tresD: { generico: origenPlano === "plantilla", resumen: textoResumen(r), todoDelManual: todoDelManual(r), medidasEstimadas: r.medidasEstimadas },
    respuesta: pasos.flatMap((c, i) => (c ? [{ paso: i + 1, texto: c.dice, bloqueado: c.riesgo === "alto", ...textoCita(c) }] : [])),
  };
}

const HIZO_LA_IA = [
  "Entendió el problema y decidió qué fotos pedir.",
  "Leyó la etiqueta para sacar marca y modelo.",
  "Buscó el manual de servicio de ese modelo y lo leyó.",
  "Ubicó las piezas del 3D según los dibujos del manual.",
  "Armó los pasos, con la página del manual que los respalda, y qué mostrar en el 3D.",
];
const HIZO_EL_CODIGO = [
  "Valida todo lo que propone la IA y descarta lo que no cumple el formato.",
  "En el 3D solo deja piezas de la guía de este equipo: no inventa piezas ni números de parte.",
  "Calcula medidas, alturas y choques del 3D, y marca lo que es estimado.",
  "Bloquea los pasos peligrosos con una tabla fija de riesgos y deriva a un técnico.",
  "Marca como verificados solo los pasos que traen el texto literal de una página del manual.",
];

export function DeDondeSale({ datos, onCerrar }: { datos: DatosTransparencia; onCerrar: () => void }) {
  const { manual, tresD, respuesta } = datos;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="De dónde sale esto"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-6"
      onClick={onCerrar}
    >
      <div className="aparece flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-3xl border border-borde bg-fondo md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-borde px-5 py-4">
          <p className="font-semibold">¿De dónde sale esto?</p>
          <button type="button" onClick={onCerrar} className="h-10 rounded-full border border-borde px-4 text-sm">
            Cerrar
          </button>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-sm">
          <Seccion titulo="El manual">
            {manual.tipo === "verificado" ? (
              <>
                <Marca ok>Verificado</Marca>
                <p className="mt-1.5">
                  Manual de servicio:{" "}
                  {manual.url ? (
                    <a href={manual.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {manual.titulo}
                    </a>
                  ) : (
                    manual.titulo
                  )}
                  .
                </p>
                <p className="mt-1 text-texto-suave">
                  {manual.pasosCitados} de {manual.pasosTotal} pasos citan la página del manual de donde sale el texto.
                </p>
              </>
            ) : (
              <>
                <Marca>No verificado</Marca>
                <p className="mt-1.5">No encontré el manual de servicio de este modelo: los pasos salen de guías públicas y hay que tomarlos con cuidado.</p>
                {manual.fuentes.length > 0 && (
                  <ul className="mt-1.5 list-disc pl-5 text-texto-suave">
                    {manual.fuentes.map((f) => (
                      <li key={`${f.doc}${f.url ?? ""}`}>
                        {f.url ? (
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {f.doc}
                          </a>
                        ) : (
                          f.doc
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Seccion>

          <Seccion titulo="El 3D">
            <p>Es un esquema del tipo de equipo con las piezas donde dice el manual, no un escaneo.</p>
            {tresD.generico ? (
              <p className="mt-1.5">
                <Marca>Esquema genérico</Marca> La IA no pudo ubicar las piezas con el manual: es el esquema de este tipo de equipo, no tu modelo exacto.
              </p>
            ) : (
              <p className="mt-1.5">
                <Marca ok={tresD.todoDelManual}>{tresD.resumen}</Marca>
                {tresD.medidasEstimadas && <span className="ml-1 text-texto-suave">Las medidas de la carcasa son estimadas.</span>}
              </p>
            )}
            <p className="mt-1.5 text-texto-suave">Las piezas sólidas salen del manual; las punteadas y translúcidas son estimadas o genéricas.</p>
          </Seccion>

          {respuesta.length > 0 && (
            <Seccion titulo="Esta respuesta">
              <ol className="flex flex-col gap-2">
                {respuesta.map((r) => (
                  <li key={r.paso}>
                    <span className="text-texto-suave">Paso {r.paso}:</span> {r.texto}
                    <span className={`mt-0.5 block text-xs ${r.bloqueado ? "text-peligro" : r.verificada ? "text-confirmado" : "text-probable"}`}>{r.cita}</span>
                  </li>
                ))}
              </ol>
            </Seccion>
          )}

          <Seccion titulo="Qué hizo la IA y qué hizo el código">
            <p className="font-medium">La IA</p>
            <ul className="mt-1 list-disc pl-5 text-texto-suave">
              {HIZO_LA_IA.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-2 font-medium">El código</p>
            <ul className="mt-1 list-disc pl-5 text-texto-suave">
              {HIZO_EL_CODIGO.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Seccion>
        </div>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold tracking-widest text-acento uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

function Marca({ ok = false, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${ok ? "bg-confirmado/15 text-confirmado" : "bg-probable/15 text-probable"}`}>{children}</span>
  );
}
