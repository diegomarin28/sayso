# assets/models

Dueño: Diego

GLB y plantillas 3D.

## Biblioteca de piezas (`blender/piezas.py` → `public/models/piezas/`)

Piezas genéricas modeladas **por script** en Blender, para cualquier equipo. Un GLB por **familia** y un
`indice.json` (tipo → familia, descripción y equipos). El visor lee el índice y baja **solo las familias que usa
el plano** (una heladera no baja las piezas de notebook).

| Familia (GLB) | Tipos |
|---|---|
| `computo` | base, tapa_inferior, placa_madre, disipador, heatpipe, ram, ssd, wifi, pila, bateria, disco_duro, soporte; celular: pantalla, camara (`@modulo`: tres traseras), marco, tapa_trasera, `bateria@celular`, `placa_madre@celular` |
| `electronica` | placa (compacta en L; `@control`: placa de electrodoméstico con relés), fuente, capacitor (`@motor`: de arranque/marcha), transformador, panel (de control), parlante (`@celular`), conector (puerto; `@usb_c`, `@terminal`: ficha con cables), `pantalla@panel` (TV/monitor), retroiluminacion (TV), tira_led, unidad_laser |
| `movimiento` | ventilador (blower de notebook; `@axial`, `@tangencial`), turbina (tangencial; `@centrifuga`), motor, bomba, correa, tambor, compresor, rodillo |
| `frio_calor` | serpentin, condensador (de heladera; `@aletas`: de aire; `@electrolitico`: el capacitor), evaporador (placa roll-bond; `@aletas`), termostato, resistencia, valvula |
| `estructura` | tornillo, manguera, filtro (`@cartucho`), cable (flex; `@redondo`), bisagra (`@puerta`), puerta (`@ojo_de_buey`: lavarropas; `@impresora`), bandeja (cajón; `@goteo`, `@estante`), estante |
| `carcasas` | carcasa `@heladera`, `@split`, `@televisor`, `@lavarropas`, `@microondas`, `@impresora` (translúcidas en la app) |

La lista para la IA sale del índice: `TIPOS_DE_PIEZA` y `tiposParaPrompt()` en `lib/planogenerator/tipos.ts`.

**Variantes** (`tipo@variante`): mismo tipo y misma receta, otra forma. Todas están en cm reales y la app
elige la que menos se deforma al estirarla a las medidas del plano (`deformacion` en
`lib/planogenerator/biblioteca.ts`): una batería de 26 cm usa la de notebook y una de 6 cm la de celular.
No hace falta saber qué equipo es. Si un id no tiene tipo en la biblioteca, se usa la primitiva del plano.

**Orientación:** si el plano pone la pieza en otra posición que el modelo (un ventilador parado en vez de
acostado, una RAM más profunda que ancha), se gira de a 90° a la orientación que menos la deforma, solo si
mejora claramente.

**Para qué equipo es cada variante:** los tipos con variantes llevan en el GLB `extras.equipos` (palabras,
`EQUIPOS_*` en el script). Si el visor recibe `tipoEquipo` (texto libre de la recepción, ej. "celular Samsung")
y nombra un equipo conocido, se descartan las variantes marcadas para otro equipo; las sin marca (USB-C) sirven
para todos. Si el texto no nombra ninguno ("MacBook"), deciden las medidas.

- El tipo se elige por el **comienzo** del id (`bisagra_izquierda` → `bisagra`). A propósito no se busca la
  palabra en cualquier parte: en español el sustantivo va primero (`cable_bateria` es un cable, no una batería).
- Cada tipo nuevo necesita su receta en `materiales.ts` (lo controla un test).

