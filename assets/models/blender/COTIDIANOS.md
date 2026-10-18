# Familia independiente: pequeños electrodomésticos y wearables

52 formas nuevas para 13 equipos, en `public/models/piezas/cotidianos.glb` (menos de 2 MB).
IDs por tipo, nodos independientes y animables, centímetros y materiales del visor.
La lista de nuevas piezas y referencias reutilizadas está en `cotidianos-cobertura.json`;
es un inventario de cobertura para revisión y tests, no un plano de un modelo comercial.

## Regenerar

```sh
npm run modelos:cotidianos
npm run modelos:cotidianos -- --renders assets/models/blender/renders/cotidianos
npm run modelos:cotidianos -- --renders assets/models/blender/renders/cotidianos --render-piezas carcasa_auricular
```

Requiere Blender 4.2+ en PATH. No usa APIs, claves ni servicios pagos. El script reutiliza
las primitivas y el cierre de materiales existentes sin ejecutar sus generadores.
Solo escribe su GLB y sus entradas del índice; conserva familias ajenas y rechaza colisiones.
Las hojas por equipo muestran las piezas nuevas; los IDs reutilizados se enumeran debajo.
Incluye 52 renders individuales y 13 hojas. Las piezas de cada hoja se normalizan para poder
compararlas: esa vista no representa su tamaño relativo, un montaje ni un despiece real.

## Revisar los GLB finales comprimidos

Los renders de las familias nuevas se revisaron después de comprimir, usando
`decodificar.mts` para reconstruir las recetas reales del visor. No son capturas
del producto: la auditoría de cámara, etiquetas y coreografía en iPhone sigue aparte.

```sh
node --import tsx assets/models/blender/decodificar.mts public/models/piezas /tmp/sayso-revision
blender -b --factory-startup --python-exit-code 1 --python assets/models/blender/revisar_publicados.py -- --script notebook_demo.py --glb /tmp/sayso-revision/notebook_demo.glb --renders assets/models/blender/renders/notebook_demo
```

Cambiar script y GLB por la familia a revisar. Sin APIs, credenciales ni costo de IA.

## Reglas de forma y materiales

Cada pieza nueva tiene regla explícita en `AJUSTES` de `piezas.py`, exportada al índice y a
`extras.ajuste` del GLB. Ejes del GLB: X, Z y -Y de Blender. Aros conservan su sección;
fusible y columna telescópica ajustan el tramo; conectores y conjuntos asimétricos se escalan
proporcionalmente; rejillas rectangulares y membranas permiten escala libre.

`correa_reloj` es una pulsera, diferenciada de `correa` de transmisión. `pila_aa` distingue
la celda cilíndrica de `pila`, que ya es una pila de botón. `pantalla@reloj` agrega una forma
circular a las variantes de pantalla; no reemplaza las existentes. Motor, resistencia,
termostato, baterías, conectores y parlantes se reutilizan por sus nombres del índice.
Las recetas nuevas están al final de `RECETAS`, después de las de dispositivos, conservando
la prioridad de todos los prefijos existentes.

Son ilustraciones genéricas por tipo. No certifican compatibilidad, norma de clavija,
especificaciones eléctricas, circuitos funcionales ni dimensiones para fabricar repuestos.
Las piezas del microondas solo amplían la representación visual; no agregan instrucciones
de reparación ni modifican las validaciones de seguridad del producto.

## Verificar

```sh
python3 assets/models/blender/test_indice.py
npm test
npm run typecheck
npm run build
```

Los tests comprueban cobertura, reutilización, carga a demanda, tamaño y correspondencia
GLB/índice, reglas de ajuste, renders, materiales, normales y posiciones finitas y nodos
animables. La suite general verifica que las reglas redondas conserven la forma.

## Galería y cobertura

### Air fryer

![Air fryer](renders/cotidianos/hoja_air_fryer.jpg)

Nuevas:

- [canasta_freidora](renders/cotidianos/canasta_freidora.jpg) — `libre`.
- [rejilla_crujiente](renders/cotidianos/rejilla_crujiente.jpg) — `libre`.
- [interruptor_basculante](renders/cotidianos/interruptor_basculante.jpg) — `proporcional`.
- [perilla_mando](renders/cotidianos/perilla_mando.jpg) — `redondo:xz`.

Reutilizadas: `resistencia`, `termostato`, `ventilador`, `motor`, `panel`, `fuente`, `tornillo`.

### Licuadora

![Licuadora](renders/cotidianos/hoja_licuadora.jpg)

Nuevas:

- [jarra_licuadora](renders/cotidianos/jarra_licuadora.jpg) — `proporcional`.
- [tapa_jarra](renders/cotidianos/tapa_jarra.jpg) — `redondo:xz`.
- [cuchillas_licuadora](renders/cotidianos/cuchillas_licuadora.jpg) — `proporcional`.
- [acople_transmision](renders/cotidianos/acople_transmision.jpg) — `redondo:xz`.
- [junta_jarra](renders/cotidianos/junta_jarra.jpg) — `redondo:xz`.

