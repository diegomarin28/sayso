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
- Límite: cada GLB menos de 2 MB (lo controla un test; hoy entre 171 y 924 KB, 3 MB en total). Una variante
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
