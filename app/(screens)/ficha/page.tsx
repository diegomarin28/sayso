"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Campo, EstadoDato } from "@/shared";
import { ErrorApi, confirmarFicha, leerChapa } from "../_datos/api";
import { vistaPrevia } from "../_datos/imagen";
import { LineaPensando, LINEAS } from "../_ui/linea-pensando";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { BarraAccion, BotonPrincipal, DiceExperto, Encabezado, Flecha, Pantalla } from "../_ui/experto";

/** Pantalla 3 — Ficha del equipo: lo leído de la chapa, cada dato con su estado. */

type ClaveCampo = "marca" | "modelo" | "serie" | "anio";

const CAMPOS: { clave: ClaveCampo; etiqueta: string; ejemplo: string }[] = [
  { clave: "marca", etiqueta: "Marca", ejemplo: "Ej.: Lenovo" },
  { clave: "modelo", etiqueta: "Modelo", ejemplo: "Ej.: ThinkPad E14 Gen 2" },
  { clave: "serie", etiqueta: "N.º de serie", ejemplo: "Como figura en la etiqueta" },
  { clave: "anio", etiqueta: "Año", ejemplo: "Ej.: 2021" },
];

const ESTILO_ESTADO: Record<EstadoDato, { texto: string; clase: string }> = {
  confirmado: {
    texto: "Confirmado",
    clase: "text-confirmado border-confirmado/40 bg-confirmado/10",
  },
  probable: {
    texto: "Probable",
    clase: "text-probable border-probable/40 bg-probable/10",
  },
  desconocido: {
    texto: "No se sabe",
    clase: "text-desconocido border-desconocido/40 border-dashed",
  },
};

