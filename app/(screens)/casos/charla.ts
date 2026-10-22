import { sintomaParaCitar } from "../_datos/entender-simulado";
import type { FotoDelCaso } from "../_datos/casos-servidor";
import type { CasoGuardado } from "../_datos/mis-casos";

/**
 * La charla de un caso guardado, armada con lo que quedó en "Mis casos" (sin IA y sin inventar):
 * lo que contó la persona, el equipo, sus fotos (las trae el servidor), la ficha, la guía y cómo
 * terminó. No incluye las preguntas al experto: eso no se guarda en el caso.
 */

export type Mensaje =
  | { de: "yo"; texto: string }
  | { de: "fotos"; fotos: FotoDelCaso[] }
  | { de: "ia"; texto: string; lista?: string[]; numerada?: boolean };

const CIERRE: Record<NonNullable<CasoGuardado["cierre"]>["estado"], { dijo: string; respuesta: string }> = {
  resuelto: { dijo: "Lo resolví", respuesta: "¡Bien! Quedó andando." },
  esperando_repuesto: { dijo: "Pedí el repuesto", respuesta: "Cuando llegue, seguimos desde acá." },
  derivado: { dijo: "Lo llevo a un técnico", respuesta: "Queda anotado: lo ve un técnico." },
};

/** El nombre del equipo para mostrar: marca y modelo de la ficha, o el tipo, o la clase. */
export function nombreDelEquipo(c: CasoGuardado): string {
  return (
    [c.ficha?.marca.valor, c.ficha?.modelo.valor].filter(Boolean).join(" ") || c.tipoEquipo || c.caso.clase
  );
}

export function charlaDelCaso(c: CasoGuardado, fotos: FotoDelCaso[] = []): Mensaje[] {
  const tipo = c.tipoEquipo?.trim() || (c.caso.clase !== "otro" ? c.caso.clase : "equipo");
  const m: Mensaje[] = [
    { de: "yo", texto: sintomaParaCitar(c.caso.sintoma) },
    { de: "ia", texto: `Entendí que es tu ${tipo}.` },
  ];
  if (fotos.length) {
    m.push({ de: "ia", texto: "Te pedí unas fotos para reconocer el modelo." });
    m.push({ de: "fotos", fotos });
  }

  if (c.ficha) {
    const datos = [
      ["Marca", c.ficha.marca.valor],
      ["Modelo", c.ficha.modelo.valor],
    ].flatMap(([k, v]) => (v ? [`${k}: ${v}`] : []));
    if (datos.length) m.push({ de: "ia", texto: "Esto leí de tu equipo:", lista: datos });
  }

  const pack = c.guia?.preparado.pack;
  if (pack) {
    const pasos = [...pack.pasos].sort((a, b) => a.orden - b.orden).map((p) => p.texto);
    m.push({
      de: "ia",
      texto: `Armé la guía para tu ${nombreDelEquipo(c)}: ${pasos.length === 1 ? "1 paso" : `${pasos.length} pasos`}.`,
      lista: pasos,
      numerada: true,
    });
  } else if (c.guiaEnServidor) {
    m.push({ de: "ia", texto: "La guía de este caso está guardada en tu cuenta." });
  }

  if (c.cierre) {
    const pieza = c.cierre.pieza && pack?.piezas.find((p) => p.id === c.cierre?.pieza)?.nombre;
    const t = CIERRE[c.cierre.estado];
    m.push({ de: "yo", texto: pieza && c.cierre.estado === "esperando_repuesto" ? `${t.dijo}: ${pieza.toLowerCase()}` : t.dijo });
    m.push({ de: "ia", texto: t.respuesta });
  } else {
    m.push({
      de: "ia",
      texto:
        pack || c.guiaEnServidor
          ? "Quedamos en la guía. Tocá «Ver el modelo 3D» para volver."
          : c.ficha
            ? "Quedamos en revisar los datos de tu equipo."
            : "Quedamos en las fotos.",
    });
  }
  return m;
}
