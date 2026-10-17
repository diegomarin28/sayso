# assets/models

Dueño: Diego

GLB y plantillas 3D.

## Biblioteca de piezas (`blender/piezas.py` → `public/models/piezas.glb`)

Piezas genéricas modeladas **por script** en Blender.

- Notebook: base, tapa inferior, placa madre, ventilador (blower), disipador, heatpipe, tornillo, RAM SO-DIMM,
  SSD M.2, Wi-Fi M.2, pila de botón, batería, parlante, disco duro 2,5", cable flex, bisagra, conector (puerto) y soporte.
- Celular: pantalla, placa (compacta, en L, con blindajes), cámara (una lente) y `camara@modulo` (tres traseras),
  marco (chasis con placa media), tapa trasera (translúcida en la app, con la isla de cámaras y la bobina de carga), y variantes `bateria@celular`, `placa_madre@celular`, `parlante@celular`
  y `conector@usb_c` (conector de carga).

**Variantes** (`tipo@variante`): mismo tipo y misma receta, otra forma. Todas están en cm reales y la app
elige la que menos se deforma al estirarla a las medidas del plano (`deformacion` en
`lib/planogenerator/biblioteca.ts`): una batería de 26 cm usa la de notebook y una de 6 cm la de celular.
No hace falta saber qué equipo es. Si un id no tiene tipo en la biblioteca, se usa la primitiva del plano.

**Para qué equipo es cada variante:** los tipos con variantes llevan en el GLB `extras.equipos` (palabras,
`EQUIPOS_*` en el script). Si el visor recibe `tipoEquipo` (texto libre de la recepción, ej. "celular Samsung")
y nombra un equipo conocido, se descartan las variantes marcadas para otro equipo; las sin marca (USB-C) sirven
para todos. Si el texto no nombra ninguno ("MacBook"), deciden las medidas.

- El tipo se elige por el **comienzo** del id (`bisagra_izquierda` → `bisagra`). A propósito no se busca la
  palabra en cualquier parte: en español el sustantivo va primero (`cable_bateria` es un cable, no una batería).
- Cada tipo nuevo necesita su receta en `materiales.ts` (lo controla un test).

- Regenerar (Blender 4.2+ instalado): `npm run modelos:piezas`. Con renders de revisión:
  `blender -b --factory-startup --python assets/models/blender/piezas.py -- --salida public/models/piezas.glb --renders <carpeta>`.
- Son formas **típicas por tipo**, no de un modelo: la posición y las medidas siguen saliendo del plano.
- Un nodo por tipo; adentro, una malla por material. El nombre del material es la receta de la app
  (`cuerpo.<tipo>` o una de `RECETAS_DETALLE` en `lib/planogenerator/materiales.ts`).
- Límite: menos de 2 MB (lo controla un test; hoy ~1,2 MB). Una variante idéntica a otro tipo comparte mallas (`alias`). Sin texturas ni compresión Draco (no hace falta bajar decodificadores).