Reutilizadas: `motor`, `selector_deslizante`, `placa@control`, `cable@redondo`, `tornillo`.

### Tostadora

![Tostadora](renders/cotidianos/hoja_tostadora.jpg)

Nuevas:

- [soporte_pan](renders/cotidianos/soporte_pan.jpg) — `proporcional`.
- [elevador_tostadora](renders/cotidianos/elevador_tostadora.jpg) — `proporcional`.
- [perilla_mando](renders/cotidianos/perilla_mando.jpg) — `redondo:xz`.

Reutilizadas: `resistencia`, `soporte_mica`, `termostato`, `bandeja@goteo`, `cable@redondo`.

### Pava eléctrica

![Pava eléctrica](renders/cotidianos/hoja_pava.jpg)

Nuevas:

- [jarra_pava](renders/cotidianos/jarra_pava.jpg) — `proporcional`.
- [base_contactos](renders/cotidianos/base_contactos.jpg) — `redondo:xz`.
- [interruptor_basculante](renders/cotidianos/interruptor_basculante.jpg) — `proporcional`.
- [tapa_pava](renders/cotidianos/tapa_pava.jpg) — `redondo:xz`.
- [filtro_pico](renders/cotidianos/filtro_pico.jpg) — `proporcional`.

Reutilizadas: `resistencia`, `termostato`, `cable@redondo`, `tornillo`.

### Microondas

![Microondas](renders/cotidianos/hoja_microondas.jpg)

Nuevas:

- [magnetron](renders/cotidianos/magnetron.jpg) — `proporcional`.
- [guia_ondas](renders/cotidianos/guia_ondas.jpg) — `proporcional`.
- [plato_microondas](renders/cotidianos/plato_microondas.jpg) — `redondo:xz`.
- [aro_rodillos](renders/cotidianos/aro_rodillos.jpg) — `redondo:xz`.
- [acople_plato](renders/cotidianos/acople_plato.jpg) — `proporcional`.
- [fusible_cartucho](renders/cotidianos/fusible_cartucho.jpg) — `tramo:x:redondo`.

Reutilizadas: `carcasa@microondas`, `capacitor`, `transformador`, `motor`, `ventilador`, `panel`, `puerta`, `soporte_mica`, `conector@terminal`.

### Plancha

![Plancha](renders/cotidianos/hoja_plancha.jpg)

Nuevas:

- [interruptor_basculante](renders/cotidianos/interruptor_basculante.jpg) — `proporcional`.
- [suela_plancha](renders/cotidianos/suela_plancha.jpg) — `proporcional`.
- [deposito_plancha](renders/cotidianos/deposito_plancha.jpg) — `proporcional`.
- [boton_pulverizador](renders/cotidianos/boton_pulverizador.jpg) — `proporcional`.
- [perilla_mando](renders/cotidianos/perilla_mando.jpg) — `redondo:xz`.

Reutilizadas: `resistencia`, `termostato`, `cable@redondo`, `tornillo`.

### Ventilador de pie

![Ventilador de pie](renders/cotidianos/hoja_ventilador_pie.jpg)

Nuevas:

- [helice_ventilador](renders/cotidianos/helice_ventilador.jpg) — `proporcional`.
- [rejilla_ventilador](renders/cotidianos/rejilla_ventilador.jpg) — `redondo:xz`.
- [pedestal_ventilador](renders/cotidianos/pedestal_ventilador.jpg) — `redondo:xz`.
- [tubo_telescopico](renders/cotidianos/tubo_telescopico.jpg) — `tramo:y:redondo`.
- [perilla_mando](renders/cotidianos/perilla_mando.jpg) — `redondo:xz`.

Reutilizadas: `motor`, `capacitor@motor`, `selector_deslizante`, `cable@redondo`, `tornillo`.

### Reloj inteligente

![Reloj inteligente](renders/cotidianos/hoja_smartwatch.jpg)

Nuevas:

- [caja_reloj](renders/cotidianos/caja_reloj.jpg) — `proporcional`.
- [correa_reloj](renders/cotidianos/correa_reloj.jpg) — `proporcional`.
- [corona_reloj](renders/cotidianos/corona_reloj.jpg) — `redondo:xz`.
- [pantalla@reloj](renders/cotidianos/pantalla@reloj.jpg) — `proporcional`.
- [tapa_reloj](renders/cotidianos/tapa_reloj.jpg) — `redondo:xz`.
- [sensor_optico](renders/cotidianos/sensor_optico.jpg) — `proporcional`.
- [bobina_carga](renders/cotidianos/bobina_carga.jpg) — `proporcional`.
- [contacto_resorte](renders/cotidianos/contacto_resorte.jpg) — `proporcional`.
- [microfono_mems](renders/cotidianos/microfono_mems.jpg) — `proporcional`.

Reutilizadas: `bateria@celular`, `placa`, `conector`, `tornillo`.

### Reloj de pulsera

![Reloj de pulsera](renders/cotidianos/hoja_reloj.jpg)

Nuevas:

