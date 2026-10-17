import * as THREE from "three";
import { RECETAS_FACULTAD } from "./materiales-facultad";
import { RECETAS_COTIDIANOS } from "./materiales-cotidianos";
import { RECETAS_DISPOSITIVOS } from "./materiales-dispositivos";

/**
 * Materiales por tipo de pieza, estilo "ilustración técnica": carcasa de aluminio,
 * placa verde, cobre en disipador y heatpipe. Pensados para luz de estudio sobre fondo negro.
 * Cada malla recibe su propio material (no compartido) para que el visor pueda
 * resaltar o volver translúcida una pieza sin afectar a las demás.
 */

export type Receta = {
  color: string;
  metalness: number;
  roughness: number;
  opacity?: number;
};

// Se busca por prefijo del id, en orden: el primero que coincide gana.
const RECETAS: Array<[prefijo: string, receta: Receta]> = [
  ["tapa_inferior", { color: "#c3c9cf", metalness: 0.9, roughness: 0.3, opacity: 0.18 }],
  ["base", { color: "#aeb5bc", metalness: 0.95, roughness: 0.38 }],
  ["placa_madre", { color: "#1d6b45", metalness: 0.15, roughness: 0.55 }],
  ["disipador", { color: "#c8773f", metalness: 0.65, roughness: 0.32 }],
  ["heatpipe", { color: "#d08550", metalness: 0.65, roughness: 0.3 }],
  ["ventilador", { color: "#2c3036", metalness: 0.3, roughness: 0.55 }],
  ["tornillo", { color: "#d5d9dd", metalness: 0.6, roughness: 0.3 }],
  ["ssd", { color: "#1b2a4a", metalness: 0.2, roughness: 0.5 }],
  ["ram", { color: "#1f7a4d", metalness: 0.15, roughness: 0.55 }],
  ["bateria", { color: "#33373d", metalness: 0.25, roughness: 0.7 }],
  ["wifi", { color: "#b9c0c6", metalness: 0.7, roughness: 0.32 }],
  ["parlante", { color: "#25282c", metalness: 0.1, roughness: 0.9 }],
  ["pila", { color: "#e1e4e7", metalness: 0.6, roughness: 0.25 }],
  ["disco_duro", { color: "#b9c0c6", metalness: 0.8, roughness: 0.35 }],
  ["cable", { color: "#2f3338", metalness: 0.1, roughness: 0.6 }],
  ["bisagra", { color: "#8f979f", metalness: 0.85, roughness: 0.35 }],
  ["conector", { color: "#c6ccd2", metalness: 0.85, roughness: 0.3 }],
  ["soporte", { color: "#b0b7be", metalness: 0.85, roughness: 0.35 }],
  // Celular (y piezas parecidas de notebook). `placa` va después de `placa_madre`: placa_carga, placa_usb…
  ["pantalla", { color: "#10141b", metalness: 0.3, roughness: 0.25 }],
  ["placa", { color: "#173f35", metalness: 0.15, roughness: 0.5 }],
  ["camara", { color: "#2a2e34", metalness: 0.6, roughness: 0.35 }],
  ["marco", { color: "#9aa2ab", metalness: 0.9, roughness: 0.35 }],
  // Como la tapa inferior: translúcida, para ver lo que hay debajo.
  ["tapa_trasera", { color: "#2b3440", metalness: 0.4, roughness: 0.2, opacity: 0.22 }],
  // Electrodomésticos.
  ["fuente", { color: "#2a4a3e", metalness: 0.15, roughness: 0.5 }],
  ["capacitor", { color: "#24406e", metalness: 0.2, roughness: 0.45 }],
  ["transformador", { color: "#5b6168", metalness: 0.7, roughness: 0.45 }],
  ["panel", { color: "#d9dcdf", metalness: 0.05, roughness: 0.45 }],
  ["motor", { color: "#3b4249", metalness: 0.6, roughness: 0.45 }],
  ["bomba", { color: "#4a4f55", metalness: 0.1, roughness: 0.55 }],
  ["correa", { color: "#202224", metalness: 0, roughness: 0.85 }],
  ["tambor", { color: "#c9ced3", metalness: 0.85, roughness: 0.3 }],
  ["compresor", { color: "#1f2a24", metalness: 0.4, roughness: 0.45 }],
  ["serpentin", { color: "#c4ccd2", metalness: 0.8, roughness: 0.35 }],
  ["condensador", { color: "#1b1d20", metalness: 0.4, roughness: 0.5 }],
  ["termostato", { color: "#d4d0c4", metalness: 0.05, roughness: 0.5 }],
  ["resistencia", { color: "#7e8389", metalness: 0.7, roughness: 0.45 }],
  ["valvula", { color: "#e3e5e7", metalness: 0.05, roughness: 0.45 }],
  ["manguera", { color: "#6a6f74", metalness: 0, roughness: 0.8 }],
  ["filtro", { color: "#cfd4d8", metalness: 0.05, roughness: 0.5 }],
  ["puerta", { color: "#e8eaec", metalness: 0.2, roughness: 0.4 }],
  // Carcasa del electrodoméstico: translúcida, como la tapa inferior, para ver lo de adentro.
  ["carcasa", { color: "#dfe3e7", metalness: 0.3, roughness: 0.4, opacity: 0.16 }],
  ["evaporador", { color: "#c9d0d6", metalness: 0.8, roughness: 0.35 }],
  ["turbina", { color: "#d9dcdf", metalness: 0.1, roughness: 0.5 }],
  ["retroiluminacion", { color: "#e9ecef", metalness: 0.1, roughness: 0.4 }],
  ["tira_led", { color: "#f2f2ee", metalness: 0, roughness: 0.5 }],
  // Plástico transparente de cajones y estantes: deja ver lo que hay detrás.
  ["bandeja", { color: "#cfe3ea", metalness: 0.1, roughness: 0.25, opacity: 0.55 }],
  ["estante", { color: "#cfe3ea", metalness: 0.1, roughness: 0.25, opacity: 0.55 }],
  ...RECETAS_DISPOSITIVOS,
  ...RECETAS_COTIDIANOS,
  ...RECETAS_FACULTAD,
];

