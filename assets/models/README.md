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
| `electronica` | placa (compacta en L; `@control`: placa de electrodoméstico con relés), fuente, capacitor (`@motor`: de arranque/marcha), transformador, panel (de control), parlante (`@celular`), conector (puerto; `@usb_c`, `@terminal`: ficha con cables), `pantalla@panel` (TV/monitor), retroiluminacion (TV), tira_led |
| `movimiento` | ventilador (blower de notebook; `@axial`, `@tangencial`), turbina (tangencial; `@centrifuga`), motor, bomba, correa, tambor, compresor |
| `frio_calor` | serpentin, condensador (de heladera; `@aletas`: de aire; `@electrolitico`: el capacitor), evaporador (placa roll-bond; `@aletas`), termostato, resistencia, valvula |
| `estructura` | tornillo, manguera, filtro (`@cartucho`), cable (flex; `@redondo`), bisagra (`@puerta`), puerta (`@ojo_de_buey`: lavarropas), bandeja (cajón; `@goteo`, `@estante`), estante |
| `carcasas` | carcasa `@heladera`, `@split`, `@televisor`, `@lavarropas`, `@microondas` (translúcidas en la app) |

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

- Regenerar (Blender 4.2+ instalado): `npm run modelos:piezas`. Con renders de revisión (uno por pieza y una
  hoja por familia): `blender -b --factory-startup --python assets/models/blender/piezas.py -- --salida public/models/piezas --renders <carpeta>`.
- Son formas **típicas por tipo**, no de un modelo: la posición y las medidas siguen saliendo del plano.
- Un nodo por tipo; adentro, una malla por material. El nombre del material es la receta de la app
  (`cuerpo.<tipo>` o una de `RECETAS_DETALLE` en `lib/planogenerator/materiales.ts`).
- Límite: cada GLB comprimido pesa menos de 1 MB (lo controla un test; hoy 2,4 MB en total, eran 6,6 MB sin comprimir).
  Una variante idéntica a otro tipo comparte mallas (`ALIAS`).

## Compresión (meshopt)

Cada `npm run modelos:*` termina con `npm run modelos:comprimir` (`assets/models/comprimir.mjs`):
cuantiza las posiciones (16 bits) y comprime con EXT_meshopt_compression. Three lo decodifica solo
(`lib/planogenerator/cargador.ts`), sin archivos aparte. Saltea los GLB ya comprimidos.

- Antes de comprimir guarda en `indice.json` la caja real de cada tipo (`caja`, en cm). Un test compara la
  caja del GLB comprimido con esa (≤ 0,5 %): así no cambian el tamaño, la variante elegida ni los AJUSTES.
- `bibliotecaDesdeEscena` pasa las geometrías a Float32 antes de aplicarles la escala del nodo (si no, three
  las recorta a [-1, 1] y la pieza se deforma).
- Empates: diferencias de costo menores al 1 % no cambian la orientación ni la variante (`EMPATE` en
  `biblioteca.ts`): una pieza simétrica no se da vuelta por el 0,2 % que deja la compresión.
- Para comparar dos versiones (ej. antes y después de comprimir o de rehacer piezas):
  `npx tsx assets/models/comparar.ts <carpeta-antes> public/models/piezas` (caja, centro, recetas, equipos,
  AJUSTES, el ajuste a 11 medidas con los tramos de cables y lentes, y 13.552 elecciones de variante).
  idéntica a otro tipo comparte mallas (`ALIAS`). Sin texturas ni compresión Draco (no hace falta bajar decodificadores).
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
con generador, GLB y renders propios. Se regenera con `npm run modelos:dispositivos`.

## Pequeños electrodomésticos y wearables

Familia independiente `cotidianos.glb`: 52 formas nuevas para 13 equipos, con reglas de ajuste,
52 renders individuales y 13 hojas. Reutiliza los tipos existentes por nombre.
[Generación, cobertura y galería](blender/COTIDIANOS.md).

## Equipos de facultad

Familia independiente `facultad.glb`: 42 formas faltantes, reutilizando 49 tipos existentes.
Incluye reglas de ajuste, 42 renders individuales y 15 hojas para los equipos y periféricos.
[Generación, criterios de cobertura y galería](blender/FACULTAD.md).
