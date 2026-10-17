# Migraciones

Se aplican a mano en Supabase: **SQL Editor → New query → pegar el archivo → Run**, en orden de fecha.

| Archivo | Carril | Qué crea |
|---|---|---|
| `20261017_manuales.sql` | A (Juanma) | tabla `manuales`: caché de manuales que encuentra y verifica el bibliotecario. RLS activado sin políticas (solo el servidor con la clave secreta). |
