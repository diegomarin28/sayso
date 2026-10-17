import * as THREE from "three";

/**
 * Materiales por tipo de pieza. Pensados para verse bien sobre fondo negro.
 * Cada malla recibe su propio material (no compartido) para que el reproductor
 * pueda resaltar una pieza sin afectar a las demás.
 */

type Receta = {
  color: string;
  metalness: number;
  roughness: number;
  opacity?: number;
};

// Se busca por prefijo del id, en orden: el primero que coincide gana.
const RECETAS: Array<[prefijo: string, receta: Receta]> = [
  ["tapa_inferior", { color: "#9aa4ad", metalness: 0.2, roughness: 0.15, opacity: 0.12 }],
  ["base", { color: "#3a3f45", metalness: 0.6, roughness: 0.45 }],
  ["placa_madre", { color: "#1f5a3d", metalness: 0.1, roughness: 0.7 }],
  ["disipador", { color: "#c47a45", metalness: 0.85, roughness: 0.3 }],
  ["ventilador", { color: "#22262b", metalness: 0.2, roughness: 0.6 }],
  ["tornillo", { color: "#c9ced3", metalness: 0.9, roughness: 0.25 }],
  ["ssd", { color: "#2b2f6b", metalness: 0.3, roughness: 0.5 }],
  ["ram", { color: "#2f7a4f", metalness: 0.2, roughness: 0.55 }],
  ["bateria", { color: "#4a4f57", metalness: 0.3, roughness: 0.7 }],
  ["wifi", { color: "#6b7a8a", metalness: 0.7, roughness: 0.35 }],
  ["parlante", { color: "#2a2d31", metalness: 0.1, roughness: 0.9 }],
  ["pila", { color: "#d8dce0", metalness: 0.9, roughness: 0.2 }],
];

const RECETA_GENERICA: Receta = { color: "#7d8790", metalness: 0.4, roughness: 0.5 };

export function recetaPara(pieza: string): Receta {
  return RECETAS.find(([prefijo]) => pieza.startsWith(prefijo))?.[1] ?? RECETA_GENERICA;
}

export function materialPara(pieza: string): THREE.MeshStandardMaterial {
  const r = recetaPara(pieza);
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
