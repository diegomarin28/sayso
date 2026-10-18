import type { Receta } from "./materiales";

/** Campus: las recetas existentes mantienen su prioridad. */
export const RECETAS_CAMPUS: Array<[string, Receta]> = [
  ["mecanismo_reloj_pared", { color: "#566c7b", metalness: 0.1, roughness: 0.45 }],
  ["carcasa_reloj_pared", { color: "#7293a8", metalness: 0.1, roughness: 0.45 }],
  ["carcasa_calculadora", { color: "#66869a", metalness: 0.1, roughness: 0.45 }],
  ["teclado_calculadora", { color: "#a7bbc8", metalness: 0.05, roughness: 0.45 }],
  ["desague_lavatorio", { color: "#b5c4cd", metalness: 0.85, roughness: 0.45 }],
  ["pulsador_descarga", { color: "#b8c8d3", metalness: 0.8, roughness: 0.45 }],
  ["flotante_cisterna", { color: "#7b9eaf", metalness: 0.05, roughness: 0.45 }],
  ["difusor_luminaria", { color: "#c5d6df", metalness: 0.05, roughness: 0.45 }],
  ["carcasa_proyector", { color: "#a9bdca", metalness: 0.1, roughness: 0.45 }],
  ["cartucho_canilla", { color: "#6d95a8", metalness: 0.05, roughness: 0.45 }],
  ["aireador_canilla", { color: "#b7c5ce", metalness: 0.85, roughness: 0.45 }],
  ["valvula_descarga", { color: "#a6bac6", metalness: 0.05, roughness: 0.45 }],
  ["sifon_lavatorio", { color: "#c2cbd1", metalness: 0.05, roughness: 0.45 }],
  ["manija_canilla", { color: "#b3c3ce", metalness: 0.6, roughness: 0.4 }],
  ["valvula_cierre", { color: "#a8bac8", metalness: 0.8, roughness: 0.45 }],
  ["flexible_agua", { color: "#a5b6c2", metalness: 0.75, roughness: 0.45 }],
  ["bombilla_led", { color: "#d6ddd9", metalness: 0.05, roughness: 0.45 }],
  ["placa_pared", { color: "#c3cdd4", metalness: 0.05, roughness: 0.45 }],
  ["canilla", { color: "#b4c2cc", metalness: 0.6, roughness: 0.4 }],
];
