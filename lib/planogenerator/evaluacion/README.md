# Evaluación del generador del plano (B4) contra manuales reales

Herramientas genéricas: **no contienen ningún equipo, manual, página ni posición** (regla "Nada hardcodeado").
Los casos de prueba viven en una carpeta local ignorada por git (`manuales/`), uno por subcarpeta:

```
manuales/<caso>/
  caso.json   → fuente (url del manual, página de la vista explosionada, página interior, recorte)
              + referencia leída a ojo (esquinas de la carcasa y centro de cada pieza, en píxeles)
  kp.json     → knowledge pack de prueba (piezas y números de la tabla de piezas del manual)
```

El formato está validado en `caso.ts`. Los PDFs y las imágenes no se suben (copyright).

## Cómo correrla

```bash
npx tsx lib/planogenerator/evaluacion/preparar.ts manuales                                  # baja PDFs y arma paginas/
npx tsx --env-file=.env.local lib/planogenerator/evaluacion/correr.ts manuales salida --veces 3   # gasta créditos
npx tsx lib/planogenerator/evaluacion/evaluar.ts manuales salida --superponer
```

- Puntaje por pieza (escala 0–2 de `docs/3d-estrategia.md`): distancia entre centros en la planta normalizada (x, z de -1 a 1): ≤ 0,35 → 2; ≤ 0,7 → 1; si no → 0. Línea de base: la plantilla sin IA.
- Correr **varias veces**: una sola corrida engaña (en la primera prueba una corrida dio 73 % y el promedio real de ese prompt fue 47 %).
- `--superponer` dibuja sobre la vista interior el contorno de la carcasa, la referencia (verde) y la IA (naranja).
- Para la referencia conviene la página del ventilador o de la tapa inferior: el equipo dado vuelta, sin tapa. La vista explosionada no sirve para ubicar (las piezas están desplazadas a propósito).
