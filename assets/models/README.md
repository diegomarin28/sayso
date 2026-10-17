# assets/models

Dueño: Diego

GLB y plantillas 3D.

## Biblioteca de piezas (`blender/piezas.py` → `public/models/piezas.glb`)

Piezas genéricas de notebook modeladas **por script** en Blender: base, tapa inferior, placa madre,
ventilador (blower), disipador, heatpipe, tornillo, RAM SO-DIMM, SSD M.2, Wi-Fi M.2, pila de botón,
batería y parlante.

- Regenerar (Blender 4.2+ instalado): `npm run modelos:piezas`. Con renders de revisión:
  `blender -b --factory-startup --python assets/models/blender/piezas.py -- --salida public/models/piezas.glb --renders <carpeta>`.
- Son formas **típicas por tipo**, no de un modelo: la posición y las medidas siguen saliendo del plano.
- Un nodo por tipo; adentro, una malla por material. El nombre del material es la receta de la app
  (`cuerpo.<tipo>` o una de `RECETAS_DETALLE` en `lib/planogenerator/materiales.ts`).
- Límite: menos de 2 MB (lo controla un test). Sin texturas ni compresión Draco (no hace falta bajar decodificadores).
