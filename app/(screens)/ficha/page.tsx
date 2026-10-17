"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Campo, EstadoDato } from "@/shared";
import { leerChapa } from "../_datos/api";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { BotonPrincipal, DiceExperto, Encabezado, Flecha, Pantalla } from "../_ui/experto";

/** Pantalla 3 — Ficha del equipo: lo leído de la chapa, cada dato con su estado. */

type ClaveCampo = "marca" | "modelo" | "serie" | "anio";

const CAMPOS: { clave: ClaveCampo; etiqueta: string }[] = [
  { clave: "marca", etiqueta: "Marca" },
  { clave: "modelo", etiqueta: "Modelo" },
  { clave: "serie", etiqueta: "N.º de serie" },
  { clave: "anio", etiqueta: "Año" },
];

const ESTILO_ESTADO: Record<EstadoDato, { texto: string; clase: string }> = {
  confirmado: { texto: "Confirmado", clase: "text-confirmado border-confirmado/40 bg-confirmado/10" },
  probable: { texto: "Probable", clase: "text-probable border-probable/40 bg-probable/10" },
  desconocido: { texto: "No se sabe", clase: "text-desconocido border-desconocido/40 border-dashed" },
};

export default function FichaDelEquipo() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const { fotos, ficha, setFicha } = useFlujo();
  const [editando, setEditando] = useState<ClaveCampo | null>(null);
  const [borrador, setBorrador] = useState("");

  const fotoEtiqueta = fotos.findLast((f) => f.tipoPedido === "etiqueta" && f.aceptada);

  useEffect(() => {
    if (caso && !ficha) leerChapa(caso.id).then(setFicha);
  }, [caso, ficha, setFicha]);

  if (!caso) return null;

  function guardar(clave: ClaveCampo) {
    if (!ficha) return;
    const valor = borrador.trim() || null;
    const campo: Campo = valor
      ? { valor, estado: "confirmado", fuente: "usuario" }
      : { valor: null, estado: "desconocido", fuente: "usuario" };
    setFicha({ ...ficha, [clave]: campo });
    setEditando(null);
  }

  function confirmar() {
    if (!ficha) return;
    setFicha({ ...ficha, confirmadaPorUsuario: true });
    router.push("/preparando");
  }

  const dudosos = ficha ? CAMPOS.filter((c) => ficha[c.clave].estado !== "confirmado").length : 0;
  const dice = !ficha
    ? "Leyendo la chapa…"
    : dudosos > 0
      ? "Esto leí en la chapa. Si algo está mal, tocalo y corregilo."
      : "Esto leí en la chapa. ¿Es tu equipo?";

  return (
    <Pantalla>
      <Encabezado paso={3} orbe={ficha ? "quieto" : "pensando"} />

      <DiceExperto texto={dice} />

      {!ficha ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-superficie">
          {fotoEtiqueta && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoEtiqueta.url} alt="Etiqueta del equipo" className="h-full w-full object-cover opacity-70" />
          )}
          <div className="linea-escaneo" />
        </div>
      ) : (
        <div className="chapa relative rounded-3xl border border-white/10 p-6 pt-8">
          {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos) => (
            <span key={pos} className={`remache absolute h-2.5 w-2.5 rounded-full ${pos}`} aria-hidden />
          ))}
          <p className="mb-4 font-mono text-xs tracking-[0.3em] text-texto-suave uppercase">
            {ficha.clase}
          </p>
          <dl className="flex flex-col divide-y divide-white/10">
            {CAMPOS.map(({ clave, etiqueta }) => {
              const campo = ficha[clave];
              const estilo = ESTILO_ESTADO[campo.estado];
              return (
                <div key={clave} className="py-3">
                  <dt className="text-xs text-texto-suave">{etiqueta}</dt>
                  {editando === clave ? (
                    <form
                      className="mt-1 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        guardar(clave);
                      }}
                    >
                      <input
                        autoFocus
                        value={borrador}
                        onChange={(e) => setBorrador(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-acento bg-black/40 px-3 py-2 font-mono text-lg focus:outline-none"
                      />
                      <button className="rounded-lg bg-acento px-4 font-semibold text-black">OK</button>
                    </form>
                  ) : (
                    <dd>
                      <button
                        onClick={() => {
                          setEditando(clave);
                          setBorrador(campo.valor ?? "");
                        }}
                        className="mt-1 flex w-full items-center justify-between gap-3 text-left"
                      >
                        <span className={`font-mono text-xl ${campo.valor ? "" : "text-texto-suave"}`}>
                          {campo.valor ?? "—"}
                        </span>
                        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${estilo.clase}`}>
                          {estilo.texto}
                        </span>
                      </button>
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {ficha && (
        <div className="mt-auto flex flex-col gap-3">
          <p className="text-center text-xs text-texto-suave">
            Tocá un dato para corregirlo. Lo que corregís vos queda como confirmado.
          </p>
          <BotonPrincipal onClick={confirmar} disabled={editando !== null}>
            Sí, es este <Flecha />
          </BotonPrincipal>
        </div>
      )}
    </Pantalla>
  );
}
