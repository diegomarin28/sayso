# Login, sesiones y casos por persona (carril C)

> Diseño aprobado por Iaio el 20/10/2026 (#343). Todavía no está implementado: se hace en los 3 PR del final.
> Cambiar una decisión de acá es un PR a este archivo con el OK de Iaio.

## Punto de partida (main en `ac5e2f4`)

- El dueño de un caso es el `dispositivo`: un UUID al azar en el `localStorage` del celular
  (`app/(screens)/_datos/mis-casos.ts`), que se manda en el cuerpo de cada `POST /api/casos` y
  revisa `lib/supabase/dueno.ts` (#331/#342). Funciona como token al portador y se pierde si se borran
  los datos del navegador.
- El servidor guarda `casos`, `fotos` (bucket privado `fotos-usuarios`), `fichas` y `eventos`, pero
  **no la guía ni el plano 3D del caso**: eso vive solo en el `localStorage` (`CasoGuardado.guia`).
  En otro celular, o después de borrar los datos, el caso no se puede retomar sin volver a gastar IA.
  Los cachés `knowledge_packs` y `planos` van por marca + modelo, no por caso.
- Desde la 009 el navegador no habla con Supabase: todo pasa por las rutas de API con la clave secreta.

## Decisiones

### 1. Identidad: sesión anónima de Supabase Auth desde el primer uso

- Al abrir la app por primera vez, el navegador llama a `supabase.auth.signInAnonymously()` y obtiene un
  `auth.uid()`. La persona no ve nada: el flujo de emergencia sigue sin registro.
- "Guardar mis casos" (en Mis casos y al terminar un caso) convierte esa sesión en una cuenta con email.
  **El uid no cambia**, así que los casos no se migran.
- El navegador vuelve a usar `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **solo para Auth**. Las tablas siguen
  cerradas por la 009 (sin permisos para `anon` ni `authenticated`). Se evaluó y se descartó leerlas
  desde el navegador con RLS por `auth.uid()`: todo sigue pasando por las rutas de API.
- Contra el abuso, se crean demasiadas sesiones anónimas:
  - **CAPTCHA en `signInAnonymously`** con Cloudflare Turnstile (gratis; es un servicio nuevo: cuenta y
    clave de Iaio).
  - Además, el tope de Supabase de inicios anónimos por IP por hora.
- Descartados:
  - Mantener `dispositivo` + login opcional: el token al portador seguiría vivo.
  - Login obligatorio antes del primer caso: frena a quien tiene el equipo roto en ese momento.

### 2. Inicio de sesión: email con código de 6 dígitos (OTP)

- `signInWithOtp({ email })` / `verifyOtp({ email, token, type })`; para convertir la sesión anónima,
  `updateUser({ email })` y verificar el código (`type: "email_change"`).
- **No** enlace mágico: en una PWA en el celular el enlace suele abrirse en otro navegador y la sesión
  queda allá. Google se puede sumar después (`linkIdentity`), sin cambiar este diseño.
- El correo que trae Supabase alcanza para probar (pocos mails por hora). **Para producción hace falta un
  SMTP propio** (cuenta nueva, con plan gratis; decide Iaio). Sin eso no se publica el login.
- Plantilla del mail: solo el código y "si no lo pediste, ignoralo". Nada del caso.

### 3. Sesión en el servidor

- Sesión en cookies httpOnly con `@supabase/ssr` (dependencia nueva, aprobada con este diseño). El
  refresco de la sesión va en el proxy/middleware de Next: antes de escribirlo, leer la guía de Next 16
  en `node_modules/next/dist/docs/` (ahí cambió el nombre y la forma).
- Las rutas leen el uid de la sesión verificada (`auth.getClaims()` o `auth.getUser()`), **nunca
  `getSession()` sin verificar ni un campo del cuerpo**. `POST /api/casos` deja de leer `dispositivo`
  como dueño.
- `dueno.ts` compara `casos.dueno` con ese uid. Mismas reglas que hoy: caso nuevo queda del uid que lo
  crea; uno existente solo lo escribe su dueño; fotos y eventos no se reescriben desde otro caso; un
  solo 403 que no cuenta si el caso existe.
- Sin sesión válida: 401 y no se guarda nada (la app sigue en el celular, como hoy si Supabase falla).

### 4. Migración de `dispositivo` a `auth.uid()`

- **Migración 012:** `casos.dueno uuid references auth.users (id) on delete cascade` + índice
  `(dueno, actualizado_en desc)`. `dispositivo` queda solo para el reclamo y se borra en una migración
  posterior, cuando ya no lleguen pedidos con él.
- **Reclamo del dispositivo** (una sola vez por celular): el primer pedido con sesión manda también el
  `dispositivo` viejo. El servidor pone `dueno = uid` en los casos con ese `dispositivo` y `dueno is null`,
  y les borra el `dispositivo`. Desde ahí el dispositivo no da permiso sobre nada. El cliente borra
  `sayso:dispositivo` cuando el servidor confirma. Riesgo aceptado: quien tenga el UUID antes del reclamo
  puede reclamar esos casos, el mismo poder que tiene hoy.
- **Email que ya tiene cuenta** (por ejemplo, en un celular nuevo): `updateUser` falla, la persona inicia
  sesión con OTP y queda con otro uid. Antes de cambiar de sesión, el cliente guarda el token de la
  sesión anónima y lo manda a `POST /api/cuenta/reclamar` junto con la cookie de la sesión nueva. El
  servidor verifica las dos, comprueba que la vieja sea anónima (`is_anonymous`) y pasa sus casos al
  uid nuevo. Nunca se reclaman casos de una cuenta con email.
- **Casos viejos sin `dispositivo`** (antes de la 007): quedan huérfanos y de solo lectura, y los borra
  la retención de abajo.

### 5. Datos personales

| Dato | Dónde | Por qué | Cómo se protege |
|---|---|---|---|
| Email | `auth.users` | iniciar sesión y recuperar casos | solo quien guarda sus casos; no se muestra a nadie ni va en los casos |
| Síntoma (texto libre) | `casos` | el caso | puede traer datos personales: solo el dueño lo ve, por la API |
| Fotos | bucket privado `fotos-usuarios` | identificar y guiar | URL firmada de 5 min (#330). **EXIF:** el navegador ya lo saca al reescalar con canvas (`_datos/imagen.ts`), pero el servidor acepta cualquier base64; hay que sacarlo también en el servidor antes de subir (GPS) |
| Ficha (marca, modelo, **serie**) | `fichas` | el caso | la serie identifica el equipo: solo el dueño |
| Eventos | `eventos` | historial del caso | solo el dueño |
| IP | `limite_uso`, como HMAC | topes | nunca en claro; se borra a los 2 días (011) |

- **No se guardan** nombre, teléfono, dirección ni ubicación.
- **Borrar cuenta** (`DELETE /api/cuenta`): borra sus casos (en cascada: fotos, ficha, eventos, guías),
  **los archivos de `fotos-usuarios/<casoId>/`**, que la cascada de Postgres no toca, y el usuario de Auth.
- **Exportar mis casos** (`GET /api/cuenta/exportar`): JSON con los casos, fichas y eventos, y las fotos
  como URL firmadas.
- **Retención:**
  - Las sesiones anónimas sin actividad en **90 días** se borran con sus casos y fotos. Es un script o
    función programada que corre el servidor, con el mismo borrado que "Borrar cuenta".
  - Los casos huérfanos (sin `dueno` ni `dispositivo`) se borran con el mismo criterio de 90 días.
  - Las cuentas con email no vencen.
- **Texto de privacidad** (qué se guarda, para qué, cómo borrarlo): se escribe con este diseño, pero lo
  revisan las personas antes de publicar (Ley 25.326). Ningún agente lo da por bueno.

### 6. Recuperar un caso con su 3D sin regenerarlo: copia fija en el servidor

- Tabla nueva `guias`:
  - `caso_id` (PK, `references casos on delete cascade`);
  - `preparado jsonb` (pack, manual, páginas, vista interior);
  - `plano jsonb` (`PlanoDePiezas`, origen, avisos);
  - `version int`, `creado_en`.
  
  Es lo mismo que hoy es `CasoGuardado.guia`, validado con Zod antes de guardar.
- Se escribe por `POST /api/casos` cuando el flujo guarda la guía (`flujo.tsx`, mismo momento que
  `guardarLocal`), con las mismas reglas de dueño y topes. Una vez escrita no cambia: retomar muestra
  exactamente lo que la persona vio, aunque el caché de `planos` o `knowledge_packs` se regenere.
- Leer:
  - `GET /api/casos`: lista del dueño, sin la guía.
  - `GET /api/casos/[id]`: el caso con ficha, fotos firmadas y guía.
  
  Solo para el dueño; si no, el mismo 404 exista o no. **Ninguna de las dos llama a la IA.**
- El 3D se arma en el navegador desde el plano y los modelos del repo: no se guarda ningún GLB.
- El esquema `Guia` se mueve de `mis-casos.ts` a `lib/supabase` (armado con `KnowledgePack` y
  `PlanoDePiezas` de `shared/`): **no cambia el contrato**.
- El `localStorage` sigue como caché para abrir rápido y sin red. Si hay sesión, la lista sale del
  servidor y se mezcla con lo local por `actualizadoEn`.
- Descartado: guardar solo referencias a los cachés. Si el caché se regenera, el caso viejo cambia sin aviso.

## Implementación (3 PR, en orden)

1. **`c/login-servidor`:**
   - Migración 012 (`casos.dueno`, tabla `guias`).
   - `@supabase/ssr`, el proxy de sesión y `dueno.ts` por uid.
   - Reclamo del dispositivo.
   - EXIF en el servidor.
   - Tests sin red (Supabase simulado, como `dueno.test.ts`).
2. **`c/login-pantallas`:**
   - Sesión anónima con Turnstile.
   - "Guardar mis casos" con OTP y el reclamo desde otra cuenta (`/api/cuenta/reclamar`).
   - Pantalla de cuenta (salir, borrar, exportar).
3. **`c/casos-en-servidor`:**
   - Escribir y leer `guias`, y Mis casos desde el servidor.
   - Retención de 90 días.
   - Texto de privacidad para revisar.

**Antes de publicar, a cargo de Iaio en Supabase:**
- Activar Anonymous Sign-Ins y el CAPTCHA.
- Configurar el SMTP y la plantilla del código.
- Correr la 012.

## Fuera de este diseño

- Pedir sesión en los endpoints que gastan IA (`intake`, `ficha`, `knowledge`, `plano`, `chat`) para
  frenar el abuso: se propone a los carriles A y B en un issue aparte. No se cambia sin ellos.
