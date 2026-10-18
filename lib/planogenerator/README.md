# lib/planogenerator

Dueño: Diego

Construye la escena 3D (three.js) a partir de un `PlanoDePiezas` (`shared/`).
La misma función sirve para la plantilla fija (MVP) y para el plano que genera la IA desde el manual (B4).

```ts
import { construirEscena, planoNotebookBase } from "@/lib/planogenerator";
const { raiz, nodos, avisos } = construirEscena(planoNotebookBase);
```

## Convención de coordenadas (unidades: cm)

- x a la derecha, y hacia arriba, z hacia el frente (donde está la persona).
- `pos`: **centro** de la pieza en coordenadas del **mundo** (no relativo al padre).
- `pivote`: punto de giro, **relativo al centro** de la pieza.
- `padre`: solo jerarquía. Si el padre se mueve, el hijo lo acompaña.
- `dim`: ancho (x), alto (y), profundidad (z). En `cilindro`, el eje es y.

## Estructura de la escena

- `raiz` (`Group` "plano") → un `Group` por pieza, con `name` = id de la pieza, ubicado en su pivote. Ese es el nodo que anima el reproductor.
- Dentro de cada nodo, una `Mesh` llamada `<id>__malla` y los nodos de las piezas hijas.
- `userData` del nodo: `{ pieza, dim, centro, etiquetaManual, cita }`.
- El plano se tolera con errores: ids repetidos, padres que no existen o ciclos se resuelven colgando de la raíz y quedan en `avisos`.

## Biblioteca de piezas (formas de Blender) — `biblioteca.ts`

`construirEscena(plano, { biblioteca })`: si el id de una pieza empieza con un tipo de la biblioteca
(prefijo más largo: `tornillos_ventilador` → `tornillo`), usa esa forma en vez de la primitiva:

- Se centra y se estira a `dim` (todas las partes juntas miden `dim`). Si el plano la pone girada respecto
  del modelo (ej. RAM más profunda que ancha), se gira 90° antes de estirar.
- La malla principal (`<id>__malla`) es el cuerpo; las demás partes son detalles (`<id>__malla__detalle_N`).
- Sin biblioteca o con un tipo desconocido: primitiva de `forma` + detalles en código (`detalles.ts`), como antes.
- El GLB sale de `assets/models/blender/piezas.py` (ver `assets/models/README.md`). El visor lo carga una vez
  (`components/viewer/biblioteca.ts`) y si falla o tarda más de 4 s sigue con primitivas.

## Plantillas

- `plantillas/notebook.ts`: notebook genérica, esquemática, vista desde abajo con la tapa inferior translúcida (se abre como bisagra desde el borde trasero).

## Generador desde el manual (B4) — `generador.ts`, `obtener.ts`, `cache.ts`

`POST /api/plano { casoId, knowledgePack, ficha?, manualFileId?, manualUrl?, paginasVistaExplosionada?, paginaVistaInterior?, imagenes?, paginas? }`
→ `{ plano, origen: "ia" | "plantilla", desdeCache, paginasLeidas, avisos, eventos }`

