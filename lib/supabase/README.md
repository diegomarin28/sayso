# lib/supabase

Dueño: Iaio

Cliente, esquema y migraciones de Supabase. Diseño del login, las sesiones y los casos por persona: `docs/login.md`.

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
  | `010_fotos_privadas.sql` | C | bucket privado `fotos-usuarios` para las fotos de las personas (#330); `fotos` queda público solo para las páginas del manual (`manuales/`). Después: `scripts/fotos-privadas/correr.ts --aplicar` mueve las fotos viejas | sí (20/10) |
  | `011_limite_casos.sql` | C | tabla `limite_uso` y función `sumar_limite_uso`: topes de `POST /api/casos` por IP (hash, nunca en claro) y por minuto/día; las filas de más de 2 días se borran solas (#332) | sí (20/10) |
  | `012_login.sql` | C | columna `casos.dueno` (`auth.uid()`, en cascada al borrar el usuario) con su índice, y tabla `guias` (copia fija de la guía y el plano 3D de cada caso, solo servidor). (#345) | sí (20/10) |

  Para una migración nueva: siguiente número (`012_…`), sumarla a esta tabla y avisar para que alguien la corra. Desde la 009 las tablas nuevas nacen sin permisos para la clave pública: si alguna vez el navegador tiene que leer algo, va con una política explícita y revisada.
- `cliente.ts`: `supabaseServidor()` (clave secreta, solo en rutas de API). El navegador no habla con Supabase, tampoco para Auth: todo pasa por las rutas de API. Si faltan variables devuelve `null` y nada se guarda: Supabase nunca frena la demo.
- `sesion.ts`: sesión de Supabase Auth en cookies **httpOnly** con `@supabase/ssr` (`docs/login.md` §3). `uidDeSesion()` devuelve el uid del JWT verificado con `getClaims()`, nunca de `getSession()` ni del cuerpo. Usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` solo en el servidor. `proxy.ts` (raíz) la refresca antes de `/api/casos` y `/api/cuenta/*`.
- `dueno.ts`: dueño de cada caso en `POST /api/casos` (#331, #345): el uid de la sesión (`casos.dueno`, migración 012). Sin sesión, 401. Un caso nuevo queda del uid que lo crea; uno que ya existe solo lo escribe su dueño (los que no tienen dueño no los escribe nadie); fotos y eventos no se reescriben desde otro caso. Si no, 403 sin guardar nada. Va después de los topes. `reclamarDispositivo`: el `dispositivo` anónimo de antes del login pasa sus casos sin dueño al uid una sola vez, y el celular lo borra.
- `cuenta.ts`, `credenciales.ts` y `app/api/cuenta/*` (Login 2/3, #346, #353): sesión anónima con Turnstile (`/anonima`), crear cuenta con email y contraseña confirmando el email por código (`/crear`, `/verificar`), iniciar sesión (`/entrar`), "Olvidé mi contraseña" (`/recuperar`, `/verificar`), `/salir` (solo con email), `DELETE /api/cuenta` y `/exportar`. Al entrar a una cuenta que ya existía, los casos de la sesión anónima pasan en el mismo pedido (`reclamarAnonima`). Topes por IP y por email en `limite.ts` (`revisarCuenta`): Supabase ve la IP de Vercel, no la de cada persona.
- `sin-metadatos.ts`: saca EXIF (GPS), XMP, IPTC y comentarios de las fotos JPEG, PNG y WebP antes de subirlas, sin volver a comprimirlas. Si los bytes no son del tipo que dicen, 400.
- `limite.ts`: topes de `POST /api/casos` (`TOPES`): pedidos e imágenes por IP por minuto y por día, fotos por caso. Pasado un tope, 429 sin guardar nada; `guardar()` solo lo registra. La IP se guarda como HMAC-SHA256 (`LIMITE_CLAVE_HASH`, si falta la clave secreta de Supabase) del día + IP. Sin la migración 011 cuenta en memoria.
- `repo.ts`: `guardarCaso`, `guardarFoto`, `subirFotoUsuario`, `urlFirmadaFoto`, `subirImagen`, `guardarFicha`, `guardarEventos`, `listarEventos`. Todo pasa por los esquemas de `shared/`.
- Fotos: las de las personas van al bucket **privado** `fotos-usuarios` con `subirFotoUsuario`, y `Foto.url` guarda la referencia (`fotos-usuarios/<casoId>/<fotoId>.<ext>`), no una URL. Para mostrarlas, `urlFirmadaFoto` (vence en 5 minutos) desde una ruta de API. `subirImagen` (bucket público `fotos`) es solo para páginas del manual.
- Fotos viejas en el bucket público: `npx tsx --env-file=.env.local scripts/fotos-privadas/correr.ts` lista sin tocar nada; con `--aplicar` las mueve y actualiza la tabla `fotos`.
- Escritura desde las pantallas: `POST /api/casos { caso?, fotos?: [{ foto, imagen? }], ficha?, eventos?, dispositivo? }` (con la cookie de sesión), que llaman en segundo plano desde `app/(screens)/_estado/flujo.tsx`.

**Para el carril A:** la caché del knowledge pack en Supabase se pasa así:

```ts
import { supabaseServidor } from "@/lib/supabase/cliente";
import { cachePacksSupabase } from "@/lib/supabase/repo";

armarKnowledgePack(entrada, { cache: cachePacksSupabase<Armado>(supabaseServidor()) });
```
