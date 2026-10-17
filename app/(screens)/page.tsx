"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Caso } from "@/shared";
import { entenderSintoma } from "./_datos/api";
import { useFlujo } from "./_estado/flujo";
import {
  BotonPrincipal,
  BotonSecundario,
  DiceExperto,
  Encabezado,
  Flecha,
  Pantalla,
} from "./_ui/experto";

/** Pantalla 1 — Qué se rompió. */

const SUGERENCIAS = [
  "Se apaga sola",
  "No carga la batería",
  "El ventilador hace mucho ruido",
  "No prende la pantalla",
];

const NOMBRE_CLASE: Record<Caso["clase"], string> = {
  notebook: "una notebook",
  split: "un aire acondicionado split",
  lavarropas: "un lavarropas",
  otro: "un equipo",
};

export default function QueSeRompio() {
  const router = useRouter();
  const { setCaso } = useFlujo();
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [entendido, setEntendido] = useState<Caso | null>(null);

  async function enviar() {
    if (!texto.trim()) return;
    setPensando(true);
    const caso = await entenderSintoma(texto);
    setPensando(false);
    setEntendido(caso);
  }

  function confirmar() {
    if (!entendido) return;
    setCaso(entendido);
    router.push("/fotos");
  }

  const dice = pensando
    ? "Dejame entender…"
    : entendido
      ? `Entendí: es ${NOMBRE_CLASE[entendido.clase]} y “${entendido.sintoma.toLowerCase()}”. ¿Es así?`
      : "Hola. Contame qué se rompió.";

  return (
    <Pantalla>
      <Encabezado paso={1} orbe={pensando ? "pensando" : "quieto"} />

      <DiceExperto texto={dice} />

      {!entendido ? (
        <>
          <div className="flex flex-1 flex-col gap-4">
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              disabled={pensando}
              rows={3}
              placeholder="Ej.: mi notebook se apaga sola a los diez minutos…"
              className="w-full resize-none rounded-2xl border border-borde bg-superficie p-4 text-lg placeholder:text-texto-suave/60 focus:border-acento focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pensando}
                  onClick={() => setTexto(s)}
                  className="rounded-full border border-borde px-4 py-2 text-sm text-texto-suave transition hover:border-texto-suave hover:text-texto"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <BotonPrincipal onClick={enviar} disabled={!texto.trim() || pensando}>
            {pensando ? "Pensando…" : "Seguir"} <Flecha />
          </BotonPrincipal>
        </>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
          <BotonPrincipal onClick={confirmar}>
            Sí, sigamos <Flecha />
          </BotonPrincipal>
          <BotonSecundario onClick={() => setEntendido(null)}>No, lo corrijo</BotonSecundario>
        </div>
      )}
    </Pantalla>
  );
}