- **Flujo en la pantalla 4:** `/api/knowledge` devuelve `manualFileId`, `manualUrl`, `paginasVistaExplosionada` y `paginaVistaInterior`; se pasan tal cual a `/api/plano` junto con el pack y la ficha. Después, el mismo `plano` va al `<Visor>` y a `/api/chat` (el chat solo usa ids de ese plano).
- **Solo las páginas que hacen falta** (`recorte.ts`): si hay vista interior y `manualUrl`, el código baja el manual y arma con `pdf-lib` un PDF chico con la vista interior y la vista explosionada (máx. `MAX_PAGINAS_RECORTE`). La IA lee eso en vez del manual entero: unas pocas páginas en lugar de cientos. Si la IA cita el número de hoja del recorte, se traduce a la página del manual. Si no hay vista interior, la descarga falla o el PDF está cifrado, lee el manual entero como antes. `paginasLeidas` dice qué pasó (null = manual entero o caché).
- **La IA interpreta:** identifica las piezas con la vista explosionada y las ubica con la vista interior (con el manual entero, busca ella misma las ilustraciones del interior). Propone zona, capa, tamaño relativo, n.º del diagrama y página. Modelo `MODELOS.vision`, salida validada con Zod (un reintento).
- **El código calcula** (`planoDesdePropuesta`, pura y testeada): medidas en cm, alturas por capas, padres, límites, choques (lugar libre más cercano por confianza), tapa inferior. Descarta ids fuera del pack y completa con la plantilla; todo queda en `avisos`. Citas de posición: `NO_VERIFICABLE`.
- **Caché** (`cache.ts`, tabla `planos`, migración `lib/supabase/migraciones/004_planos.sql`): un plano por marca + modelo (misma clave que la tabla `manuales`). Se reusa si al generarlo ya se pidieron todas las piezas del pack actual. La plantilla genérica nunca se guarda. Sin Supabase, caché en memoria.
- **Manual entero en caché:** cuando no hay recorte, el pedido arranca igual que las lecturas del bibliotecario (`leerManual` de `lib/knowledge/lector.ts`: mismo system, effort y documento, con el título de `knowledgePack.fuentes`) y la tarea va después. Así el manual sale de la caché de prompts que dejó `/api/knowledge` (~US$ 0,03 en vez de ~US$ 0,50). Como el documento va con citas, el JSON se pide como texto y se valida con Zod.
- **Medidas de la carcasa** (`medidas.ts`): la IA las lee del manual o las estima para ese modelo (`medidas_fuente`). El código exige números finitos y positivos dentro de los límites de la clase (`LIMITES_MEDIDA_CM`: un celular de 7,4 cm es válido, una notebook de 7,4 cm no). La que falta se estima con la proporción o la medida típica de la clase y queda **"estimada"** en `plano.medidas`. La carcasa de notebook solo es respaldo de notebooks.
- **Origen de cada ubicación** (`PiezaPlano.origen`): `manual` = la IA la vio en una página (con confianza alta o media; lleva `cita` con documento y página), `estimada` = sin página o con confianza baja, `plantilla` = posición genérica. La carcasa vale lo que valen sus medidas. El visor lo muestra en cada etiqueta y con un resumen (`components/viewer/origen.ts`): un plano mixto nunca aparece como verificado entero. Planos sin `origen` (viejos o fixtures) = "sin verificar".
- **Si la IA falla** → `origen: "plantilla"`: la pantalla tiene que mostrar "esquema genérico, no es tu modelo exacto".
  - **Plantilla por tipo de equipo** (`plantillas/por-tipo.ts`, planos en `plantillas/equipos.ts`): notebook, celular,
    heladera, aire, televisor, lavarropas, microondas, aspiradora, secador, impresora, consola, router y cafetera, y lo
    que alguien trae en la mano: tablet, auriculares, reloj inteligente, mouse, teclado, joystick, parlante bluetooth,
    cargador, control remoto, batería externa, cámara de acción, afeitadora, planchita y cepillo eléctrico. Por nombre gana la que más palabras comparte (las `pistas`, marcas o contexto, valen
    medio: "Galaxy Tab" es tablet, "control de la tele" es control remoto); si empatan, la nombrada primero
    ("cargador de celular" es un cargador). Sin el nombre del aparato ni un esqueleto parecido (un pendrive, una linterna) no adivina.
  - **Completar lo que la IA no ubicó**: con la plantilla del tipo (`propuestaDePlantillaDeTipo`: por id o por tipo de
    pieza; en un equipo parado, la cara), no con la de notebook. Así un TV con una sola pieza ubicada no queda vacío.
  - **Lo que nadie ubicó igual va al 3D** (`sueltas.ts`, `terminarPlano`): una pieza del pack que ni la IA ni la plantilla
    ubican se suma con las medidas de su forma en la biblioteca (la variante del equipo, achicada parejo para que entre;
    sin forma, una caja chica) en el hueco más libre del equipo, colgando de la raíz y con origen "plantilla". Al generar
    y al leer de la caché: la guía nunca resalta algo que el 3D no tiene.
  - **Reglas por tipo de equipo** (`seguir-plantilla.ts`, nunca por modelo; se aplican al generar y al leer de la caché):
    lo que no viene de una página del manual, y lo que falta, sigue al esqueleto del tipo (lugar y tamaño escalados a
    la carcasa); la `cara` del tipo (la pantalla de un TV, las puertas de una heladera) está siempre; ninguna pieza
    estimada mide más de 2,5 veces su forma (`acotarMedidas`). Al parar un plano viejo se estiran los lugares, no las
    piezas. Tests con dos variantes por tipo que no son las de la demo (`seguir-plantilla.test.ts`). Se
    elige por el `tipoEquipo` de la recepción (opcional en `/api/plano`), si no por la clase del pack, si no por sus
    piezas (solo las que distinguen un equipo, ej. compresor + puerta de freezer → heladera). Del plano de la
    plantilla quedan la raíz y, para cada pieza del pack, la de igual id o del mismo tipo (con el id del pack);
    todas con origen `plantilla`. Sin señal suficiente: la caja genérica de siempre (`planoDesdePlantilla`).
  - Nunca se guarda en la caché (solo se guarda `origen: "ia"`): la próxima vez se vuelve a probar con la IA.
- Medición (3 manuales de prueba, escala 0–2): leyendo el PDF completo 65 % (1 corrida por manual); con imágenes recortadas 60 % (58–62, 3 corridas); plantilla sin IA 27 %. **Decisión (Diego):** se usa el recorte aunque pierda hasta 5 puntos de coincidencia; el costo importa más.
- Ahorro del recorte: `npx tsx --env-file=.env.local lib/planogenerator/evaluacion/medir-recorte.ts` (tokens del manual entero vs. recorte con un manual de la caché, y una corrida real con el recorte).
- Evaluación contra manuales reales (casos locales, fuera del repo): ver `evaluacion/README.md`.