- Publicar todas las familias (Blender y Node instalados): `npm run modelos:demo`. Exporta a temporales, centra, optimiza y valida antes de copiar a `public/models/piezas`. Los comandos individuales existentes conservan su compresión convencional; no sustituyen la publicación con presupuesto de 200 KiB. Para revisión de los GLB publicados, ver [calidad de la demo](blender/CALIDAD_DEMO.md).
- Son formas **típicas por tipo**, no de un modelo: la posición y las medidas siguen saliendo del plano.
- Un nodo raíz estable por tipo, pivote centrado y malla compacta. El GLB crudo usa materiales `cuerpo.<tipo>` y `RECETAS_DETALLE`. El publicado guarda sus recetas en extras y etiquetas por vértice; el cargador reconstruye las mismas partes/materiales para el visor.
- Límite final: **200 KiB por familia**, sin texturas. Meshopt se decodifica con el módulo incluido en Three.js, sin CDN. La simplificación usa error más bajo en tipos redondos y tramos; las normales se reconstruyen conservando las separaciones de aristas. Ver formato y regeneración en [CALIDAD_DEMO.md](blender/CALIDAD_DEMO.md).
- El índice conserva la caja real de cada tipo (`caja`, en cm), tomada antes del LOD y cuantización. Los tests comparan la caja cargada con esa referencia (≤0,5 %). Se restaura el tamaño original del conjunto antes y después de cuantizar.
- El cargador de main (`lib/planogenerator/cargador.ts`) y `enFloat` siguen siendo comunes: convierten los atributos antes de aplicar las matrices. Se conserva también el margen de empate de orientación/variante para que diferencias mínimas no hagan girar una pieza.
- `modelos:comprimir` sigue disponible para compresión convencional con materiales separados; saltea GLB ya comprimidos. Para publicar esta entrega con LOD, paleta y límite de 200 KiB, usar `modelos:demo`.
- **Forma y lugar, separados:** la forma (y cómo se puede ajustar) es de Blender; dónde va la pieza y cuánto
  lugar ocupa lo dice el plano. Cada tipo declara su regla en `AJUSTES` (`piezas.py`), que va al GLB
  (`extras.ajuste`) y a `indice.json`; la aplica `partesAjustadas` (`lib/planogenerator/biblioteca.ts`):
  - `libre`: se estira por eje (placas, baterías, pantallas, carcasas: cajas que sí cambian de proporción).
  - `redondo:ab`: los ejes a y b escalan igual (ventiladores, tornillos, pilas, capacitores, tambor); el tercero, libre.
  - `proporcional`: escala igual en los tres ejes y se centra (cámaras/lentes, conectores, motores, válvulas).
  - `tramo:a`: se estira solo el medio a lo largo de a y las puntas no se deforman (cables, heatpipe, manguera).
  Con una regla que no sea `libre` la pieza entra en su lugar del plano sin llenarlo en todos los ejes.
  Un tipo sin entrada usa la de su tipo base, y un alias, la de su forma. Un test controla que lo
  declarado redondo sea redondo en el modelo.
- Planos de ejemplo de heladera y aire para `/lab/visor?plano=heladera` (o `aire`), y una coreografía de heladera (ocultar puertas, girar, ir al compresor): `components/viewer/ejemplos.ts` (solo lab y tests).

## Familia independiente de dispositivos

[42 componentes de aspiradora, secador, impresora, consola, router/módem y cafetera](blender/DISPOSITIVOS.md),
con generador, GLB y renders propios. Se publica junto con el resto con `npm run modelos:demo`.

## Pequeños electrodomésticos y wearables

Familia independiente `cotidianos.glb`: 52 formas nuevas para 13 equipos, con reglas de ajuste,
52 renders individuales y 13 hojas. Reutiliza los tipos existentes por nombre.
[Generación, cobertura y galería](blender/COTIDIANOS.md).

## Equipos de facultad

Familia independiente `facultad.glb`: 42 formas faltantes, reutilizando 49 tipos existentes.
Incluye reglas de ajuste, 42 renders individuales y 15 hojas para los equipos y periféricos.
[Generación, criterios de cobertura y galería](blender/FACULTAD.md).

## Objetos del campus y revisión de calidad

[21 formas nuevas de canilla, lavatorio, cisterna, reloj de pared, iluminación, calculadora y proyector](blender/CAMPUS.md), reutilizando la biblioteca existente. La galería `/lab/campus` reúne 31 ejemplos genéricos, incluidos celulares, notebooks, MacBook y relojes. Solo funciona en desarrollo o con fixtures; las posiciones de equipos reales siguen viniendo del plano validado.

[Antes/después de las piezas esenciales, presupuesto y reproducción](blender/CALIDAD_DEMO.md).
