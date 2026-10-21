"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Campo, EstadoDato } from "@/shared";
import { confirmarFicha, leerChapa, type Precisar } from "../_datos/api";
import { mensajeDeError } from "../_datos/errores";
import { dondeBuscarModelo } from "../_datos/donde-modelo";
import { vistaPrevia } from "../_datos/imagen";
import { usePrecargaPiezas } from "@/components/viewer";
import { FichaDescifrando } from "../_ui/ficha-descifrando";
import { LineaPensando, LINEAS } from "../_ui/linea-pensando";
import { Volviendo } from "../_ui/volviendo";
import { useFlujo } from "../_estado/flujo";
import { useRequiereCaso } from "../_estado/requiere-caso";
import { BarraAccion, BotonPrincipal, BotonSecundario, Check, DiceExperto, Encabezado, Flecha, Pantalla } from "../_ui/experto";

/** Pantalla 3 — Ficha del equipo: lo leído de la etiqueta, cada dato con su estado. */

type ClaveCampo = "marca" | "modelo" | "serie" | "anio";

const CAMPOS: { clave: ClaveCampo; etiqueta: string; ejemplo: string }[] = [
  { clave: "marca", etiqueta: "Marca", ejemplo: "Ej.: Lenovo" },
  { clave: "modelo", etiqueta: "Modelo", ejemplo: "Ej.: ThinkPad E14 Gen 2" },
  { clave: "serie", etiqueta: "N.º de serie", ejemplo: "Como figura en la etiqueta" },
  { clave: "anio", etiqueta: "Año", ejemplo: "Ej.: 2021" },
];

/**
 * Lo que leyó la IA no queda confirmado hasta que la persona lo revisa (puede haber leído mal):
 * "confirmado" de la IA se muestra como "Leído": la persona lo confirma todo junto ("Confirmar
 * todo", #228) y corrige con Editar solo el dato que esté mal (lo corregido queda confirmado).
 */
/** Cómo se marca cada dato a la derecha de su fila: un tilde si se leyó, "Revisalo" si es dudoso. */
function EstadoDelDato({ estado, corregido }: { estado: EstadoDato; corregido: boolean }) {
  if (corregido)
    return (
      <span className="shrink-0 text-confirmado" role="img" aria-label="Corregido por vos">
        <Check size={20} />
      </span>
    );
  if (estado === "confirmado")
    return (
      <span className="shrink-0 text-dato" role="img" aria-label="Leído">
        <Check size={20} />
      </span>
    );
  return (
    <span className="shrink-0 rounded-full border border-probable/40 px-2 py-0.5 text-xs font-medium text-probable">
      Revisalo
    </span>
  );
}

/**
 * Next guarda las pantallas ya visitadas con su estado (cacheComponents usa <Activity>). El estado de
 * esta pantalla es del caso: con otro caso arranca de cero (si no, la ficha de un caso nuevo traía las
 * correcciones del anterior). Con el mismo caso (atrás, el logo) se conserva.
 */
export default function FichaDelEquipo() {
  const { caso } = useFlujo();
  return <FichaDelEquipoDelCaso key={caso?.id ?? "sin-caso"} />;
}

