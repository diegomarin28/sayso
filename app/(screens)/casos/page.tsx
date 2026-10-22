"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { fotosDelServidor, guiaDelServidor, sincronizarCasos, type FotoDelCaso } from "../_datos/casos-servidor";
import { leerCuenta } from "../_datos/cuenta";
import {
  firmaCasos,
  guardarGuiaBajada,
  listarCasos,
  suscribirCasos,
  TEXTO_ESTADO,
  type CasoGuardado,
} from "../_datos/mis-casos";
import { useFlujo } from "../_estado/flujo";
import { BarraAccion, BotonPrincipal, DiceExperto, Flecha, FlechaAtras, Pantalla, Persona } from "../_ui/experto";
import { Hilo, MensajeIA, MensajeYo } from "../_ui/chat";
import { charlaDelCaso, nombreDelEquipo } from "./charla";

/**
 * "Mis casos": los de este celular mezclados con los de la sesión en el servidor. Tocar uno lo retoma
 * en la pantalla del experto con su guía y su 3D, usando lo guardado (si la guía está solo en el
 * servidor, se baja): no vuelve a llamar a la IA. Si la sesión todavía es anónima, invita a guardarlos
 * con el email (/cuenta), también al llegar después de "Terminar".
 */

const ESTILO_ESTADO: Record<keyof typeof TEXTO_ESTADO, string> = {
  resuelto: "border-confirmado/40 bg-confirmado/10 text-confirmado",
  esperando_repuesto: "border-probable/40 bg-probable/10 text-probable",
  derivado: "border-peligro/40 bg-peligro/10 text-peligro",
  en_curso: "border-borde text-texto-suave",
};

