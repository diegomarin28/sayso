# Cierre técnico de la auditoría de celular y TV — 18/10

Base revisada: main `674c46e`. Lectura de Supabase sin IA realizada durante la auditoría. Este cierre conserva únicamente documentación; no modifica la base remota.

| Tipo | Variante | Hallazgo anterior | Estado actual | Evidencia |
|---|---|---|---|---|
| Celular | iPhone 13, caché real | Pantalla pequeña y piezas sin forma equivalente | Lectura corregida por tipo, nombres del pack conservados | Comprobación local realizada durante la auditoría, dos escalas 0,85 y 1,2; #189, #194 |
| TV | TCL 55V6C, caché real | Panel deformado, orientación y reconocimiento frontal | Proporción vertical y formas de todas las piezas pedidas verificadas al releer | Mismo test, dos escalas; #203, #225, #257 |
| Celular | Samsung y variante sin notch | Falta una captura real nueva del recorrido | Pendiente, no se generaron planos pagos | Tests existentes `seguir-plantilla.test.ts` y `despiece.test.ts` cubren variantes simuladas; no equivalen a una prueba real |
| TV | Otra marca y otro tamaño | Falta una captura real nueva del recorrido | Pendiente visual | Regresiones existentes LG 43 y Samsung 65, simuladas |
| Ambos | Etiqueta, piezas desplazadas y apertura por paso | Etiqueta saltaba y despiece salía de cuadro | Arreglos integrados en main; recorrido visual nuevo pendiente | #192 y #213; tests de escena, guía y despiece |

- [x] Leer los planos reales disponibles sin llamar a IA.
- [x] Ejecutar comprobaciones locales con dos tamaños por tipo y cambio de marca/modelo.
- [x] Confirmar que las piezas pedidas existen y tienen una forma de biblioteca al releer la caché.
- [x] Revisar cambios ya integrados; no duplicar cambios del chat dueño del visor/generador.

## Pendiente

- [ ] Capturas nuevas 390×844: cerrado, abierto y cada pieza, antes/después.
- [ ] Revisar visualmente notch, etiquetas al girar y piezas desplazadas en iPhone real.

El navegador de automatización no pudo iniciar (`native pipe startup failed`). No hay
capturas nuevas válidas en este PR; no se afirma que la auditoría visual esté terminada.
Seguimiento de integración en #188. No se modifican visor, generador ni familias GLB en este cierre.

