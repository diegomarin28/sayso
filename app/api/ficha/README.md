# app/api/ficha

Dueño: Juanma

Ficha del equipo con estados confirmado/probable/desconocido. Lógica en `lib/ficha/ficha.ts` (solo código, sin IA).

`POST { ficha, confirmados?: ["modelo", ...], correcciones?: { serie: "ABC" } }` → `{ ficha, listaParaPreparar, cambiados, eventos }`

- Confirmar un campo con valor → `confirmado`, fuente `chapa+usuario`.
- Corregir → `confirmado`, fuente `usuario`; vacío → `desconocido`.
- `listaParaPreparar` = el modelo está confirmado (se puede buscar el manual).
- Todavía no guarda en Supabase: se conecta cuando exista `lib/supabase`.
