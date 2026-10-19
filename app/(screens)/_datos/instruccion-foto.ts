/**
 * Qué hay que sacar en una toma. Si la persona eligió otro lugar con el modelo (la caja, la factura,
 * el control remoto…), eso: la pantalla lo muestra y el control de calidad juzga contra esto mismo,
 * no contra el pedido original (#315). Vale para cualquier alternativa y cualquier equipo.
 */
export function instruccionDeToma(instruccionPedido: string, alternativa?: string): string {
  const otra = alternativa?.trim();
  if (!otra) return instruccionPedido;
  const lugar = `${otra.charAt(0).toLowerCase()}${otra.slice(1)}`;
  // "a" + "el control remoto" = "al control remoto".
  const conA = /^el\s/.test(lugar) ? `al ${lugar.slice(3)}` : `a ${lugar}`;
  return `Sacale una foto ${conA}, que se lea el modelo.`;
}