const RECETA_GENERICA: Receta = { color: "#8a949e", metalness: 0.5, roughness: 0.45 };

/** Materiales de los detalles (aspas, chips, etiquetas…), que no son piezas del plano. */
export const RECETAS_DETALLE = {
  aspas: { color: "#3b4048", metalness: 0.2, roughness: 0.5 },
  cubo: { color: "#1c1f23", metalness: 0.3, roughness: 0.4 },
  chip: { color: "#141619", metalness: 0.3, roughness: 0.45 },
  etiqueta: { color: "#d9dde1", metalness: 0, roughness: 0.8 },
  ranura: { color: "#4a4f56", metalness: 0.9, roughness: 0.3 },
  // Partes de la biblioteca de Blender (public/models/piezas).
  cobre: { color: "#c87a45", metalness: 0.75, roughness: 0.3 },
  contactos: { color: "#d6a843", metalness: 0.9, roughness: 0.28 },
  metal: { color: "#b8bec5", metalness: 0.85, roughness: 0.3 },
  pcb: { color: "#1d6b45", metalness: 0.15, roughness: 0.55 },
  goma: { color: "#141517", metalness: 0, roughness: 0.9 },
  plastico: { color: "#1b1d20", metalness: 0.1, roughness: 0.6 },
  conector: { color: "#e6e2d6", metalness: 0, roughness: 0.6 },
  vidrio: { color: "#07090d", metalness: 0.4, roughness: 0.06 },
} satisfies Record<string, Receta>;

export function recetaPara(pieza: string): Receta {
  return RECETAS.find(([prefijo]) => pieza.startsWith(prefijo))?.[1] ?? RECETA_GENERICA;
}

export function materialDeReceta(r: Receta): THREE.MeshStandardMaterial {
  const transparente = r.opacity !== undefined;
  return new THREE.MeshStandardMaterial({
    color: r.color,
    metalness: r.metalness,
    roughness: r.roughness,
    transparent: transparente,
    opacity: r.opacity ?? 1,
    depthWrite: !transparente,
  });
}

export function materialPara(pieza: string): THREE.MeshStandardMaterial {
  return materialDeReceta(recetaPara(pieza));
}

/**
 * Material de una parte de la biblioteca: el cuerpo lleva la receta de la pieza; el resto, su
 * receta de detalle. Las partes de una pieza translúcida (la tapa) acompañan su transparencia.
 */
export function materialDeParte(pieza: string, receta: string): THREE.MeshStandardMaterial {
  const propia = recetaPara(pieza);
  const detalle = (RECETAS_DETALLE as Record<string, Receta>)[receta];
  if (receta === "cuerpo" || !detalle) return materialDeReceta(propia);
  return materialDeReceta(propia.opacity === undefined ? detalle : { ...detalle, opacity: Math.min(1, propia.opacity * 2) });
}