- [caja_reloj](renders/cotidianos/caja_reloj.jpg) — `proporcional`.
- [correa_reloj](renders/cotidianos/correa_reloj.jpg) — `proporcional`.
- [corona_reloj](renders/cotidianos/corona_reloj.jpg) — `redondo:xz`.
- [mecanismo_reloj](renders/cotidianos/mecanismo_reloj.jpg) — `redondo:xz`.
- [agujas_reloj](renders/cotidianos/agujas_reloj.jpg) — `proporcional`.
- [esfera_reloj](renders/cotidianos/esfera_reloj.jpg) — `redondo:xz`.
- [tapa_reloj](renders/cotidianos/tapa_reloj.jpg) — `redondo:xz`.

Reutilizadas: `pila`, `tornillo`.

### Auriculares inalámbricos

![Auriculares inalámbricos](renders/cotidianos/hoja_auriculares.jpg)

Nuevas:

- [bobina_carga](renders/cotidianos/bobina_carga.jpg) — `proporcional`.
- [carcasa_auricular](renders/cotidianos/carcasa_auricular.jpg) — `proporcional`.
- [almohadilla_silicona](renders/cotidianos/almohadilla_silicona.jpg) — `redondo:xz`.
- [estuche_auriculares](renders/cotidianos/estuche_auriculares.jpg) — `proporcional`.
- [contacto_resorte](renders/cotidianos/contacto_resorte.jpg) — `proporcional`.
- [microfono_mems](renders/cotidianos/microfono_mems.jpg) — `proporcional`.
- [malla_acustica](renders/cotidianos/malla_acustica.jpg) — `libre`.

Reutilizadas: `bateria@celular`, `parlante@celular`, `placa`, `conector@usb_c`.

### Parlante Bluetooth

![Parlante Bluetooth](renders/cotidianos/hoja_parlante_bluetooth.jpg)

Nuevas:

- [microfono_mems](renders/cotidianos/microfono_mems.jpg) — `proporcional`.
- [radiador_pasivo](renders/cotidianos/radiador_pasivo.jpg) — `redondo:xz`.
- [malla_acustica](renders/cotidianos/malla_acustica.jpg) — `libre`.

Reutilizadas: `parlante`, `bateria@celular`, `placa`, `conector@usb_c`, `boton_reset`.

### Control remoto

![Control remoto](renders/cotidianos/hoja_control_remoto.jpg)

Nuevas:

- [membrana_botones](renders/cotidianos/membrana_botones.jpg) — `libre`.
- [portapilas](renders/cotidianos/portapilas.jpg) — `proporcional`.
- [pila_aa](renders/cotidianos/pila_aa.jpg) — `redondo:xz`.
- [led_infrarrojo](renders/cotidianos/led_infrarrojo.jpg) — `proporcional`.

Reutilizadas: `placa`, `tornillo`.

### Cargador de celular

![Cargador de celular](renders/cotidianos/hoja_cargador.jpg)

Nuevas:

- [fusible_cartucho](renders/cotidianos/fusible_cartucho.jpg) — `tramo:x:redondo`.
- [bobina_carga](renders/cotidianos/bobina_carga.jpg) — `proporcional`.
- [contacto_resorte](renders/cotidianos/contacto_resorte.jpg) — `proporcional`.
- [carcasa_cargador](renders/cotidianos/carcasa_cargador.jpg) — `proporcional`.
- [clavija_red](renders/cotidianos/clavija_red.jpg) — `proporcional`.
- [nucleo_ferrita](renders/cotidianos/nucleo_ferrita.jpg) — `redondo:xz`.

Reutilizadas: `fuente`, `transformador`, `capacitor`, `conector@usb_c`, `conector_usb_a`, `cable@redondo`.


## Tablet completa — #233

`tablet_demo.py` publica **tablet_demo.glb** (12 KB): `marco@tablet` hueco,
`tapa_trasera@tablet`, `pantalla@tablet` y `bateria@tablet`. Placa, cámara y tornillos
se reutilizan por nombre. Son piezas distintas, sin fusionar todo en una sola malla;
el plano puede desplazar el frente, levantar la trasera y quitar tornillos por separado.
La cara activa mira a +Y en el GLB (+Z de Blender), sin girar la tablet sobre su espalda.
El modelo cerrado tiene el frente completo y opaco; el render abierto usa esas mismas piezas.

Cobertura: `tablet-cobertura.json`, dos tamaños de 17,5 × 25 y 21,35 × 30,5 cm.
La cámara inicial, el cierre y los pasos de apertura del producto los conecta el otro
chat por #233; agregar mallas no cambia por sí solo la coreografía existente.

![Tablet completa](renders/tablet_demo/tablet_cerrada_1.jpg)
![Las mismas piezas separadas](renders/tablet_demo/tablet_abierta_1.jpg)

Publicar: `python3 assets/models/blender/publicar_familia.py assets/models/blender/tablet_demo.py`.
Renders: `blender -b --factory-startup --python assets/models/blender/tablet_demo.py -- --salida /tmp/tablet --renders assets/models/blender/renders/tablet_demo`.
Test: `npx vitest run assets/models/blender/tablet-demo.test.ts`.
