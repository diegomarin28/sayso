# lib/compras

Dueño: Iaio (desde el 21/10/2026). La escribió Diego (tarea A6, tomada del carril A para liberar el cupo de Juanma).

Dónde comprar un repuesto. Ruta: `POST /api/compras { pieza, numeroParte, modelo, marca?, casoId? }` → `{ opciones, cotizacion, descartados, costo, eventos }` (tarda ~20–60 s).

1. `agente.ts`: agente con Haiku y las herramientas `web_search` y `web_fetch` de la API (versiones básicas: las de filtrado dinámico no corren en Haiku). Busca primero en Mercado Libre Uruguay con el número de parte (FRU) del knowledge pack, después en la web, y lee los avisos. Propone candidatos con precio, envío y la cotización del dólar si hace falta.
2. `verificar.ts`: **el código decide**, no el modelo.
   - Se descarta la URL que no salió de una búsqueda o lectura real (inventada), las repetidas y las que dicen que no envían a Uruguay.
   - Compatibilidad: `numero_parte` o `modelo` si aparecen en el título o en el texto del aviso; si no, `no_verificado`.
   - Precio y envío `confirmado` solo si el número aparece en la página leída; si no, `probable`. Envío sin dato = `desconocido`.
   - La cotización solo vale si el número aparece en la página que la IA citó. Sin cotización, lo que está en dólares queda sin total en pesos.
   - Orden: primero lo compatible, después el total más barato (precio + envío en pesos). Se devuelven las 3 mejores.
3. `costo.ts`: el costo total de cada búsqueda (tokens + búsquedas web, con los precios de `lib/ia/claude.ts`) va en la respuesta y en el log (`[compras] …`). Cada llamada además queda en el log `[costo]` y, con `casoId`, en el evento de costo del feed.

Nunca compra ni paga: `<OpcionesCompra>` (en `components/compras`) solo abre la publicación.

Configuración (límites del agente): `config.ts`. Modelo y precios: `lib/ia/claude.ts`.

Prueba real: `npx tsx --env-file=.env.local lib/compras/probar.ts "ventilador" "5F10S13875" "ThinkPad E14 Gen 2" "Lenovo"` (~0,04 USD: cada pedido queda debajo de los 100K tokens de la tarifa larga de Haiku; ver `config.ts`).

## Para la pantalla 6 (Iaio)

```tsx
import { OpcionesCompra } from "@/components/compras";

<OpcionesCompra key={repuesto.pieza} casoId={caso.id} pieza={repuesto.pieza} numeroParte={repuesto.numeroParte}
  modelo={ficha.modelo.valor} marca={ficha.marca.valor} onEvento={agregarAlFeed} />
```

Los repuestos con número de parte salen de `pack.repuestos`. Por defecto espera el toque en "Ver dónde comprar esta pieza"; `buscarAlMontar` busca solo. Para otra pieza, cambiar la `key`.
