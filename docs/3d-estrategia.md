# Estrategia 3D — "lo mejor que exista, y si no existe lo creamos"

Dueño: Diego (carril B). Lee primero `CONTEXT.md`.

## Qué encontramos en internet (y qué no)

- **Modelos descargables con piezas separables de interiores de notebook:** casi no hay. Hay carcasas completas y modelos sueltos (ventiladores, placas) en Sketchfab, GrabCAD y 3D CAD Browser; cada uno con su licencia. Sirven como **referencia o piezas sueltas**, no como notebook completo.
- **Generación desde imágenes (hospedadas):** Meshy, Tripo, Rodin, 3D AI Studio, Hunyuan3D aceptan una o varias vistas y devuelven GLB, pero **una malla fusionada**.
- **Abiertas:** TRELLIS.2 (MIT, GPU), Pixal3D (MIT, multivista), PartCrafter (MIT, varias partes de una imagen, flojo con piezas apretadas), Hunyuan3D-Part (segmenta una malla en partes; licencia excluye UE, Reino Unido y Corea del Sur). Los datos de fechas y capacidades vienen de páginas agregadoras: **verificar en la fuente antes de apostar horas**.
- **Segmentar y nombrar:** Rodin Bang y Hunyuan3D-Part separan; los **nombres** no están garantizados.

Conclusión: no hay una solución lista que dé "notebook con piezas nombradas y animables". Hay que fabricarla, y se puede.

## Lo que creamos nosotros

### Idea 1 — Generador 3D a partir del manual (la apuesta, y es IA indispensable)
La IA **lee la vista explosionada y la lista de piezas del manual** del modelo exacto y devuelve un **plano de piezas** (JSON validado):

```json
{ "pieza": "ventilador", "forma": "cilindro", "dim": [0.45, 0.08, 0.45],
  "pos": [0.62, 0.05, 0.10], "padre": "base", "pivote": [0, 0, 0],
  "etiqueta_manual": "7", "cita": {"pagina": 54} }
```
El navegador construye la escena con three.js desde ese plano (cajas, cilindros, extrusiones simples), con nodos nombrados y pivotes. Ventajas:
- Funciona para **cualquier equipo con manual** (cumple "cualquier dispositivo").
- Cada pieza trae **su cita** del manual.
- Es **animable** de verdad.
- Es 3D **generado por la IA en tiempo de ejecución**, no un dibujo fijo.

### Idea 2 — Bucle "generar, mirar, corregir"
Se renderiza la escena, se toma una captura, Claude la compara con el diagrama del manual y corrige el plano (posiciones, proporciones) una o dos veces. Es la parte "agéntica" visible. Hay que medir cuánto mejora; si no mejora, se quita.

### Idea 3 — Plantillas de alta calidad hechas con Claude + Blender
Con **Blender MCP** (MIT; Claude ejecuta Python en Blender, exporta a GLB, trae modelos de Sketchfab/Poly Haven, puede usar Rodin/Hunyuan para generar) Claude construye **plantillas pulidas** por clase: notebook, split de aire, lavarropas. Piezas nombradas, pivotes, materiales buenos. El runtime las usa cuando existe plantilla y cae a la Idea 1 cuando no.
- Es una herramienta de **desarrollo**: no cuenta como IA del producto, pero sube mucho la calidad visible.
- Cuidado: `execute_blender_code` ejecuta código arbitrario. Usar `BLENDER_MCP_SAFE_MODE=1`, guardar antes, servidor solo en localhost.

### Idea 4 — Carcasa realista desde las fotos del usuario
Una API multivista (Meshy, Tripo, 3D AI Studio) genera la **carcasa exterior** con la textura real del equipo. Se muestra transparente o translúcida y sobre ella las piezas internas (Idea 1/3). Da el efecto de "es mi equipo". Se mide antes de adoptar (3 equipos reales).

### Idea 5 — Segmentar y nombrar (si sobra tiempo)
Malla de Idea 4 → Hunyuan3D-Part o Rodin Bang → Claude **nombra las partes** viendo renders de cada una contra la lista de piezas del manual. Es lo más frágil; solo para experimentar.

## Escalera de decisión (qué se usa y cuándo)

| Escalón | Qué es | Cuándo se adopta |
|---|---|---|
| 0 | Diagrama del manual con piezas resaltadas | siempre disponible, red de seguridad |
| 1 | Plantilla notebook básica (Blender MCP o three.js directo) | MVP, hora 6 |
| 2 | Generador desde el manual (Idea 1) | si en 3 equipos las posiciones coinciden con el diagrama |
| 3 | Bucle de corrección (Idea 2) | si mejora la coincidencia medible |
| 4 | Carcasa desde fotos (Idea 4) | si se ve bien y tarda menos de ~2 min o corre en segundo plano |
| 5 | Segmentación automática (Idea 5) | solo experimental |

## Medidas de calidad del 3D (para decidir con datos)
- Coincidencia de posiciones de 10 piezas contra el diagrama del manual (a ojo, escala 0–2 por pieza).
- Tiempo de generación y costo en créditos.
- Rendimiento en celular medio: 30 fps, GLB menor a ~5 MB.
- Animaciones sin atravesar piezas ni salir de cuadro.

## Herramientas a buscar aparte (lo que hay que tener a mano)
- **Blender** + `blender-mcp` (`uvx blender-mcp`).
- **three.js / React Three Fiber / drei**; `gltf-transform` para optimizar GLB; `gltfjsx` para convertir GLB a componentes.
- **Sketchfab** (licencias CC), **Poly Haven** (CC0), **Poly Pizza**.
- Cuenta de **API de imagen-a-3D multivista** (Meshy o Tripo con créditos gratis; verificar que el plan gratis tenga API).
- Opcional con GPU: **TRELLIS.2** (MIT).
- Para leer diagramas de manual: PDFs en imagen a Claude; recortar la figura con `pdftoppm`/PyMuPDF.
