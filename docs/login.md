# Login, sesiones y casos por persona (carril C)

> Diseño aprobado por Iaio el 20/10/2026 (#343). Se implementa en los 3 PR del final; el 1/3 (#345) ya está.
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

- Al abrir la app por primera vez, el navegador pide una sesión anónima a una ruta de API propia, que
  llama a `supabase.auth.signInAnonymously()` en el servidor y deja un `auth.uid()`. La persona no ve
  nada: el flujo de emergencia sigue sin registro.
- "Guardar mis casos" (en Mis casos y al terminar un caso) convierte esa sesión en una cuenta con email.
  **El uid no cambia**, así que los casos no se migran.
- **El navegador sigue sin hablar con Supabase, tampoco para Auth** (decisión de Iaio, 20/10, en #345):
  la sesión anónima, el código por email y el reclamo pasan por rutas de API (`/api/cuenta/*`), que
  usan `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el servidor y escriben la sesión en cookies **httpOnly**. El
  JavaScript de la página nunca ve el token, así que un XSS no puede robar la sesión. Se descartó el
  cliente de Auth en el navegador (`createBrowserClient`): necesita leer la cookie y no puede ser httpOnly.
- Las tablas siguen cerradas por la 009 (sin permisos para `anon` ni `authenticated`). Se evaluó y se
  descartó leerlas desde el navegador con RLS por `auth.uid()`: todo sigue pasando por las rutas de API.
- Contra el abuso, se crean demasiadas sesiones anónimas:
  - **CAPTCHA en `signInAnonymously`** con Cloudflare Turnstile (gratis; es un servicio nuevo: cuenta y
    clave de Iaio). El widget corre en la página y su token viaja a la ruta, que lo pasa como `captchaToken`.
  - Además, el tope de Supabase de inicios anónimos por IP por hora.
- Descartados:
  - Mantener `dispositivo` + login opcional: el token al portador seguiría vivo.
  - Login obligatorio antes del primer caso: frena a quien tiene el equipo roto en ese momento.

### 2. Inicio de sesión: email y contraseña, con el email confirmado por código

> Cambio de Iaio, 20/10 (#353): antes era solo código por email (OTP), sin contraseña.

- **Crear cuenta:** nombre, apellido, email, contraseña (repetida) y aceptar los Términos y la Política de privacidad (`/terminos`, `/privacidad`; se guarda la versión aceptada y la fecha en `user_metadata.legales`, `VERSION_LEGALES` en `credenciales.ts`). Los dos textos son **borradores** para que los revisen las personas antes de publicar. La sesión anónima pide `updateUser({ email })`, que manda un
  código de 6 dígitos; con el código (`verifyOtp`, `type: "email_change"`) se confirma que el email es de
  la persona y recién ahí se guarda la contraseña (`updateUser({ password })`): Supabase no deja ponerle
  contraseña a una sesión anónima sin el email verificado. El uid no cambia. Mientras tanto la contraseña
  vive solo en la memoria de la pantalla. Si el email ya tiene cuenta, se pide iniciar sesión.
- **Iniciar sesión:** `signInWithPassword`, con CAPTCHA y topes por IP y por email.
- **Olvidé mi contraseña:** `resetPasswordForEmail` (con CAPTCHA) manda un código; con el código
  (`type: "recovery"`) se elige la contraseña nueva. Responde igual tenga o no cuenta el email.
- Contraseña: 8 o más caracteres, con letras y números (`lib/supabase/credenciales.ts`), y la misma regla
  en Supabase (Password requirements). El control de contraseñas filtradas de Supabase es del plan pago.
- Todo desde rutas de API (§1). Sin enlace mágico: en una PWA el enlace suele abrirse en otro navegador.
  Google se puede sumar después (`linkIdentity`).
- Con cuenta: el inicio saluda por el nombre, y Cuenta tiene secciones de cuenta (salir), seguridad
  (cambiar la contraseña con un código por email), tus datos (descargar) y borrar la cuenta.
- La sesión queda abierta en el celular hasta tocar «Salir en este celular» (la cookie de `@supabase/ssr` dura 400
  días). Sin recuadro de «Mantener la sesión»: se avisa con un texto en el login y en Cuenta (decisión de Iaio, 20/10).
- La app se sigue usando sin cuenta (sesión anónima). En la compu el inicio muestra "Iniciar sesión" y
  "Registrarte"; en el celular, solo "Iniciar sesión", y desde ahí se llega a registrarse.
- El correo que trae Supabase alcanza para probar (pocos mails por hora). **Para producción hace falta un
  SMTP propio** (cuenta nueva, con plan gratis; decide Iaio). Sin eso no se publica el login.
- Plantillas (Change Email Address y Reset Password): solo el código y "si no lo pediste, ignoralo".

### 3. Sesión en el servidor

- Sesión en cookies httpOnly con `@supabase/ssr` (dependencia nueva, aprobada con este diseño):
  `lib/supabase/sesion.ts`. El refresco va en `proxy.ts` (en Next 16 el middleware se llama proxy), que
  solo corre en `/api/casos` y `/api/cuenta/*`: las páginas y los modelos 3D no pasan por ahí.
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
  `sayso:dispositivo` cuando el servidor confirma (`dispositivoReclamado: true`), y ya no crea
  dispositivos nuevos. Riesgo aceptado: quien tenga el UUID antes del reclamo
  puede reclamar esos casos, el mismo poder que tiene hoy.
- **Entrar a una cuenta que ya existía** (por ejemplo, en un celular nuevo): la persona queda con otro uid.
  La ruta (`/entrar`, o `/verificar` al recuperar la contraseña) verifica la sesión anónima de antes en el
  mismo pedido, antes de cambiar de sesión, y después del inicio de sesión pasa sus casos al uid nuevo y
  borra ese usuario anónimo, ya vacío (decisión de Iaio, 20/10). Confirma con Auth que siga siendo
  anónima: nunca se reclaman casos de una cuenta con email. No guarda ningún token aparte.
- **Casos viejos sin `dispositivo`** (antes de la 007): quedan huérfanos y de solo lectura, y los borra
  la retención de abajo.

### 5. Datos personales

| Dato | Dónde | Por qué | Cómo se protege |
|---|---|---|---|
| Email | `auth.users` | iniciar sesión y recuperar casos | solo quien guarda sus casos; no se muestra a nadie ni va en los casos |
| Nombre y apellido | `auth.users` (`user_metadata`) | el saludo ("Hola, Ana") | se piden solo al crear la cuenta (decisión de Iaio, 20/10, #353); solo los ve la persona; se borran con la cuenta y van en la copia descargable |
| Síntoma (texto libre) | `casos` | el caso | puede traer datos personales: solo el dueño lo ve, por la API |
| Fotos | bucket privado `fotos-usuarios` | identificar y guiar | URL firmada de 5 min (#330). **EXIF:** el navegador ya lo saca al reescalar con canvas (`_datos/imagen.ts`), pero el servidor acepta cualquier base64; hay que sacarlo también en el servidor antes de subir (GPS) |
| Ficha (marca, modelo, **serie**) | `fichas` | el caso | la serie identifica el equipo: solo el dueño |
| Eventos | `eventos` | historial del caso | solo el dueño |
| IP | `limite_uso`, como HMAC | topes | nunca en claro; se borra a los 2 días (011) |

- **No se guardan** teléfono, dirección ni ubicación. Nombre y apellido, solo en la cuenta (fila de arriba), nunca en los casos.
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
- **Hecho (servidor, `c/guias-servidor`, parte de #347):** esquema en `lib/supabase/guia.ts`, `POST /api/casos`
  con `guia` (tope de 500 KB, `TOPES.bytesGuia`), `GET /api/casos` y `GET /api/casos/[id]`. La lista trae
  `tieneGuia` en vez de la guía.
- **Hecho (pantallas, `c/mis-casos-servidor`, cierra #347):** «Mis casos» trae `GET /api/casos` al abrirse y
  lo mezcla con el `localStorage` por `actualizadoEn` (`mezclarCasos`, la guía local nunca se pisa). Un caso
  con la guía solo en el servidor la baja de `GET /api/casos/[id]` al tocarlo; si no llega, avisa y no
  sigue (armarla de nuevo gastaría IA). Decisiones de Iaio, 20/10:
  - Si la persona cambia de equipo dentro de un caso, el caso pasa a tener **id nuevo** (`flujo.tsx`): el
    anterior queda con su guía y la regla de «una guía por caso» no cambia.
  - Al **salir de la cuenta** se borra la copia local de los casos: siguen en el servidor y vuelven al
    entrar, y en un celular compartido no quedan a la vista.

## Implementación (3 PR, en orden)

1. **`c/login-servidor`:**
   - Migración 012 (`casos.dueno`, tabla `guias`).
   - `@supabase/ssr`, el proxy de sesión y `dueno.ts` por uid.
   - Reclamo del dispositivo.
   - EXIF en el servidor.
   - Tests sin red (Supabase simulado, como `dueno.test.ts`).
2. **`c/login-pantallas`:**
   - Sesión anónima con Turnstile.
   - Crear cuenta e iniciar sesión con email y contraseña (código para confirmar el email) y el reclamo desde otra cuenta.
   - Pantalla de cuenta (salir, borrar, exportar).
   - Entre el 1/3 y el 2/3, `POST /api/casos` responde 401 (todavía no hay sesión) y los casos quedan
     solo en el celular: **no se publica** hasta que esté el 2/3 (decisión de Iaio, 20/10).
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