export default function FichaDelEquipo() {
  const router = useRouter();
  const caso = useRequiereCaso();
  const { fotos, imagenes, ficha, setFicha, agregarEventos, preparado, setPreparado, setPlano, tipoEquipo } =
    useFlujo();
  const [editando, setEditando] = useState<ClaveCampo | null>(null);
  const [borrador, setBorrador] = useState("");
  const [correcciones, setCorrecciones] = useState<Partial<Record<ClaveCampo, string | null>>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [faltaModelo, setFaltaModelo] = useState(false);

  const aceptadas = fotos.filter((f) => f.aceptada && imagenes[f.id]);
  const etiquetas = aceptadas.filter((f) => f.tipoPedido === "etiqueta");
  const fotoEtiqueta = etiquetas.at(-1);
  /** La que se muestra mientras lee: la etiqueta o, si no hay, el frente. */
  const fotoLectura = fotoEtiqueta ?? aceptadas.find((f) => f.tipoPedido === "frente") ?? aceptadas.at(-1);

  const [vuelta, setVuelta] = useState(0); // se incrementa con "Probar de nuevo"

  useEffect(() => {
    if (!caso || ficha) return;
    let vigente = true;
    // La chapa está en la etiqueta. El frente (o, si no hay, otra foto) sirve para reconocer el
    // equipo cuando la etiqueta no se lee: ahí marca y modelo salen "probables" y la persona confirma.
    const frentes = aceptadas.filter((f) => f.tipoPedido === "frente");
    const otras = aceptadas.filter((f) => f.tipoPedido !== "etiqueta");
    const paraLeer = etiquetas.slice(-3).map((f) => imagenes[f.id]);
    const delFrente = (frentes.length ? frentes : otras).slice(-2).map((f) => imagenes[f.id]);
    leerChapa(caso, paraLeer, { tipoEquipo, imagenesFrente: delFrente })
      .then((r) => {
        if (!vigente) return;
        agregarEventos(r.eventos);
        setFicha(r.ficha);
      })
      .catch((e) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se lee una vez por caso (o al reintentar)
  }, [caso?.id, vuelta]);

  if (!caso) return null;

  function guardar(clave: ClaveCampo) {
    if (!ficha) return;
    const valor = borrador.trim() || null;
    // Se muestra ya como lo va a dejar /api/ficha; la decisión final es del servidor.
    const campo: Campo = valor
      ? { valor, estado: "confirmado", fuente: "usuario" }
      : { valor: null, estado: "desconocido", fuente: "usuario" };
    setCorrecciones((prev) => ({ ...prev, [clave]: valor }));
    setFicha({ ...ficha, [clave]: campo });
    setEditando(null);
    setFaltaModelo(false);
  }

  async function confirmar() {
    if (!ficha) return;
    setEnviando(true);
    setError(null);
    // "Sí, es este" = la persona miró todo lo que está a la vista.
    const confirmados = CAMPOS.map((c) => c.clave).filter((c) => !(c in correcciones) && ficha[c].valor);
    try {
      const r = await confirmarFicha(ficha, confirmados, correcciones);
      agregarEventos(r.eventos);
      setFicha(r.ficha);
      // Solo si cambió el equipo hay que buscar otro manual; si no, se reusa lo ya preparado.
      if (preparado && ("marca" in correcciones || "modelo" in correcciones)) {
        setPreparado(null);
        setPlano(null);
      }
      if (r.listaParaPreparar) router.push("/preparando");
      else setFaltaModelo(true);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const dudosos = ficha ? CAMPOS.filter((c) => ficha[c.clave].estado !== "confirmado").length : 0;
  const dice = error
    ? error
    : faltaModelo
      ? "Me falta el modelo para buscar el manual. Tocá “Modelo” y escribilo como figura en la etiqueta."
      : !ficha
        ? "Leyendo la chapa…"
        : dudosos > 0
          ? "Esto leí en la chapa. Revisalo: podés corregir o completar cualquier dato."
          : "Esto leí en la chapa. ¿Es tu equipo?";

  return (
    <Pantalla>
      <Encabezado paso={3} orbe={ficha ? "quieto" : "pensando"} alVolver={() => router.push("/fotos")} />

      <DiceExperto texto={dice} />

      {error && !ficha && (
        <BarraAccion>
          <BotonPrincipal
            onClick={() => {
              setError(null);
              setVuelta((v) => v + 1);
            }}
          >
            Probar de nuevo
          </BotonPrincipal>
        </BarraAccion>
      )}

      {!ficha ? (
        // Carga de "leer la etiqueta": la foto con una lupa que la recorre y una línea de lo que lee.
        <div className="flex flex-col gap-3">
          <div className="relative aspect-[4/3] max-h-[50dvh] w-full overflow-hidden rounded-3xl bg-superficie">
            {fotoLectura && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vistaPrevia(imagenes[fotoLectura.id])}
                alt={fotoEtiqueta ? "Etiqueta del equipo" : "Frente del equipo"}
                className="h-full w-full object-cover opacity-60"
              />
            )}
            <div className="lupa-etiqueta" aria-hidden />
          </div>
          <LineaPensando lineas={fotoEtiqueta ? LINEAS.etiqueta : LINEAS.frente} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-texto-suave">
            <Lapiz /> Podés corregir o completar cualquier dato.
          </p>
          <div className="chapa relative rounded-3xl border border-white/10 p-5 pt-7 sm:p-6 sm:pt-8">
            {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos) => (
              <span key={pos} className={`remache absolute h-2.5 w-2.5 rounded-full ${pos}`} aria-hidden />
            ))}
            <p className="mb-3 font-mono text-xs tracking-[0.3em] text-texto-suave uppercase">
              {ficha.clase}
            </p>
            <dl className="flex flex-col gap-2">
              {CAMPOS.map(({ clave, etiqueta, ejemplo }) => {
                const campo = ficha[clave];
                const estilo = ESTILO_ESTADO[campo.estado];
                const vacio = !campo.valor;
                return (
                  <div key={clave}>
                    <dt className="mb-1 flex items-center justify-between gap-2 text-xs text-texto-suave">
                      {etiqueta}
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${estilo.clase}`}
                      >
                        {estilo.texto}
                        {campo.fuente === "foto" ? " · por la foto" : ""}
                      </span>
                    </dt>
                    {editando === clave ? (
                      <form
                        className="flex flex-col gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          guardar(clave);
                        }}
                      >
                        <input
                          autoFocus
                          value={borrador}
                          onChange={(e) => setBorrador(e.target.value)}
                          placeholder={ejemplo}
                          enterKeyHint="done"
                          aria-label={etiqueta}
                          className="h-12 w-full rounded-xl border-2 border-acento bg-black/30 px-3 font-mono text-lg placeholder:font-sans placeholder:text-base placeholder:text-texto-suave/60 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button className="h-11 flex-1 rounded-xl bg-acento font-semibold text-black active:scale-[0.98]">
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditando(null)}
                            className="h-11 rounded-xl border border-borde px-4 text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <dd>
                        <button
                          onClick={() => {
                            setEditando(clave);
                            setBorrador(campo.valor ?? "");
                          }}
                          aria-label={`${vacio ? "Completar" : "Editar"} ${etiqueta}`}
                          className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition hover:border-texto-suave active:scale-[0.99] ${
                            vacio
                              ? "border-dashed border-acento/60 bg-acento/5"
                              : "border-white/10 bg-black/20"
                          }`}
                        >
                          <span
                            className={`min-w-0 break-words ${vacio ? "text-sm text-texto-suave" : "font-mono text-lg"}`}
                          >
                            {campo.valor ?? "Tocá para escribirlo"}
                          </span>
                          <span
                            className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${
                              vacio ? "text-acento" : "text-texto-suave"
                            }`}
                          >
                            {vacio ? (
                              "+ Completar"
                            ) : (
                              <>
                                <Lapiz /> Editar
                              </>
                            )}
                          </span>
                        </button>
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      )}

      {ficha && (
        <BarraAccion>
          <p className="text-center text-xs text-texto-suave">Lo que escribís vos queda como confirmado.</p>
          <BotonPrincipal onClick={confirmar} disabled={editando !== null || enviando}>
            {enviando ? "Guardando…" : "Sí, es este"} <Flecha />
          </BotonPrincipal>
        </BarraAccion>
      )}
    </Pantalla>
  );
}

function mensajeDeError(e: unknown) {
  return e instanceof ErrorApi ? e.message : "Algo salió mal. Probá de nuevo.";
}

function Lapiz() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
    </svg>
  );
}
