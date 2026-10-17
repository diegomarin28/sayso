# lib/safety

Dueño: Juanma

Tabla fija de riesgos y bloqueo. El código decide, no la IA (`riesgos.ts`).

- `evaluarPedido(texto)`: chequear lo que dice la persona **antes** de mandarlo a la IA. Si `bloqueado`, mostrar `derivacion` y no llamar a la IA.
- `filtrarCoreografia(c)`: pasar **cada** coreografía que sale de la IA antes de animarla. Si es de riesgo alto, se reemplaza por la derivación y no se anima.
- `evaluarRiesgo(texto, { riesgoPropuesto })`: la IA puede subir el riesgo, nunca bajarlo.

Clases: refrigerante, eléctrico (220 V, capacitores, fuente, cargador), batería (hinchada, abierta, perforada), gas.
