import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alerta, Camara, Check, Flecha, Microfono, Pantalla } from "../_ui/experto";
import { Marca } from "../_ui/marca";
import { Volver } from "../_ui/volver";

/**
 * "Cómo funciona": los pasos, qué es y qué no es Sayso, y quiénes lo hicimos. Sale de la
 * presentación de la hackatón, sin sus números (no se los prometemos a quien usa la app).
 * Los LinkedIn y el link al PDF todavía no: el PDF dice "no pide cuenta", que con el login ya no vale.
 */

export const metadata: Metadata = { title: "Cómo funciona · Sayso" };

const PASOS: { titulo: string; texto: string; icono: ReactNode }[] = [
  {
    titulo: "Contás qué pasó",
    texto: "Con tu voz o escribiendo, con tus palabras. Si algo no queda claro, te vuelve a preguntar.",
    icono: <Microfono size={22} />,
  },
  {
    titulo: "Sacás unas fotos",
    texto:
      "Te pide solo las que hacen falta para ese equipo, y te avisa si una salió borrosa o no muestra lo que pidió.",
    icono: <Camara size={22} />,
  },
  {
    titulo: "Confirmás el equipo",
    texto:
      "Lee la etiqueta y te muestra la marca y el modelo, marcando qué es seguro y qué es probable. Vos lo confirmás o lo corregís.",
    icono: <Check size={22} />,
  },
  {
    titulo: "Te guía con el manual y en 3D",
    texto:
      "Busca el manual de tu modelo y arma los pasos. Cada paso dice de dónde sale y resalta la pieza en un 3D que podés girar.",
    icono: <Cubo />,
  },
  {
    titulo: "Preguntás por voz",
    texto:
      "Como a un técnico al lado tuyo: te contesta en voz alta, desde la guía y el manual. Si preferís, escribís.",
    icono: <Charla />,
  },
];

/** Los nombres, con el OK de los tres (20/10/2026). */
const EQUIPO = [
  { nombre: "Ignacio Iglesia", hizo: "Las pantallas, la voz y la experiencia en el celular." },
  { nombre: "Diego Marin", hizo: "El producto, el 3D y la búsqueda de repuestos." },
  { nombre: "Juan Martín Noguez", hizo: "La inteligencia artificial que arma la guía y la seguridad." },
];

export default function ComoFunciona() {
  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <Volver />
      </header>

      <section className="flex flex-col gap-3">
        <Marca tam={36} />
        <h1 className="font-titulo text-3xl font-bold">Cómo funciona</h1>
        <p className="text-base text-texto-suave">
          Sayso te ayuda a arreglar un equipo de tu casa desde el celular. Le contás qué se rompió y te guía con el
          manual de tu equipo, paso a paso y en 3D.
        </p>
      </section>

      <section aria-labelledby="pasos" className="flex flex-col gap-4">
        <h2 id="pasos" className="font-mono text-[11px] tracking-widest text-texto-suave uppercase">
          Paso a paso
        </h2>
        <ol className="flex flex-col gap-3">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-4 rounded-2xl border border-borde bg-superficie/70 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acento/15 text-acento">
                {p.icono}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">
                  <span className="mr-2 font-mono text-xs text-texto-suave">{i + 1}</span>
                  {p.titulo}
                </p>
                <p className="text-sm leading-relaxed text-texto-suave">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="que-es" className="flex flex-col gap-4">
        <h2 id="que-es" className="font-mono text-[11px] tracking-widest text-texto-suave uppercase">
          Qué es y qué no es
        </h2>
        <ul className="flex flex-col gap-3 text-sm leading-relaxed">
          <Punto icono={<Check size={18} />} color="text-confirmado">
            <strong>Es una guía para animarte a reparar</strong>, con el manual a mano. Marca lo confirmado, lo
            probable y lo que no sabe, y dice de dónde sale cada paso.
          </Punto>
          <Punto icono={<Cruz />} color="text-probable">
            <strong>No reemplaza a un técnico.</strong> La guía la arma una inteligencia artificial y puede
            equivocarse: revisá cada paso antes de hacerlo.
          </Punto>
          <Punto icono={<Cruz />} color="text-probable">
            <strong>El 3D es una aproximación</strong> para ubicarte, no una copia exacta de tu equipo. Cada pieza
            dice si salió del manual, de una foto o si es estimada.
          </Punto>
          <Punto icono={<Alerta size={18} />} color="text-peligro">
            <strong>Los arreglos peligrosos se frenan.</strong> Electricidad de red, capacitores, baterías hinchadas,
            gas o refrigerante: ahí la guía se detiene y te recomienda un técnico.
          </Punto>
        </ul>
      </section>

      <section aria-labelledby="equipo" className="flex flex-col gap-3">
        <h2 id="equipo" className="font-mono text-[11px] tracking-widest text-texto-suave uppercase">
          Quiénes lo hicimos
        </h2>
        <p className="text-sm leading-relaxed text-texto-suave">
          Sayso nació en la hackatón Build 101, el 17 y 18 de octubre de 2026. Lo hicimos tres personas:
        </p>
        <ul className="flex flex-col gap-2">
          {EQUIPO.map((p) => (
            <li key={p.nombre} className="rounded-2xl border border-borde bg-superficie/70 px-4 py-3">
              <p className="font-semibold">{p.nombre}</p>
              <p className="text-sm text-texto-suave">{p.hizo}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto flex flex-col gap-4">
        <Link
          href="/"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-acento text-lg font-semibold text-black transition active:scale-[0.98]"
        >
          Contar qué se rompió <Flecha />
        </Link>
        <p className="flex justify-center gap-4 text-xs text-texto-suave">
          <Link href="/terminos" className="underline">
            Términos
          </Link>
          <Link href="/privacidad" className="underline">
            Privacidad
          </Link>
        </p>
      </div>
    </Pantalla>
  );
}

function Punto({ icono, color, children }: { icono: ReactNode; color: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-texto-suave [&_strong]:text-texto">
      <span className={`mt-0.5 shrink-0 ${color}`}>{icono}</span>
      <p>{children}</p>
    </li>
  );
}

/** Íconos de línea, con el mismo trazo que los de la app (experto.tsx). */
function Trazo({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function Cubo() {
  return (
    <Trazo size={22}>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
      <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
    </Trazo>
  );
}
function Charla() {
  return (
    <Trazo size={22}>
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" />
    </Trazo>
  );
}
function Cruz() {
  return (
    <Trazo size={18}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Trazo>
  );
}
