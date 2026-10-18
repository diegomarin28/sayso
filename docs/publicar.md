# Publicar la versión final (Iaio)

> **Correr SOLO cuando Diego diga "publicamos la versión final".** Antes de eso no se publica.

URL de la demo: **https://sayso-mu.vercel.app** (proyecto de Vercel de Iaio, `sayso6/sayso`). Se publica solo a mano: máximo unas 5 veces por día. **Quedan pocas publicaciones** (unas 2 o 3): no republicar por cada arreglo; la última sale cuando Diego lo diga, con todo fusionado.

## Checklist

1. **Traer main:** `git pull origin main` y `npm install`.

2. **Variables de entorno del proyecto de Vercel (production):**
   - `NEXT_PUBLIC_DATOS` **no tiene que existir**. Si está, borrarla (`vercel env rm NEXT_PUBLIC_DATOS production`): con ella la app muestra datos de ejemplo y no sirve para la entrega.
   - `IA_APAGADA` **no tiene que existir**.
   - Tienen que estar:
     - `ANTHROPIC_API_KEY`: la del equipo, la más nueva.
     - `NEXT_PUBLIC_SUPABASE_URL`: `https://gcuqeojcsiotwqtywmbo.supabase.co`.
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: empieza con `sb_publishable_`.
     - `SUPABASE_SERVICE_ROLE_KEY`: empieza con `sb_secret_` (la rotada).
     - `ELEVENLABS_API_KEY`.
     - `IA_LIMITE_USD_DIA=1` (si hoy dice 5, cambiarla: `printf 1 | vercel env add IA_LIMITE_USD_DIA production --force`).
   - Cómo revisarlas sin mostrar valores: `vercel env ls production` para los nombres. Para el formato, `vercel env pull <archivo temporal> --environment=production`, revisar solo el prefijo o si coincide con `.env.local`, y **borrar el archivo enseguida**.
   - Si hay que subir una clave: ponerla en `.env.local` y subirla con un comando que la lea del archivo (`grep … | vercel env add NOMBRE production --force`). **Nunca** a través del portapapeles mientras se copia el comando (así se cargó una vez el texto del comando en lugar de la clave).

3. **El proyecto NO está conectado a GitHub** (Settings → Git). Comprobar con `vercel git disconnect --yes`: tiene que decir *"No Git repository connected"*. Si estaba conectado, eso mismo lo desconecta.

4. **Publicar** desde una copia limpia de `main`, para que no se suba nada que no esté en main ni el `.env.local`:
   ```
   git fetch origin
   git worktree add --detach <carpeta temporal> origin/main
   cp .vercel/project.json <carpeta temporal>/.vercel/
   cd <carpeta temporal> && npx vercel --prod --yes
   git worktree remove --force <carpeta temporal>
   ```
   Pasarle la URL a Diego.

5. **Prueba rápida en el celular:**
   - Abrir https://sayso-mu.vercel.app en Safari o Chrome (no dentro de WhatsApp).
   - `/lab`, `/lab/campus`, `/lab/demo`, `/lab/visor` y `/lab/guia` tienen que dar **404** (prueba de que no hay modo de prueba activo). Desde una compu: `for r in lab lab/campus lab/demo lab/visor lab/guia; do curl -s -o /dev/null -w "$r %{http_code}\n" https://sayso-mu.vercel.app/$r; done` → todos `404`.
   - La pantalla 1 tiene que responder con **IA real**: con *"mi notebook se apaga sola"* dice *"Entendí: es tu notebook…"* y aparece la tarjeta "Notebook" elegida; no *"No te entendí bien"*.
