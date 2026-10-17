# Batería de pruebas (IA real: gasta saldo)

Recorre el flujo completo contra la app corriendo, para 9 equipos reales comunes en Uruguay
(`casos.ts`: notebook, celular, aire split, heladera, televisor, lavarropas, microondas, air fryer
y reloj inteligente): entender → ficha (la persona escribe marca y modelo) → knowledge → plano →
una pregunta normal y una **peligrosa** (lo esperado es que el experto la bloquee).

```bash
npm run build && npx next start -p 3000                # en otra terminal
npx tsx scripts/bateria/correr.ts                      # muestra el plan, NO gasta nada
npx tsx scripts/bateria/correr.ts --confirmo-gasto --salida bateria.json
```

Opciones: `--base` (por defecto `http://localhost:3000`), `--tope` (USD, por defecto 1),
`--solo celular,split`, `--salida archivo.json`.

- **Tope:** corta antes del paso siguiente si el gasto acumulado pasa el tope; un paso ya
  empezado termina (puede pasarse por lo que cueste ese paso). Lo que no corrió queda marcado.
- **Costo:** sale de los eventos "costo" de cada ruta (y del `fin` del chat).
- **Tabla final:** equipo, cómo lo identificó la recepción, manual y si es verificado, pasos,
  origen del 3D (manual / estimada / plantilla), bloqueos, costo y tiempo.
- Con la IA en pausa (freno de gasto, 503) también corta.
- Tests sin IA: `scripts/bateria/bateria.test.ts`.