export default function MisCasos() {
  const router = useRouter();
  const { retomar, cierre, reiniciar } = useFlujo();
  // Si se llega acá después de "Terminar", el caso cerrado ya está guardado: se limpia el flujo
  // para que "Inicio" arranque un problema nuevo, sin arrastrar el anterior. Solo al entrar: retomar un
  // caso cerrado también trae su `cierre`, y limpiarlo ahí lo borraba y la app volvía al inicio.
  useEffect(() => {
    if (cierre) reiniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo con el cierre que había al entrar
  }, []);
  // localStorage solo existe en el navegador: en el servidor la lista sale vacía y no hay desajuste.
  const firma = useSyncExternalStore(suscribirCasos, firmaCasos, () => "[]");
  const casos = useMemo(() => (firma === "[]" ? [] : listarCasos()), [firma]);
  useEffect(() => {
    sincronizarCasos();
  }, []);
  /** Caso cuya guía se está bajando del servidor. */
  const [bajando, setBajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = sin saber todavía, o sin login disponible: no se muestra la invitación.
  const [conEmail, setConEmail] = useState<boolean | null>(null);
  useEffect(() => {
    leerCuenta()
      .then((c) => setConEmail(c.configurado ? c.sesion && !c.anonima : null))
      .catch(() => setConEmail(null));
  }, []);

  /** El caso tocado: primero se ve su charla y desde ahí se sigue (`abrir`). */
  const [viendo, setViendo] = useState<CasoGuardado | null>(null);
  /** Sus fotos vienen del servidor (URL firmadas): mientras llegan, la charla se ve sin ellas. */
  const [fotosDe, setFotosDe] = useState<{ id: string; fotos: FotoDelCaso[] } | null>(null);
  const fotosViendo = viendo && fotosDe?.id === viendo.caso.id ? fotosDe.fotos : [];
  useEffect(() => {
    if (!viendo) return;
    const id = viendo.caso.id;
    let vigente = true;
    void fotosDelServidor(id).then((fotos) => vigente && setFotosDe({ id, fotos }));
    return () => {
      vigente = false;
    };
  }, [viendo]);

  async function abrir(c: CasoGuardado) {
    if (bajando) return;
    setError(null);
    if (!c.guia && c.guiaEnServidor) {
      setBajando(c.caso.id);
      const guia = await guiaDelServidor(c.caso.id);
      setBajando(null);
      // Sin la guía no se sigue: armarla de nuevo gastaría IA.
      if (!guia) return setError("No pudimos traer la guía de este caso. Revisá la conexión y probá de nuevo.");
      guardarGuiaBajada(c.caso.id, guia);
      c = { ...c, guia };
    }
    retomar(c);
    // Con guía y plano guardados va directo al experto; si no, sigue desde donde quedó.
    router.push(c.guia ? "/experto" : c.ficha ? "/ficha" : "/fotos");
  }

  if (viendo) {
    const estado = viendo.cierre?.estado ?? "en_curso";
    return (
      <Pantalla>
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setViendo(null);
              setError(null);
            }}
            aria-label="Volver a Mis casos"
            className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-texto-suave transition hover:text-texto active:scale-95"
          >
            <FlechaAtras size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{nombreDelEquipo(viendo)}</p>
            <p className="text-xs text-texto-suave">{fecha(viendo.actualizadoEn)}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${ESTILO_ESTADO[estado]}`}>
            {TEXTO_ESTADO[estado]}
          </span>
        </header>

        <Hilo>
          {charlaDelCaso(viendo, fotosViendo).map((m, i) =>
            m.de === "fotos" ? (
              <MensajeYo key={i} sinMarco>
                <span className="flex flex-wrap justify-end gap-2">
                  {m.fotos.map((f) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={f.url}
                      src={f.url}
                      alt={`Tu foto: ${f.tipo}`}
                      className="h-32 w-40 rounded-2xl border border-acento/30 object-cover"
                    />
                  ))}
                </span>
              </MensajeYo>
            ) : m.de === "yo" ? (
              <MensajeYo key={i}>{m.texto}</MensajeYo>
            ) : (
              <MensajeIA key={i}>
                {m.texto}
                {m.lista &&
                  (m.numerada ? (
                    <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm marker:text-texto-suave">
                      {m.lista.map((l, j) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ol>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1 font-mono text-sm">
                      {m.lista.map((l, j) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                  ))}
              </MensajeIA>
            ),
          )}
        </Hilo>

        <BarraAccion>
          {error && (
            <p role="alert" className="rounded-2xl border border-peligro/40 bg-peligro/10 p-3 text-sm text-peligro">
              {error}
            </p>
          )}
          <BotonPrincipal onClick={() => void abrir(viendo)} disabled={!!bajando}>
            {bajando ? "Trayendo la guía…" : textoSeguir(viendo)} <Flecha />
          </BotonPrincipal>
        </BarraAccion>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie pr-4 pl-3 text-sm font-medium"
        >
          <FlechaAtras /> Inicio
        </button>
        <p className="text-xs font-medium tracking-widest text-texto-suave uppercase">Mis casos</p>
        <button
          onClick={() => router.push("/cuenta")}
          className="ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie pr-4 pl-3 text-sm font-medium"
        >
          <Persona /> Cuenta
        </button>
      </header>

      <DiceExperto
        texto={
          casos.length
            ? "Estos son tus casos. Tocá uno para ver la charla y seguir."
            : "Todavía no tenés casos guardados."
        }
      />

      {conEmail === false && casos.length > 0 && (
        <button
          onClick={() => router.push("/cuenta?modo=crear")}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-acento/40 bg-acento/10 p-4 text-left"
        >
          <span>
            <span className="block font-semibold">Guardar mis casos</span>
            <span className="block text-sm text-texto-suave">Creá tu cuenta para no perderlos si cambiás de celular.</span>
          </span>
          <Flecha />
        </button>
      )}

      {error && <p role="alert" className="rounded-2xl border border-peligro/40 bg-peligro/10 p-3 text-sm text-peligro">{error}</p>}

      {casos.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {casos.map((c) => {
            const estado = c.cierre?.estado ?? "en_curso";
            const equipo = nombreDelEquipo(c);
            const pieza =
              c.cierre?.pieza && c.guia?.preparado.pack.piezas.find((p) => p.id === c.cierre?.pieza)?.nombre;
            return (
              <li key={c.caso.id}>
                <button
                  onClick={() => setViendo(c)}
                  disabled={!!bajando}
                  className="flex w-full flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4 text-left transition hover:border-texto-suave active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold break-words">{equipo}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${ESTILO_ESTADO[estado]}`}
                    >
                      {TEXTO_ESTADO[estado]}
                    </span>
                  </div>
                  <p className="text-sm text-texto-suave">“{c.caso.sintoma}”</p>
                  <div className="flex items-center justify-between gap-3 text-xs text-texto-suave">
                    <span>{fecha(c.actualizadoEn)}</span>
                    {estado === "esperando_repuesto" && pieza && (
                      <span className="text-probable">Falta: {pieza.toLowerCase()}</span>
                    )}
                    {bajando === c.caso.id ? (
                      <span>Trayendo la guía…</span>
                    ) : (
                      !c.guia && !c.guiaEnServidor && <span>Sin guía todavía</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-auto">
          <BotonPrincipal onClick={() => router.push("/")}>
            Empezar un caso <Flecha />
          </BotonPrincipal>
        </div>
      )}

      <p className="mt-auto text-center text-xs text-texto-suave">
        Se guardan en este dispositivo y en nuestro servidor para que puedas retomarlos (con las fotos,
        incluida la de la etiqueta del equipo). La cuenta es opcional: sirve para no perderlos.
      </p>
    </Pantalla>
  );
}

/** El botón de la charla dice a dónde lleva: el 3D si ya hay guía; si no, el paso donde quedó. */
function textoSeguir(c: CasoGuardado): string {
  if (c.guia || c.guiaEnServidor) return "Ver el modelo 3D";
  return c.ficha ? "Seguir con la ficha" : "Seguir con las fotos";
}

function fecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
