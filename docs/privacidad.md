> **BORRADOR — lo revisan las personas antes de publicar (Ley 25.326). Ningún agente lo da por bueno.**

# Privacidad en Sayso: notas para quien revisa

El texto para la persona está en un solo lugar: **`app/(screens)/privacidad/page.tsx`** (`/privacidad`).
Antes era también este archivo (#350) y los dos se desalinearon; desde Login 3/3 (#347) acá quedan
solo las notas para revisarlo, que no van al texto publicado. Desde el 21/10/2026 la página ya no tiene
`[COMPLETAR]`: mientras Sayso sea una demo de prueba (sin empresa ni datos legales propios), los textos lo dicen.
Antes de una versión comercial hay que completar: responsable y contacto reales, plazos de respuesta y la
autoridad de control (Ley 25.326), transferencia internacional por proveedor, borrado programado, limitación de
responsabilidad (Ley 24.240), licencias (iFixit CC BY-NC-SA, manuales, 3D), ley aplicable y jurisdicción.

## Evidencia de lo que el texto da por hecho

- Sin EXIF en el servidor: `lib/supabase/sin-metadatos.ts`, usado en `app/api/casos/route.ts`.
- Fotos privadas y enlace de 5 minutos: migración 010 y `lib/supabase/repo.ts` (`segundos = 300`).
- IP como HMAC del día y borrado a los 2 días: `lib/supabase/limite.ts` (`hashIp`) y migración 011.
- Cookie httpOnly: `lib/supabase/sesion.ts`.
- Guía y 3D en el servidor, escritos una sola vez por caso: tabla `guias` (migración 012),
  `POST /api/casos` y `GET /api/casos/[id]` (`docs/login.md` §6).
- Copia local de 30 casos: `app/(screens)/_datos/mis-casos.ts` (`MAX_CASOS`). Se mezcla con la del
  servidor al abrir «Mis casos» y se borra al salir de la cuenta o al borrarla (`cuenta/page.tsx`).
- Borrar cuenta y retención de 90 días: `lib/supabase/borrar.ts` y `scripts/retencion` (hoy se corre
  a mano; la página lo dice así).
- Exportar: `app/api/cuenta/exportar/route.ts`.
- Proveedores: `lib/ia/claude.ts` (Anthropic), `lib/voice/elevenlabs.ts` (ElevenLabs), Supabase
  (datos y cuentas), Resend (mails de Supabase), Cloudflare Turnstile y Vercel.

## Para decidir

- «Cómo terminó» puede incluir el enlace de la publicación donde la persona compró el repuesto
  (`cierre.compraUrl`). Decidir si se menciona.
- Si la persona cambia de equipo dentro de un caso, el anterior queda como otro caso con su guía
  (decisión de Iaio, 20/10): también aparece en «Mis casos».
- Las páginas de manuales en el bucket público `fotos/manuales/` no son datos de la persona.
- Los datos que ya estén en el bucket público `fotos` de antes de la 010 se mueven con
  `scripts/mover-fotos-privadas.ts`; confirmar que quedó en 0 antes de publicar.
