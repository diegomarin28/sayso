import * as THREE from "three";

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
];

const RECETA_GENERICA: Receta = { color: "#8a949e", metalness: 0.5, roughness: 0.45 };

/** Materiales de los detalles (aspas, chips, etiquetas…), que no son piezas del plano. */
export const RECETAS_DETALLE = {
  aspas: { color: "#3b4048", metalness: 0.2, roughness: 0.5 },
  cubo: { color: "#1c1f23", metalness: 0.3, roughness: 0.4 },
  chip: { color: "#141619", metalness: 0.3, roughness: 0.45 },
  etiqueta: { color: "#d9dde1", metalness: 0, roughness: 0.8 },
  ranura: { color: "#4a4f56", metalness: 0.9, roughness: 0.3 },
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
