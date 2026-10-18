# Publicar la versión final (Iaio)

> **Correr SOLO cuando Diego diga "publicamos la versión final".** Antes de eso no se publica.

URL de la demo: **https://sayso-mu.vercel.app** (proyecto de Vercel de Iaio, `sayso6/sayso`). Se publica solo a mano: máximo unas 5 veces por día. **Quedan pocas publicaciones** (unas 2 o 3): no republicar por cada arreglo; la última sale cuando Diego lo diga, con todo fusionado.

## Antes de arrancar

- Que estén **cerrados** #236 (compras: búsqueda web del chat), #232 (notebook abierta) y #233 (tablet completa), y que no quede ningún PR abierto que vaya en la entrega.
- Que Diego haya dicho el **tope diario de IA** (`IA_LIMITE_USD_DIA`) para la entrega.
- Contar las publicaciones de las últimas 24 h (API de Vercel, `/v6/deployments`) y dejar **1 de reserva** después de la final.
- Disco: `df -h /System/Volumes/Data` con al menos 8 GB libres.

## Checklist

1. **Traer main:** `git pull origin main` y `npm install` (con Node 22: `.nvmrc`).

2. **Variables de entorno del proyecto de Vercel (production):**
   - `NEXT_PUBLIC_DATOS` **no tiene que existir**. Si está, borrarla (`vercel env rm NEXT_PUBLIC_DATOS production`): con ella la app muestra datos de ejemplo y no sirve para la entrega.
   - `IA_APAGADA` **no tiene que existir**.
   - Tienen que estar:
     - `ANTHROPIC_API_KEY`: la del equipo, la más nueva.
     - `NEXT_PUBLIC_SUPABASE_URL`: `https://gcuqeojcsiotwqtywmbo.supabase.co`.
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: empieza con `sb_publishable_`.
     - `SUPABASE_SERVICE_ROLE_KEY`: empieza con `sb_secret_` (la rotada).
     - `ELEVENLABS_API_KEY`.
     - `IA_LIMITE_USD_DIA` con el tope que dijo Diego (hoy está en 1). Para cambiarla: `printf <tope> | vercel env add IA_LIMITE_USD_DIA production --force`. Las variables se leen al publicar: cambiarla **antes** del paso 4.
   - Cómo revisarlas sin mostrar valores: `vercel env ls production` para los nombres. Para el formato, `vercel env pull <archivo temporal> --environment=production`, revisar solo el prefijo o si coincide con `.env.local`, y **borrar el archivo enseguida**.
   - Si hay que subir una clave: ponerla en `.env.local` y subirla con un comando que la lea del archivo (`grep … | vercel env add NOMBRE production --force`). **Nunca** a través del portapapeles mientras se copia el comando (así se cargó una vez el texto del comando en lugar de la clave).

3. **Fluid Compute activo** (Settings → Functions, o `resourceConfig.fluid` en la API del proyecto): sin él, Hobby corta a los 60 s y el build se rechaza porque `/api/knowledge` y `/api/plano` piden 300 s.

   **El proyecto NO está conectado a GitHub** (Settings → Git). Comprobar con `vercel git disconnect --yes`: tiene que decir *"No Git repository connected"*. Si estaba conectado, eso mismo lo desconecta.

4. **Publicar** desde una copia limpia de `main`, para que no se suba nada que no esté en main ni el `.env.local`:
   ```
   git fetch origin
   git worktree add --detach <carpeta temporal> origin/main
   mkdir -p <carpeta temporal>/.vercel && cp .vercel/project.json <carpeta temporal>/.vercel/
   cd <carpeta temporal> && npx vercel --prod --yes
   git worktree remove --force <carpeta temporal>
   ```
   Pasarle la URL a Diego.

5. **Prueba rápida en el celular:**
   - Abrir https://sayso-mu.vercel.app en Safari o Chrome (no dentro de WhatsApp).
   - `/lab`, `/lab/campus`, `/lab/demo`, `/lab/visor`, `/lab/guia`, `/lab/galeria` y `/lab/compras` tienen que dar **404** (prueba de que no hay modo de prueba activo). Desde una compu: `for r in lab lab/campus lab/demo lab/visor lab/guia lab/galeria lab/compras; do curl -s -o /dev/null -w "$r %{http_code}\n" https://sayso-mu.vercel.app/$r; done` → todos `404`.
   - Los 4 casos de la demo desde "Mis casos" (sin IA): abren en el experto con el 3D, "Seguir con la guía · N pasos" y "Ver dónde comprar repuestos".
   - La pantalla 1 tiene que responder con **IA real**: con *"mi notebook se apaga sola"* dice *"Entendí: es tu notebook…"* y aparece la tarjeta "Notebook" elegida; no *"No te entendí bien"*.
