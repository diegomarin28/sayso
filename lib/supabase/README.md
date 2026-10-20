# lib/supabase

Dueño: Iaio

Cliente, esquema y migraciones de Supabase.

- `migraciones/`: una sola carpeta para todos los carriles, numeradas en orden. Se aplican a mano en Supabase (**SQL Editor → New query → pegar → Run**), en orden, y se guarda la query con el nombre del archivo.

  | Archivo | Carril | Qué hace | ¿Aplicada? |
  |---|---|---|---|
  | `001_base.sql` | C | tablas `casos`, `fotos`, `fichas`, `eventos`, `knowledge_packs` y bucket `fotos` | sí |
  | `002_rls.sql` | C | permisos: el navegador solo lee `eventos` (lo cierra la 009) | sí |
  | `003_manuales.sql` | A | tabla `manuales`: caché de manuales del bibliotecario (solo servidor) | sí |
  | `004_planos.sql` | B | tabla `planos`: caché del plano 3D por marca + modelo (solo servidor) | sí |
  | `005_manuales_vista_interior.sql` | A | columna `pagina_vista_interior` en `manuales` (para /api/plano) | sí |
  | `006_gasto_ia.sql` | B | tabla `gasto_ia` y función `sumar_gasto_ia`: gasto diario de IA para el freno (solo servidor) | sí |
  | `007_mis_casos.sql` | C | columnas `dispositivo`, `tipo_equipo`, `cierre`, `actualizado_en` en `casos` ("Mis casos") | sí (20/10) |
  | `008_manuales_fuentes_publicas.sql` | A | columna `fuentes_publicas` en `manuales` (guía pública sin manual) | sí (#154) |
  | `009_solo_servidor.sql` | C | todo solo para el servidor: sin lectura pública de `eventos` ni Realtime, sin permisos para `anon`/`authenticated` en ninguna tabla (también las futuras) | sí (20/10) |
  | `010_fotos_privadas.sql` | C | bucket privado `fotos-usuarios` para las fotos de las personas (#330); `fotos` queda público solo para las páginas del manual (`manuales/`). Después: `scripts/fotos-privadas/correr.ts --aplicar` mueve las fotos viejas | no |
  | `011_limite_casos.sql` | C | tabla `limite_uso` y función `sumar_limite_uso`: topes de `POST /api/casos` por IP (hash, nunca en claro) y por minuto/día; las filas de más de 2 días se borran solas (#332) | no |

  Para una migración nueva: siguiente número (`012_…`), sumarla a esta tabla y avisar para que alguien la corra. Desde la 009 las tablas nuevas nacen sin permisos para la clave pública: si alguna vez el navegador tiene que leer algo, va con una política explícita y revisada.
- `cliente.ts`: `supabaseServidor()` (clave secreta, solo en rutas de API). El navegador no habla con Supabase: todo pasa por las rutas de API. Si faltan variables devuelve `null` y nada se guarda: Supabase nunca frena la demo. `NEXT_PUBLIC_SUPABASE_ANON_KEY` queda en `.env.example` para el login.
- `limite.ts`: topes de `POST /api/casos` (`TOPES`): pedidos e imágenes por IP por minuto y por día, fotos por caso. Pasado un tope, 429 sin guardar nada; `guardar()` solo lo registra. La IP se guarda como HMAC-SHA256 (`LIMITE_CLAVE_HASH`, si falta la clave secreta de Supabase) del día + IP. Sin la migración 011 cuenta en memoria.
- `repo.ts`: `guardarCaso`, `guardarFoto`, `subirFotoUsuario`, `urlFirmadaFoto`, `subirImagen`, `guardarFicha`, `guardarEventos`, `listarEventos`. Todo pasa por los esquemas de `shared/`.
- Fotos: las de las personas van al bucket **privado** `fotos-usuarios` con `subirFotoUsuario`, y `Foto.url` guarda la referencia (`fotos-usuarios/<casoId>/<fotoId>.<ext>`), no una URL. Para mostrarlas, `urlFirmadaFoto` (vence en 5 minutos) desde una ruta de API. `subirImagen` (bucket público `fotos`) es solo para páginas del manual.
- Fotos viejas en el bucket público: `npx tsx --env-file=.env.local scripts/fotos-privadas/correr.ts` lista sin tocar nada; con `--aplicar` las mueve y actualiza la tabla `fotos`.
- Escritura desde las pantallas: `POST /api/casos { caso?, fotos?: [{ foto, imagen? }], ficha?, eventos? }`, que llaman en segundo plano desde `app/(screens)/_estado/flujo.tsx`.

**Para el carril A:** la caché del knowledge pack en Supabase se pasa así:

```ts
import { supabaseServidor } from "@/lib/supabase/cliente";
import { cachePacksSupabase } from "@/lib/supabase/repo";

armarKnowledgePack(entrada, { cache: cachePacksSupabase<Armado>(supabaseServidor()) });
```
