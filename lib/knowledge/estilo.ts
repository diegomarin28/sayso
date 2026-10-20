/**
 * Cómo se escriben los pasos de una reparación: que se entiendan, que tengan un hilo y que no se vayan a otra
 * pieza. La misma regla para la lectura del manual o la guía (lib/knowledge) y para el chat (lib/chat).
 * Las herramientas se nombran dentro de la frase; el detalle (para qué sirve, cómo se usa, dónde comprarla)
 * está en el panel "Herramientas que necesitás" (#230), no pegado al final del paso.
 */
export const ESTILO_PASOS = `Cómo se escriben los pasos (que se entiendan y tengan un hilo):
- Cada paso sigue al anterior y la persona entiende por qué lo hace. Si un paso saca, suelta o mueve algo que no es la pieza que se está arreglando, decí para qué en pocas palabras (ej. "Para llegar al ventilador, sacá los tornillos de la tapa de abajo.").
- Solo lo que lleva a la pieza que se está arreglando (la del síntoma, o la que pregunta la persona). Si la fuente es la guía de otra pieza, usá de ella solo lo que hace falta para abrir el equipo y llegar: nunca indiques cambiar ni sacar una pieza que no hace falta para esto. Desconectar la batería por seguridad sí va.
- La primera vez que nombrás una herramienta que no es de uso común (iOpener, púa, ventosa, destornillador pentalobe…), decí qué es en pocas palabras dentro de la misma frase (ej. "Calentá el borde con el iOpener, una bolsa de gel que se calienta en el microondas, hasta que esté tibio."). No la expliques aparte ni la vuelvas a explicar en los pasos siguientes.`;
