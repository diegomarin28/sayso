# Galería 3D en tamaño iPhone (sin IA)

Captura cada ejemplo del lab (`components/viewer/ejemplos.ts`: una plantilla por tipo de equipo)
**cerrado y despiezado** a 390 × 844, y arma una hoja (`index.html`) para revisar todo de un vistazo.
El jurado elige el aparato: sirve para ver qué tipo no se reconoce cerrado, queda chico o se sale de la pantalla.

```bash
NEXT_PUBLIC_DATOS=fixture npm run build && npx next start -p 3000   # en otra terminal
npx tsx scripts/galeria3d/galeria.ts                                # todos (unos 7 minutos)
npx tsx scripts/galeria3d/galeria.ts --solo televisor,celular --salida /tmp/galeria --base http://localhost:3001

# Además, los planos REALES de la caché (los equipos de la demo; sin IA) y los objetos del campus:
npx tsx --env-file=.env.local scripts/bateria/correr.ts --mis-casos --demo --salida mis-casos.json
npx tsx scripts/galeria3d/galeria.ts --casos mis-casos.json --campus [--sin-ejemplos]
```

Los planos sueltos (`--casos`, `--campus`) se abren en `/lab/visor?plano=guardado`, que lee `{ plano, tipoEquipo }`
del localStorage (`components/viewer/lab-guardado.ts`): así el 3D elige las variantes con el tipo de equipo, como en la app.

- Usa Chrome sin ventana (`CHROME` cambia la ruta; por defecto la de macOS) con GPU por software.
- Avisos automáticos por captura (`analisis.ts`, con tests): **vacío** (no se dibujó o quedó fuera de cámara),
  **chico** (ocupa menos de un tercio de ancho y de alto) y **cortado** (toca dos bordes opuestos). El fondo es
  el color de la esquina; la sombra de contacto no cuenta. Antes de capturar se oculta lo que el visor pone encima (botones, chips, etiquetas, el medidor de fps).
- También junta lo que el visor avisa por consola (`[visor]`, formas simples, excepciones).
- En `next dev` la primera visita a cada pantalla recompila: usar el build de producción.