function FichaDelEquipoDelCaso() {
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
  /** El modelo es una familia ("MacBook Air"): se pregunta la versión antes de "Preparando" (#359). */
  const [precisar, setPrecisar] = useState<Precisar | null>(null);
  const [precision, setPrecision] = useState("");
  // El 3D se empieza a bajar ya (#133): con el tipo de equipo alcanza para las formas.
  usePrecargaPiezas(tipoEquipo);

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

  if (!caso) return <Volviendo />;

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
    // Confirmados = los que la persona marcó como correctos (lo corregido va en `correcciones`).
    const confirmados = CAMPOS.map((c) => c.clave).filter(
      // "Confirmar todo": lo que está a la vista y no corrigió (lo corregido va en `correcciones`).
      (c) => !(c in correcciones) && ficha[c].valor,
    );
    try {
      const r = await confirmarFicha(ficha, confirmados, correcciones, { tipoEquipo });
      seguir(r, "marca" in correcciones || "modelo" in correcciones);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  /** Con la respuesta de /api/ficha: preguntar la versión si hace falta o seguir a preparar. */
  function seguir(r: Awaited<ReturnType<typeof confirmarFicha>>, cambioEquipo: boolean) {
    agregarEventos(r.eventos);
    setFicha(r.ficha);
    // Solo si cambió el equipo hay que buscar otro manual; si no, se reusa lo ya preparado.
    if (preparado && (cambioEquipo || r.cambiados.includes("modelo"))) {
      setPreparado(null);
      setPlano(null);
    }
    if (r.precisar) {
      setPrecisar(r.precisar);
      setPrecision("");
      return;
    }
    setPrecisar(null);
    if (r.listaParaPreparar) router.push("/preparando");
    else setFaltaModelo(true);
  }

  /** "Listo": vuelve a /api/ficha con la ficha que devolvió y lo que escribió la persona. */
  async function precisarModelo() {
    if (!ficha || !precision.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await confirmarFicha(ficha, [], {}, { tipoEquipo, precision: precision.trim() });
      seguir(r, false);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  /** "No sé": sigue con el modelo como está, como antes de la pregunta. */
  function noSe() {
    setPrecisar(null);
    setError(null);
    if (ficha?.modelo.estado === "confirmado") router.push("/preparando");
    else setFaltaModelo(true);
  }

  const sinModelo = !!ficha && !ficha.modelo.valor;
  /** De dónde salió lo leído: la etiqueta (o lo que se usó en su lugar) o la foto del equipo. */
  const deDonde = fotoEtiqueta ? "Esto leí en la etiqueta." : "No había etiqueta: esto saqué de la foto del equipo.";
  const dice = error
    ? error
    : precisar
      ? precisar.pregunta
      : faltaModelo || (sinModelo && !fotoEtiqueta)
      ? `${fotoEtiqueta ? "Me falta el modelo" : "No pude saber el modelo con la foto"}. Tocá “Modelo” y escribilo: abajo te digo dónde encontrarlo.`
      : !ficha
        ? fotoEtiqueta
          ? "Leyendo la etiqueta…"
          : "Mirando la foto del equipo…"
        : CAMPOS.some((c) => ficha[c.clave].valor && !(c.clave in correcciones))
          ? "Revisá lo que leí"
          : "¿Es tu equipo?";

  return (
    <Pantalla>
      <Encabezado
        paso={3}
        orbe={ficha ? "quieto" : "pensando"}
        // Con la pregunta a la vista, "Atrás" vuelve a la ficha (por si el modelo está mal).
        alVolver={() => (precisar ? setPrecisar(null) : router.push("/fotos"))}
      />

      <div className="flex flex-col gap-3">
        <DiceExperto texto={dice} />
        {/* De dónde salió lo leído y qué hacer, debajo del título corto. */}
        {ficha && !precisar && !error && !faltaModelo && !(sinModelo && !fotoEtiqueta) && (
          <p className="aparece text-base text-texto-suave">{deDonde} Tocá un dato para corregirlo.</p>
        )}
      </div>

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

      {ficha && precisar ? (
        // Modelo ambiguo: la persona dice cuál es antes de buscar el manual (o "No sé").
        <form
          id="precisar"
          className="aparece flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            precisarModelo();
          }}
        >
          <p className="font-mono text-sm text-texto-suave">
            {[ficha.marca.valor, ficha.modelo.valor].filter(Boolean).join(" ")}
          </p>
          <input
            autoFocus
            value={precision}
            onChange={(e) => setPrecision(e.target.value)}
            maxLength={200}
            placeholder="Ej.: la del 2020 con chip M1"
            enterKeyHint="done"
            aria-label={precisar.pregunta}
            className="h-12 w-full rounded-xl border-2 border-acento bg-black/30 px-3 text-lg placeholder:text-base placeholder:text-texto-suave/60 focus:outline-none"
          />
          {precisar.dondeMirar && (
            <p className="text-sm text-texto-suave">
              <span className="font-semibold text-dato">Dónde mirar:</span> {precisar.dondeMirar}
            </p>
          )}
        </form>
      ) : !ficha ? (
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
          <FichaDescifrando />
          <LineaPensando lineas={fotoEtiqueta ? LINEAS.etiqueta : LINEAS.frente} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Sin modelo (ej. un aire sin etiqueta): dónde más suele estar, para escribirlo. */}
          {sinModelo && (
            <div className="aparece rounded-2xl border border-dato/40 bg-dato/10 p-4 text-sm">
              <p className="font-semibold">¿Dónde encuentro el modelo?</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {dondeBuscarModelo(tipoEquipo).lugares.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="text-dato" aria-hidden>
                      •
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Una lista simple: cada dato en una fila, con su estado a la derecha. Tocar una fila la edita. */}
          <div className="overflow-hidden rounded-2xl border border-borde bg-superficie/90">
            {/* El equipo que entendió la recepción (#290); la clase interna ("otro") solo si no hay. */}
            <p className="border-b border-borde px-4 py-3 text-sm font-medium first-letter:uppercase">
              {tipoEquipo?.trim() && tipoEquipo.trim().toLowerCase() !== "equipo" ? tipoEquipo.trim() : ficha.clase}
            </p>
            <dl className="divide-y divide-borde">
              {CAMPOS.map(({ clave, etiqueta, ejemplo }) => {
                const campo = ficha[clave];
                const vacio = !campo.valor;
                const ok = !vacio && clave in correcciones;
                return (
                  <div key={clave}>
                    <dt className="sr-only">{etiqueta}</dt>
                    {editando === clave ? (
                      <form
                        className="flex flex-col gap-2 p-3"
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
                          className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-fondo/40 active:bg-fondo/60"
                        >
                          <span className="w-24 shrink-0 text-sm text-texto-suave">{etiqueta}</span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className={`break-words ${vacio ? "text-[15px] text-texto-suave" : "font-mono text-base"}`}>
                              {campo.valor ?? "No lo encontré"}
                            </span>
                            {!vacio && !ok && campo.fuente === "foto" && (
                              <span className="text-xs text-texto-suave">por la foto</span>
                            )}
                          </span>
                          {vacio ? (
                            <span className="shrink-0 text-sm font-medium text-acento">Agregar</span>
                          ) : (
                            <EstadoDelDato estado={campo.estado} corregido={ok} />
                          )}
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

      {ficha && precisar && (
        <BarraAccion>
          <BotonPrincipal type="submit" form="precisar" disabled={enviando || !precision.trim()}>
            {enviando ? "Buscando…" : "Listo"} <Flecha />
          </BotonPrincipal>
          <BotonSecundario type="button" onClick={noSe} disabled={enviando}>
            No sé
          </BotonSecundario>
        </BarraAccion>
      )}

      {ficha && !precisar && (
        <BarraAccion>
          <BotonPrincipal onClick={confirmar} disabled={editando !== null || enviando}>
            {enviando ? "Guardando…" : "Está bien, seguir"} <Flecha />
          </BotonPrincipal>
        </BarraAccion>
      )}
    </Pantalla>
  );
}

