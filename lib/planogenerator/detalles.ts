import * as THREE from "three";
import type { PiezaPlano } from "../../shared";
import { RECETAS_DETALLE, materialDeReceta } from "./materiales";

/**
 * Detalles visuales por tipo de pieza (aspas del ventilador, chips de la RAM,
 * etiquetas…). Son mallas hijas de la malla principal: se mueven con la pieza y
 * no cambian sus medidas. No son piezas: no tienen nodo propio ni se animan solas.
 */

export const SUFIJO_DETALLE = "__detalle";

type Detallador = (malla: THREE.Mesh, dim: PiezaPlano["dim"]) => void;

const DETALLES: Array<[prefijo: string, detallar: Detallador]> = [
  ["ventilador", detallarVentilador],
  ["tornillo", detallarTornillo],
  ["ram", detallarRam],
  ["ssd", detallarSsd],
  ["bateria", detallarBateria],
];

export function agregarDetalles(pieza: string, malla: THREE.Mesh, dim: PiezaPlano["dim"]): void {
  DETALLES.find(([prefijo]) => pieza.startsWith(prefijo))?.[1](malla, dim);
}

function agregar(malla: THREE.Mesh, geo: THREE.BufferGeometry, receta: keyof typeof RECETAS_DETALLE) {
  const d = new THREE.Mesh(geo, materialDeReceta(RECETAS_DETALLE[receta]));
  d.name = `${malla.name}${SUFIJO_DETALLE}_${malla.children.length}`;
  malla.add(d);
  return d;
}

/** Carcasa abierta (mismas medidas), con piso, aspas inclinadas y cubo central. */
function detallarVentilador(malla: THREE.Mesh, [ancho, alto, prof]: PiezaPlano["dim"]) {
  const r = ancho / 2;
  const escalaZ = prof / ancho;
  malla.geometry.dispose();
  malla.geometry = new THREE.CylinderGeometry(r, r, alto, 48, 1, true).scale(1, 1, escalaZ);
  (malla.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

  const piso = agregar(malla, new THREE.CylinderGeometry(r, r, alto * 0.08, 48).scale(1, 1, escalaZ), "cubo");
  piso.position.y = -alto / 2 + alto * 0.04;

  const cubo = agregar(malla, new THREE.CylinderGeometry(r * 0.28, r * 0.28, alto * 0.7, 32), "cubo");
  cubo.position.y = -alto * 0.05;

  const ASPAS = 11;
  const largo = r * 0.66;
  for (let i = 0; i < ASPAS; i++) {
    const aspa = agregar(malla, new THREE.BoxGeometry(largo, alto * 0.05, r * 0.22), "aspas");
    const ang = (i / ASPAS) * Math.PI * 2;
    const dist = r * 0.28 + largo / 2;
    aspa.position.set(Math.cos(ang) * dist, -alto * 0.05, Math.sin(ang) * dist * escalaZ);
    aspa.rotation.set(0, -ang, 0);
    aspa.rotateX(0.5); // paso de hélice: gira sobre su eje largo
  }
}

/** Cabeza de tornillo con ranura en cruz. */
function detallarTornillo(malla: THREE.Mesh, [ancho, alto]: PiezaPlano["dim"]) {
  for (const giro of [0, Math.PI / 2]) {
    const ranura = agregar(malla, new THREE.BoxGeometry(ancho * 0.7, alto * 0.12, ancho * 0.14), "ranura");
    ranura.position.y = alto / 2;
    ranura.rotation.y = giro;
  }
}

/** Fila de chips de memoria sobre el módulo. */
function detallarRam(malla: THREE.Mesh, [ancho, alto, prof]: PiezaPlano["dim"]) {
  const CHIPS = 4;
  const w = (ancho * 0.8) / CHIPS;
  for (let i = 0; i < CHIPS; i++) {
    const chip = agregar(malla, new THREE.BoxGeometry(w * 0.8, alto * 0.4, prof * 0.55), "chip");
    chip.position.set(-ancho * 0.4 + w * (i + 0.5), alto / 2 + alto * 0.2, -prof * 0.05);
  }
}

/** Etiqueta del SSD. */
function detallarSsd(malla: THREE.Mesh, [ancho, alto, prof]: PiezaPlano["dim"]) {
  const et = agregar(malla, new THREE.BoxGeometry(ancho * 0.6, alto * 0.1, prof * 0.7), "etiqueta");
  et.position.set(ancho * 0.1, alto / 2 + alto * 0.05, 0);
}

/** Etiqueta de advertencia y división de celdas de la batería. */
function detallarBateria(malla: THREE.Mesh, [ancho, alto, prof]: PiezaPlano["dim"]) {
  const et = agregar(malla, new THREE.BoxGeometry(ancho * 0.3, alto * 0.04, prof * 0.5), "etiqueta");
  et.position.set(-ancho * 0.25, alto / 2 + alto * 0.02, 0);
  for (const x of [-0.17, 0.17]) {
    const surco = agregar(malla, new THREE.BoxGeometry(ancho * 0.008, alto * 0.04, prof * 0.85), "chip");
    surco.position.set(ancho * x, alto / 2 + alto * 0.02, 0);
  }
}
