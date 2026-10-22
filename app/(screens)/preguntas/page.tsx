import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Pantalla } from "../_ui/experto";
import { Volver } from "../_ui/volver";

/**
 * Preguntas frecuentes (menú de la cuenta, "Saber más"). Las respuestas salen de lo que ya dicen
 * "¿Cómo funciona?" y la política de privacidad: no se promete nada que la app no haga. Se abren con
 * <details>, sin JS.
 */

export const metadata: Metadata = { title: "Preguntas frecuentes · Sayso" };

const PREGUNTAS: { pregunta: string; respuesta: ReactNode }[] = [
  {
    pregunta: "¿Para qué sirve Sayso?",
    respuesta:
      "Es como tener un técnico al lado. Le contás qué le pasa a tu equipo (una notebook que se calienta, un aire que no enfría) y te acompaña a arreglarlo: encuentra el manual de tu modelo, te muestra en 3D dónde está cada pieza y te explica qué hacer, paso a paso.",
  },
  {
    pregunta: "¿Cómo funciona?",
    respuesta: (
      <>
        Contás qué pasó (escrito o con tu voz), sacás un par de fotos del equipo y de su etiqueta, revisás los datos
        que leyó, y Sayso busca el manual y te guía con el 3D. Al final le contás cómo quedó.{" "}
        <Link href="/como-funciona" className="text-texto underline underline-offset-4">
          Ver el paso a paso
        </Link>
        .
      </>
    ),
  },
  {
    pregunta: "¿Qué equipos puedo arreglar?",
    respuesta:
      "Notebooks, celulares, aires split, lavarropas y otros equipos de la casa. Si no encuentra el manual oficial de tu equipo, te guía con una guía pública y te avisa que no está verificada.",
  },
  {
    pregunta: "¿Reemplaza a un técnico?",
    respuesta:
      "No. Es una guía para animarte a reparar, con el manual a mano. La arma una inteligencia artificial y puede equivocarse: revisá cada paso antes de hacerlo.",
  },
  {
    pregunta: "¿Es seguro abrir mi equipo?",
    respuesta:
      "Los arreglos peligrosos se frenan. Electricidad de red, capacitores, baterías hinchadas, gas o refrigerante: ahí la guía se detiene y te recomienda un técnico.",
  },
  {
    pregunta: "¿El 3D es igual a mi equipo?",
    respuesta:
      "Todavía no. Sayso está en fase de prueba y hoy el 3D es una aproximación para ubicarte, no una copia exacta de tu equipo: cada pieza dice si salió del manual, de una foto o si es estimada. Estamos trabajando para que, más adelante, los modelos 3D sean mucho más precisos.",
  },
  {
    pregunta: "¿Necesito una cuenta?",
    respuesta:
      "No. La cuenta es opcional: sirve para no perder tus casos y para retomarlos en otro celular.",
  },
  {
    pregunta: "¿Dónde quedan mis casos?",
    respuesta:
      "En «Mis casos». Ahí ves la charla de cada uno y seguís donde quedaste, con su guía y su 3D, sin volver a generarlos. Se guardan en tu celular y en nuestro servidor.",
  },
  {
    pregunta: "¿Quién ve mis fotos?",
    respuesta: (
      <>
        Solo vos. Se guardan en un espacio privado, sin los datos ocultos de la foto (ni el lugar ni la fecha), y
        ninguna otra persona que use Sayso puede ver tus casos.{" "}
        <Link href="/privacidad" className="text-texto underline underline-offset-4">
          Más sobre privacidad
        </Link>
        .
      </>
    ),
  },
  {
    pregunta: "¿Cómo borro mi cuenta?",
    respuesta:
      "En Cuenta, «Borrar mi cuenta». Se borran tu cuenta, tus casos y sus fotos, y no se puede deshacer.",
  },
];

export default function Preguntas() {
  return (
    <Pantalla>
      <header className="flex items-center gap-3">
        <Volver />
      </header>
      <h1 className="font-titulo text-3xl font-bold">Preguntas frecuentes</h1>
      <div className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie/90">
        {PREGUNTAS.map((p) => (
          <details key={p.pregunta} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {p.pregunta}
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-texto-suave transition group-open:rotate-90"
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-texto-suave">{p.respuesta}</p>
          </details>
        ))}
      </div>
    </Pantalla>
  );
}
