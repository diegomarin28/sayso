# Evaluación del generador del plano (B4) con manuales reales

Mide qué tan bien coinciden las posiciones del 3D generado por la IA con el diagrama del manual
(escala 0–2 por pieza de `docs/3d-estrategia.md`), contra la plantilla sin IA como línea de base.

## Cómo correrla

```bash
bash lib/planogenerator/evaluacion/preparar.sh          # baja manuales a manuales/ (ignorado por git) y arma imágenes
for m in t480:57,89 e14-gen4:55,78 l14-gen2:57,88; do   # gasta créditos: 3 llamadas
  id=${m%%:*}; npx tsx --env-file=.env.local lib/planogenerator/probar-plano.ts \
    lib/planogenerator/evaluacion/kp-$id.json manuales/$id/paginas/explosionada.png manuales/$id/paginas/interior.png \
    --pag ${m##*:} --salida manuales/resultados/plano-$id.json
done
npx tsx lib/planogenerator/evaluacion/evaluar.ts manuales/resultados --superponer
```

- `kp-*.json`: knowledge packs de prueba con las piezas y números de la tabla "Major FRUs" de cada manual. La `ubicacion` es neutra a propósito: se mide lo que la IA lee de las imágenes.
- `referencias.json`: centro de cada pieza leído **a ojo** (una persona) sobre la vista interior (página del ventilador: equipo dado vuelta, sin tapa) y las 4 esquinas de la carcasa. Solo piezas identificables sin dudas; las excluidas tienen el motivo.
- Puntaje: distancia en la planta normalizada (x, z de -1 a 1): ≤ 0,35 → 2; ≤ 0,7 → 1; si no → 0.

## Resultados (17/10/2026, `claude-sonnet-5-5`, effort low, prompt de `generador.ts`)

| Modelo | IA | Plantilla sin IA |
|---|---|---|
| ThinkPad T480 (6 piezas) | 8/12 | 4/12 |
| ThinkPad E14 Gen 4 (3 piezas) | 5/6 | 1/6 |
| ThinkPad L14 Gen 2 (4 piezas) | 6/8 | 2/8 |
| **Total** | **19/26 (73 %)** | 7/26 (27 %) |

- Bien: ventilador (2, 2, 1), Wi-Fi (2, 2), placa I/O (2), batería extraíble (2). Números del diagrama y páginas citadas correctos en las 3.
- Mal: SSD del T480 (0: la puso atrás; la bahía está adelante a la izquierda). La batería interna sale siempre centrada en x = 0 (1 punto en todos los casos).
- Límites de la medición: una sola corrida por modelo (sin medir variabilidad), referencia de una sola persona, 13 piezas en total. Parlantes (dos piezas en un FRU), pila BIOS y placa madre no se puntúan.
