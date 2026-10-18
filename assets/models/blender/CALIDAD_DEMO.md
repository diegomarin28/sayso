# Calidad de las piezas de la demo

Se revisaron 37 formas esenciales de notebook/MacBook, celular, TV, heladera, split, lavarropas y relojes. Se mejoraron 13 formas existentes (más el alias turbina que comparte geometría): ventilador blower, baterías de notebook/celular/celdas adheridas, placa madre, placa compacta, cámara simple y triple, pantalla, panel de TV, tangencial, compresor y tambor. Los demás tipos conservan su diseño y se vuelven a publicar optimizados.

Los cambios añaden álabes curvos, pestañas y marcas abstractas de celdas, encapsulados y blindajes, óptica oscura, rejilla de auricular, fijaciones traseras de panel, nervios y tornillos del compresor, borde y perforaciones ilustrativas del tambor. No se inventan marcas, capacidades, conexiones funcionales ni compatibilidades.

## Antes y después

El antes sale de los GLB de main `3054272` (PR #73); el después sale de los **GLB optimizados publicados**, decodificados con las recetas del visor. Mismo estudio, proyección y encuadre por tipo. La referencia de IDs y tamaños anteriores está en [calidad-referencia.json](calidad-referencia.json).

### Notebook y MacBook

Antes:

![Antes Notebook y MacBook](renders/calidad/antes/hoja_notebook.jpg)

Después:

![Después Notebook y MacBook](renders/calidad/despues/hoja_notebook.jpg)

### Celular

Antes:

![Antes Celular](renders/calidad/antes/hoja_celular.jpg)

Después:

![Después Celular](renders/calidad/despues/hoja_celular.jpg)

### Televisor

Antes:

![Antes Televisor](renders/calidad/antes/hoja_televisor.jpg)

Después:

![Después Televisor](renders/calidad/despues/hoja_televisor.jpg)

### Heladera

Antes:

![Antes Heladera](renders/calidad/antes/hoja_heladera.jpg)

Después:

![Después Heladera](renders/calidad/despues/hoja_heladera.jpg)

### Aire split

Antes:

![Antes Aire split](renders/calidad/antes/hoja_aire.jpg)

Después:

![Después Aire split](renders/calidad/despues/hoja_aire.jpg)

### Lavarropas

Antes:

![Antes Lavarropas](renders/calidad/antes/hoja_lavarropas.jpg)

Después:

![Después Lavarropas](renders/calidad/despues/hoja_lavarropas.jpg)

### Relojes

Antes:

![Antes Relojes](renders/calidad/antes/hoja_relojes.jpg)

Después:

![Después Relojes](renders/calidad/despues/hoja_relojes.jpg)

Panel de TV visto por detrás (fijaciones y conectores):

![Panel antes](renders/calidad/antes/pantalla@panel_dorso.jpg)
![Panel después](renders/calidad/despues/pantalla@panel_dorso.jpg)

Las hojas reúnen también piezas que no necesitaron rediseño. Hay un JPG individual por cada forma revisada. Las perforaciones pequeñas son detalles visuales, no especificaciones para fabricar.

## Peso final y formato

Máximo permitido: **204.800 bytes (200 KiB) por familia**, controlado al publicar y en tests. Tamaños de esta entrega:

- `computo.glb`: 125,144 bytes.
- `electronica.glb`: 100,460 bytes.
- `movimiento.glb`: 153,312 bytes.
- `frio_calor.glb`: 72,012 bytes.
- `estructura.glb`: 60,548 bytes.
- `carcasas.glb`: 25,832 bytes.
- `dispositivos.glb`: 168,664 bytes.
- `cotidianos.glb`: 203,672 bytes.
- `facultad.glb`: 162,068 bytes.
- `campus.glb`: 103,968 bytes.

El archivo final usa `EXT_meshopt_compression` y cuantización de posiciones. El decodificador es el módulo incluido en Three.js, sin CDN. No hay texturas. Se omiten normales serializadas y se reconstruyen sobre los vértices con las aristas separadas que dejó la exportación. Los tipos `redondo` y `tramo` no se simplifican; en los demás hay simplificación con error acotado, más fuerte en las familias grandes cotidianos/facultad. La revisión incluye relojes para controlar esa reducción.

Cada tipo mantiene su nodo raíz, nombre, extras de equipo/AJUSTES y pivote centrado. Para reducir el coste de muchas primitivas, el GLB publicado guarda una malla compacta y una paleta: `scene.extras.paletaRecetas`, códigos en `tipo.extras.recetas` y el índice local de receta en el byte alfa de `COLOR_0`. El material del GLB es opaco: ese alfa es una etiqueta, no transparencia. El cargador valida que los tres vértices del triángulo pertenezcan a una receta y reconstruye partes con materiales de la app. Para Blender o intercambio con materiales completos, usar el decodificador de revisión. Los GLB crudos conservan materiales convencionales.

## Reproducción

1. `npm ci`; Blender instalado y Node en PATH (también acepta `BLENDER_BIN`).
2. `npm run modelos:demo`: exporta los cinco scripts a temporales, optimiza, verifica todas las familias y publica GLB/índice conservando entradas existentes. Los comandos individuales `modelos:*` son exportaciones crudas para edición; no usarlos como publicación final.
3. `npm run modelos:decodificar -- public/models/piezas /tmp/sayso-revision`.
4. `blender -b --factory-startup --python assets/models/blender/calidad_demo.py -- --modelos /tmp/sayso-revision --renders assets/models/blender/renders/calidad/despues`.
5. Mismo comando con `--campus` y destino `renders/campus` para las 21 formas nuevas.
6. `npm test`, `npm run typecheck`, `npm run build`; `python3 -m unittest assets/models/blender/test_indice.py`.

El antes se genera con el mismo renderizador sobre los GLB extraídos de `3054272`. No publicar esos GLB antiguos encima de los finales.

## Visor en navegador

Galería de prueba `/lab/campus`, con `NEXT_PUBLIC_DATOS=fixture`. Se comprobó carga, materiales, giro y despiece en MacBook Air, canilla, celular y reloj de pared. Los esquemas se etiquetan como genéricos con ubicaciones sin verificar. La selección de un equipo real sigue dependiendo de modelo, fotos y documentación; este ensayo no ejecutó ni consumió API de IA.

![MacBook Air](renders/calidad/visor-macbook-air.png)
![Canilla](renders/calidad/visor-canilla.png)
![Celular](renders/calidad/visor-celular.png)
![Reloj de pared](renders/calidad/visor-reloj-pared.png)
