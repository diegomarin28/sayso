# Benchmark 3D por tipo de equipo (sin IA ni red)

Un equipo de referencia por **tipo** (`casos/<tipo>.json`), con sus medidas reales y fotos públicas anotadas a ojo.
Puntúa el plano que arma la app **sin IA** (la plantilla del tipo con el pack del caso: la red de seguridad) en cinco
ejes de 0 a 100, siempre igual en cada corrida. `benchmark.test.ts` lo corre en la CI contra `linea-base.json`: si un PR
empeora un puntaje, o engorda los GLB o los triángulos más de un 10 %, falla con lo que bajó. Sirve para elegir el próximo
cuello de botella con números y para que un arreglo de un tipo no rompa otro.

```bash
npx tsx scripts/benchmark3d/correr.ts                                   # tabla de los casos
npx tsx scripts/benchmark3d/correr.ts --solo reloj,televisor --salida /tmp/bench   # + resultado.json con el detalle
npx tsx scripts/benchmark3d/correr.ts --actualizar                      # guarda la línea de base (todos los casos)
npx tsx scripts/benchmark3d/correr.ts --superponer --salida /tmp/bench  # dibuja la anotación sobre las fotos locales
npx tsx scripts/benchmark3d/correr.ts --solo reloj --piezas             # el plano de cada caso (para anotar)

# Los planos REALES de la caché (lo que armó la IA; sin IA, pero lee Supabase: necesita .env.local):
npx tsx --env-file=.env.local scripts/bateria/correr.ts --mis-casos --demo --salida mis-casos.json
npx tsx scripts/benchmark3d/correr.ts --guardados mis-casos.json        # geometría, certeza y rendimiento (otro modelo: sin medidas ni fotos)
```

## Qué mide

| Eje | Cómo | Notas |
|---|---|---|
| **Geometría** | Forma (30 %): proporciones del equipo cerrado contra la ficha, sin la escala (error \|ln(plano/real)\| por eje; el doble o la mitad vale 0). Escala (10 %): tamaño contra el real. Choques (20 %): piezas que se encastran a medias (más del 10 % y menos del 90 % de la chica adentro de la otra; no cuentan una pieza con sus ancestros ni una entera adentro de otra). Flotantes (15 %): piezas que no tocan a ninguna. Cobertura (25 %): piezas del pack que están en el plano con una forma de la biblioteca (no una caja genérica). | Sobre las cajas del plano (`pos` ± `dim`/2): las cajas no saben qué es hueco. Las piezas `fuera` del cuerpo (correa, pie) no entran en las medidas ni en los choques. |
| **Posición** | Centro de cada pieza anotada en la foto contra el del plano, normalizados al contorno del `marco` (de -1 a 1; bilineal, aguanta perspectiva). Escala 0–2 por pieza de `docs/3d-estrategia.md` (≤ 0,35 → 2; ≤ 0,7 → 1). Una pieza que el plano no tiene vale 0. | Mide la disposición relativa, no el tamaño (eso es geometría). Sin fotos anotadas: «—». La tabla dice también cuánto daría el plano reflejado en x si da más: «20 (espejado: 90)» = el 3D quedó como en un espejo. |
| **Certeza** | 100 menos lo que el plano dice haber visto sin respaldo: `manual` sin página o `foto` sin URL. | «Sin verificar» no resta: el visor lo muestra como tal. |
| **Evidencia** | Parte de las piezas ubicadas con el manual o con fotos. | Informativo: sin IA siempre es 0 (y el test lo exige: una aproximación no se presenta como exacta). |
| **Rendimiento** | Peso de los GLB que bajaría el visor (`formasPara`, #313), triángulos y mallas contra un celular medio (5 MB, 200 000, 300; pasarse resta hasta 0 con el doble), y el encuadre de la vista general cerrado y despiezado en 390 × 640 con la cámara del visor (¿se corta?, ¿queda chico?). | Los fps reales no: eso necesita el navegador (`scripts/galeria3d`). |

La tabla también dice qué resta en cada caso (escala, choques, piezas flotantes, sin forma, faltantes, encuadre) y
`resultado.json` trae el detalle por pieza.

## Agregar o cambiar un caso

Un caso por tipo, sin datos de un equipo en el código (regla «nada hardcodeado»): todo vive en el JSON, validado por `caso.ts`.

1. `casos/<tipo>.json`: `tipoEquipo` (como lo dice la recepción), `equipo`, el `pack` (las piezas que nombraría una guía de ese
   tipo; `formaPantalla` y `rasgos3D` del equipo real), `fuera` (piezas que no son del cuerpo: correa, pie) y `medidas` en ejes
   del plano (x ancho, y alto, z profundidad; un equipo acostado: y es el espesor) con la URL de la ficha. Sin una ficha confiable,
   sin `medidas` (y una `nota` que diga por qué): la forma y la escala no se puntúan.
2. Fotos: bajarlas a `fotos/` (**ignorada por git: las imágenes no se suben**; el puntaje solo usa la anotación) y enderezarlas
   (`magick f.jpg -auto-orient f.jpg`). En el JSON van la URL, la página con autor y licencia, y la anotación.
3. Anotar: `npx tsx scripts/benchmark3d/grilla.ts fotos/x.jpg /tmp/g.png` (y `… 50 --recorte AxB+X+Y` para una zona) da una
   copia con la grilla en píxeles de la original. Se marcan las 4 esquinas del contorno del `marco` (o `"todo"`: el equipo entero)
   y el centro de las piezas que se ven con seguridad. `derecha` y `abajo`: qué eje del plano crece hacia la derecha y hacia abajo
   en la foto (si la cámara mira hacia `f` y `u` se ve hacia arriba: derecha = f × u, abajo = -u). Ojo con la orientación del
   plano (`--piezas`): un equipo parado (TV, heladera, microondas) tiene el interior hacia +z y el frente en -z
   (`orientacion.ts`); la notebook y el celular están dados vuelta (la tapa inferior o trasera arriba).
   **La anotación es la verdad de la foto: nunca se acerca a donde la pone el plano.**
4. Revisar con `--superponer` (celeste: el contorno; verde: la anotación; naranja: el plano) y `--actualizar`.

## Límites

- Las medidas y anotaciones también son aproximadas (a ojo, con perspectiva): sirven para comparar versiones del 3D entre sí,
  no para certificar precisión. Un puntaje alto no es una reconstrucción exacta.
- Un equipo de referencia por tipo: un arreglo que mejora el caso tiene que servir para el tipo (probarlo con otra variante).
- Las fotos son de terceros (Wikimedia Commons, iFixit CC BY-NC-SA, fabricantes): uso interno de evaluación; no se suben ni se
  publican. Antes de cualquier uso comercial, revisar licencias (`CONTEXT.md`).
