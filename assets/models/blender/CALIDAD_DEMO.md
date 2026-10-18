# Calidad de las piezas de la demo

Se revisaron 37 formas esenciales de notebook/MacBook, celular, TV, heladera, split, lavarropas y relojes. Se mejoraron 13 formas existentes (más el alias turbina que comparte geometría): ventilador blower, baterías de notebook/celular/celdas adheridas, placa madre, placa compacta, cámara simple y triple, pantalla, panel de TV, tangencial, compresor y tambor. Se conservaron también las mejoras de placa madre y tangencial que se fusionaron en main durante este trabajo; la comparación histórica las incluye. Los demás tipos conservan su diseño y se vuelven a publicar optimizados.

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

- `computo.glb`: 121,212 bytes.
- `electronica.glb`: 108,892 bytes.
- `movimiento.glb`: 156,092 bytes.
- `frio_calor.glb`: 70,548 bytes.
- `estructura.glb`: 49,904 bytes.
- `carcasas.glb`: 29,640 bytes.
- `dispositivos.glb`: 165,516 bytes.
- `cotidianos.glb`: 202,360 bytes.
- `facultad.glb`: 159,996 bytes.
- `campus.glb`: 103,580 bytes.

El archivo final usa `EXT_meshopt_compression` y cuantización de posiciones. El decodificador es el módulo incluido en Three.js, sin CDN. No hay texturas. Se omiten normales serializadas y se reconstruyen sobre los vértices con las aristas separadas que dejó la exportación. Los tipos `redondo` y `tramo` usan un error geométrico más conservador (0,004 del radio) y no llegan al mismo recorte que los demás. En el resto hay simplificación con error acotado, más fuerte en las familias grandes cotidianos/facultad; caja de reloj, pantalla circular, sensor y bobina usan un error específico bajo (0,005). Se restaura la caja real antes y después de cuantizar (ajustando la matriz de decodificación) y se registra en el índice para controlar medidas. La revisión incluye relojes para controlar esa reducción.

Cada tipo mantiene su nodo raíz, nombre, extras de equipo/AJUSTES y pivote centrado. Para reducir el coste de muchas primitivas, el GLB publicado guarda una malla compacta y una paleta: `scene.extras.paletaRecetas`, códigos en `tipo.extras.recetas` y el índice local de receta en el byte alfa de `COLOR_0`. El material del GLB es opaco: ese alfa es una etiqueta, no transparencia. El cargador valida que los tres vértices del triángulo pertenezcan a una receta y reconstruye partes con materiales de la app. Para Blender o intercambio con materiales completos, usar el decodificador de revisión. Los GLB crudos conservan materiales convencionales.

## Reproducción

1. `npm ci`; Blender instalado y Node en PATH (también acepta `BLENDER_BIN`).
2. `npm run modelos:demo`: exporta los cinco scripts a temporales, optimiza, verifica todas las familias y publica GLB/índice conservando entradas existentes. Los comandos individuales existentes conservan la compresión convencional de main; usar este flujo completo para asegurar 200 KiB.
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

![Reloj inteligente](renders/calidad/visor-smartwatch.png)

## Celular: las piezas de la guía (después de la prueba real)

En la prueba real del iPhone las capas no se leían: la pantalla se veía como una placa negra igual a las demás, y el puerto de carga y el parlante eran manchas. Por tipo (sirven para cualquier celular, y la pantalla también para tablet y cámara):

- **Pantalla:** vista desde adentro, como se la ve con el celular abierto por atrás. El vidrio va abajo, y arriba quedan la chapa metálica, la lámina de grafito y el flex de cobre que sale por el borde y termina en su conector.
- **Parlante:** módulo con rejilla ranurada, boca de salida, contactos de resorte y orejas para atornillar.
- **Puerto de carga (USB-C y Lightning):** con su tramo de flex hacia adentro, para que se lea como "el puerto de carga" aunque se vea chico. El esqueleto del celular y el de la tablet le dan su lugar real (1,5 × 1,78 cm, con la boca en el borde de abajo).
- **Batería, placa, cámaras, tornillo, bandeja SIM, marco y tapa:** sin cambios; ya se leían bien.

Antes (GLB publicados por #164) y después, mismo estudio:

![Antes](renders/calidad/celular-guia-antes.jpg)

![Después](renders/calidad/celular-guia-despues.jpg)

En el visor, tamaño iPhone: abierto (antes y después) y despiezado (antes y después):

![Visor](renders/calidad/celular-guia-visor.jpg)

## Televisor de frente

El TV va parado y de frente a la cámara (B1), así que cerrado se ve el frente de la carcasa, y el frente era una chapa gris: en la prueba real no se reconocía como un TV. Ahora la zona de la pantalla es vidrio oscuro, con el marco y el logo del borde de abajo. Sirve para cualquier TV, con las mismas medidas de antes (no cambia cómo se ajusta). `carcasas.glb`: 29 KiB.

Antes y después (mismo estudio):

![Carcasa del TV, antes y después](renders/calidad/tv-frente-antes-despues.jpg)

En el visor, tamaño iPhone, cerrado: el TV TCL de la caché (generado) y el TV del lab (esqueleto). El vigía de "3D en negro" no lo toma como falla:

![TV en el visor](renders/calidad/tv-frente-visor.jpg)
