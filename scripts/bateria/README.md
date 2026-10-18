# Batería de pruebas (IA real: gasta saldo)

Recorre el flujo completo contra la app corriendo, para 9 equipos reales comunes en Uruguay
(`casos.ts`: notebook, celular, aire split, heladera, televisor, lavarropas, microondas, air fryer
y reloj inteligente): entender → ficha (la persona escribe marca y modelo) → knowledge → plano →
una pregunta normal y una **peligrosa** (lo esperado es que el experto la bloquee).

```bash
npm run build && npx next start -p 3000                # en otra terminal
npx tsx --env-file=.env.local scripts/bateria/correr.ts                      # muestra el plan, NO gasta nada
npx tsx --env-file=.env.local scripts/bateria/correr.ts --confirmo-gasto --salida bateria.json
```

Opciones: `--base` (por defecto `http://localhost:3000`), `--tope` (USD, por defecto 1),
`--solo celular,split`, `--salida archivo.json`, `--sin-comparar`.

- **Tope:** corta antes del paso siguiente si el gasto acumulado pasa el tope; un paso ya
  empezado termina (puede pasarse por lo que cueste ese paso). Lo que no corrió queda marcado.
- **Costo:** sale de los eventos "costo" de cada ruta (y del `fin` del chat).
- **Tabla final:** equipo, cómo lo identificó la recepción, manual y si es verificado, pasos,
  origen del 3D (manual / estimada / plantilla), bloqueos, costo y tiempo.
- Con la IA en pausa (freno de gasto, 503) también corta.
- **Plano 3D: Sonnet vs Haiku** (por defecto; `--sin-comparar` lo saltea): después del plano de la
  app, el script corre el plano otra vez con cada modelo (en este proceso, con la clave de
  `.env.local`, la misma entrada que `/api/plano` y sin caché) y anota costo, tiempo, origen de las
  piezas y **coincidencia de Haiku contra Sonnet** (escala 0–2 por pieza, la misma de
  `lib/planogenerator/evaluacion`). Coincidencia no es acierto: no hay posiciones de referencia
  para estos equipos. Con el manual entero no se compara (ese camino usa el modelo de lectura).
  Cuenta para el tope. El modelo de la app no cambia: `MODELO_DE.plano` en `lib/ia/claude.ts` (Sonnet).
- Tests sin IA: `scripts/bateria/bateria.test.ts`.

## Precalentar (dejar equipos en la caché antes de las pruebas)

Solo corre `/api/knowledge` y `/api/plano` (sin recepción ni chat), tope **0,50 USD**:

```bash
npx tsx scripts/bateria/correr.ts --precalentar                                   # muestra la lista, NO gasta
npx tsx scripts/bateria/correr.ts --precalentar --confirmo-gasto                  # los 9 equipos de la batería
npx tsx scripts/bateria/correr.ts --precalentar --confirmo-gasto --equipos "HP|250 G9|notebook; Samsung|Galaxy A15|celular"
npx tsx scripts/bateria/correr.ts --precalentar --confirmo-gasto --demo                                # los equipos de la demo
```

- Formato de `--equipos`: `Marca|Modelo|tipo de equipo`, separados por `;`. La clase sale del tipo (notebook, split, lavarropas u otro).
- Qué queda guardado: el **manual** (búsqueda y vistas) y el **plano 3D** por marca + modelo; el **pack** por marca + modelo + síntoma (se precalienta con un síntoma general: con otro síntoma se vuelve a armar, pero desde el manual ya guardado, que es lo barato).
- La tabla dice si cada equipo **ya estaba** en la caché (no gastó).

## Ver los equipos de la demo en el celular, sin IA

Arma "Mis casos" con lo que ya quedó en la caché de Supabase (el último pack de cada equipo y su plano,
terminado con el código actual igual que lo devuelve `/api/plano`). No llama a la IA ni a la app.

```bash
npx tsx --env-file=.env.local scripts/bateria/correr.ts --mis-casos --demo --salida mis-casos.json
```

Después, en el navegador (o el celular) con la app abierta: cargá el JSON en
`localStorage["sayso:mis-casos:v1"]` y abrí "Mis casos". Cada equipo abre directo en la pantalla del experto.
Si un equipo no tiene pack o plano guardado, la lista lo dice (hay que precalentarlo antes, con OK de gasto).

**Desde el celular, sin consola:** con la app levantada en modo fixture (`npm run build && npx next start -H 0.0.0.0`,
con `NEXT_PUBLIC_DATOS=fixture` en `.env.local`), abrí `http://<IP de la Mac>:3000/lab/demo` en el iPhone (misma red)
y tocá «Cargar … equipos en Mis casos». El chat responde simulado: no gasta IA.

## Seguridad sin IA

```bash
npx tsx scripts/bateria/correr.ts --seguridad      # no hace falta la app, no gasta nada
```

Pasa por el filtro del código (`evaluarPedido`, `lib/safety`) los pedidos peligrosos del guion
(`docs/demo-y-pruebas.md`) y los de la batería (tienen que bloquearse) y preguntas normales de
reparación (no tienen que bloquearse de más). Las peligrosas que no frena el código dependen de que
la IA las marque: van como hallazgo para la tabla de riesgos (A9 en `docs/hallazgos-prueba-real-1.md`).
`seguridad.test.ts` cuida que ninguna pregunta normal se bloquee de más.
