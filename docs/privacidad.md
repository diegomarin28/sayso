> **BORRADOR — lo revisan las personas antes de publicar (Ley 25.326). Ningún agente lo da por bueno.**
>
> Escrito a partir de `docs/login.md` (§5) y del código de `main` en `0e97f24`. Lo marcado
> «(pendiente: Login 2/3)» o «(pendiente: Login 3/3)» todavía no existe y no se publica como hecho.
> Las notas para quien revisa están al final y no son parte del texto para la persona.

# Privacidad en Sayso

Sayso te ayuda a reparar un equipo desde el celular. Para eso guarda algunos datos de tu caso. Acá
te contamos cuáles, para qué, dónde, cuánto tiempo y cómo borrarlos.

**Responsable de los datos:** [COMPLETAR: razón social, CUIT y domicilio]
**Contacto para temas de privacidad:** [COMPLETAR: email]
**Última actualización:** [COMPLETAR: fecha]

## Lo que NO guardamos

- Tu nombre, tu teléfono, tu dirección ni tu ubicación.
- Los datos ocultos de las fotos: se suben **sin EXIF ni GPS** (sin el lugar, la fecha ni el modelo
  del celular con que las sacaste). Se los sacamos en tu celular y otra vez en nuestro servidor.
- Tu IP en claro (ver más abajo).

## Lo que guardamos y para qué

| Dato | Para qué | Quién lo ve |
|---|---|---|
| **Tu email**, solo si elegís «Guardar mis casos» (pendiente: Login 2/3) | Iniciar sesión y recuperar tus casos en otro celular | Nadie más. No se muestra ni va dentro de los casos |
| **Lo que contás del problema** (el síntoma, escrito o dictado) | Armar tu caso y la guía | Solo vos |
| **Las fotos** que sacás | Identificar el equipo y guiarte | Solo vos. Se guardan en un espacio privado y se muestran con un enlace que vence a los 5 minutos |
| **La ficha del equipo**: marca, modelo y **número de serie** | Armar tu caso y buscar la información correcta | Solo vos. El número de serie identifica tu equipo, por eso lo tratamos como dato personal |
| **Los eventos del caso** (qué pasos se hicieron y cómo terminó) | El historial del caso | Solo vos |
| **La guía y el modelo 3D** de tu caso (pendiente: Login 3/3) | Que puedas retomar el caso tal como lo viste, sin volver a generarlo | Solo vos |
| **Tu IP, solo como hash** | Poner topes de uso y frenar abusos | Nadie: se guarda transformada (no se puede leer la IP) y cambia cada día |

Ninguna otra persona que use Sayso puede ver tus casos: el servidor solo se los muestra a la sesión
que los creó.

## Cómo te reconocemos sin pedirte datos

Al abrir Sayso por primera vez se crea una **sesión anónima** (pendiente: Login 2/3): una
identificación al azar, sin email ni nombre, que se guarda en una cookie de tu navegador que el
código de la página no puede leer. Tus casos quedan asociados a esa sesión.

Si elegís «Guardar mis casos», le sumás tu email a esa misma sesión y recibís un código de 6
dígitos para confirmarlo (pendiente: Login 2/3). Así podés recuperar tus casos en otro celular.

Para frenar el uso automatizado, antes de crear la sesión se hace una verificación de Cloudflare
Turnstile (pendiente: Login 2/3).

## Dónde se guardan

- **En nuestro servidor**, en Supabase: tus casos, fotos, fichas y eventos, y tu email si guardás tus
  casos. [COMPLETAR: país o región donde están alojados los datos]
- **En tu propio celular**: una copia de tus últimos 30 casos (con la guía), para abrirlos rápido y
  sin conexión. Se borra si borrás los datos del navegador.

## Con quién se comparten

Para darte la guía usamos servicios de terceros. Les mandamos solo lo necesario para cada paso:

- **Anthropic (Claude)**, el modelo de inteligencia artificial: recibe lo que contás, las fotos y la
  ficha del equipo para identificarlo y responderte.
- **ElevenLabs**, solo si usás la voz: recibe el audio de lo que dictás y el texto que se lee en voz alta.
- **Supabase**, donde se guardan los datos (ver arriba).
- **Cloudflare Turnstile**, para la verificación contra robots (pendiente: Login 2/3).

[COMPLETAR: alojamiento de la app, transferencia internacional de datos y qué hace cada proveedor
con lo que recibe, según sus términos]

No vendemos tus datos ni los usamos para publicidad. [COMPLETAR: confirmar con las personas antes de publicar]

## Cuánto tiempo los guardamos

- **Sesiones anónimas** (sin email): se borran con sus casos y fotos después de **90 días sin
  actividad** (pendiente: Login 3/3).
- **Cuentas con email:** no vencen. Tus casos quedan hasta que los borres.
- **El hash de tu IP:** se borra a los **2 días**.

## Cómo borrar o llevarte tus datos

- **Borrar tu cuenta** (pendiente: Login 2/3): desde la pantalla de cuenta. Borra tus casos, fotos,
  fichas, eventos y guías, y tu email. No se puede deshacer.
- **Exportar tus casos** (pendiente: Login 2/3): desde la pantalla de cuenta, te descargás un archivo
  con tus casos, fichas y eventos, y enlaces a tus fotos (vencen a los pocos minutos).
- **La copia de tu celular:** la borrás borrando los datos del navegador para Sayso.

También podés pedir acceso, corrección o borrado de tus datos escribiendo a [COMPLETAR: email].
[COMPLETAR: plazo de respuesta y texto legal sobre los derechos de la Ley 25.326 y la autoridad de
control (AAIP)]

## Cambios

Si cambiamos esta política, lo avisamos en la app. [COMPLETAR: cómo y con cuánta anticipación]

---

## Notas para quien revisa (no van al texto publicado)

- **Hoy (entre Login 1/3 y 2/3)** `POST /api/casos` responde 401 sin sesión, así que el servidor no
  guarda casos nuevos: todo queda en el celular. Por eso no se publica hasta el 2/3 (`docs/login.md`).
- Evidencia de lo que el texto da por hecho:
  - Sin EXIF en el servidor: `lib/supabase/sin-metadatos.ts`, usado en `app/api/casos/route.ts`.
  - Fotos privadas y enlace de 5 minutos: migración 010 y `lib/supabase/repo.ts` (`segundos = 300`).
  - IP como HMAC del día y borrado a los 2 días: `lib/supabase/limite.ts` (`hashIp`) y migración 011.
  - Cookie httpOnly: `lib/supabase/sesion.ts`.
  - Copia local de 30 casos: `app/(screens)/_datos/mis-casos.ts` (`MAX_CASOS`).
  - Proveedores: `lib/ia/claude.ts` (Anthropic) y `lib/voice/elevenlabs.ts` (ElevenLabs).
- Para revisar: «cómo terminó» puede incluir el enlace de la publicación donde la persona compró el
  repuesto (`cierre.compraUrl`). Decidir si se menciona.
- Las páginas de manuales en el bucket público `fotos/manuales/` no son datos de la persona.
- Los datos que ya estén en el bucket público `fotos` de antes de la 010 se mueven con
  `scripts/mover-fotos-privadas.ts`; confirmar que quedó en 0 antes de publicar.
