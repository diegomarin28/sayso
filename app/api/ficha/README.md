# app/api/ficha

Dueño: Juanma

Ficha del equipo con estados confirmado/probable/desconocido. Confirmación en `lib/ficha/ficha.ts` (solo código, sin IA); modelo ambiguo en `lib/intake/precisar.ts` (Haiku).

`POST { ficha, confirmados?: ["modelo", ...], correcciones?: { serie: "ABC" }, tipoEquipo?, precision? }` → `{ ficha, listaParaPreparar, cambiados, precisar?, eventos }`

- Confirmar un campo con valor → `confirmado`, fuente `chapa+usuario`.
- Corregir → `confirmado`, fuente `usuario`; vacío → `desconocido`.
- `listaParaPreparar` = el modelo está confirmado (se puede buscar el manual).
- Todavía no guarda en Supabase: se conecta cuando exista `lib/supabase`.

## Modelo ambiguo (`precisar`)

Con un modelo que es una familia ("MacBook Air", "ThinkPad E14", "Galaxy Z Flip") se buscaría el manual de cualquier versión. Antes de buscarlo:

1. Si el modelo trae un código de etiqueta (`A2337`, `SM-A546E`, `20UT0016US`), ya es una versión: no se llama a la IA.
2. Si no, Haiku decide si es una familia (~US$ 0,0002; el mismo modelo no vuelve a pagar). Si lo es, la respuesta trae `precisar: { pregunta, dondeMirar }` y un evento `modelo_ambiguo`.
3. La pantalla muestra la pregunta con un campo de texto y "No sé". La respuesta vuelve con `precision` (y la ficha que devolvió la llamada anterior): Haiku arma el nombre preciso y el código acepta solo palabras del modelo o de la respuesta, nunca una versión que la persona no dijo. El modelo nuevo queda `confirmado` con fuente `usuario` (y `"modelo"` en `cambiados`). Si sigue ambiguo, vuelve otro `precisar`.
4. "No sé": seguir a preparar (o mandar `precision: ""`, que no pregunta más).

Nunca frena el flujo: si la IA falla o está en pausa, la ficha se confirma igual y no viene `precisar`.
