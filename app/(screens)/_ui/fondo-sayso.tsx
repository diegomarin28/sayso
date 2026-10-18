"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo de Sayso: sobre la nebulosa (CSS de body::before) gira despacio una pieza en 3D en líneas,
 * como la vista explosionada de un manual: tapa, placa (con chips y un ventilador) y base,
 * separadas. Canvas 2D con perspectiva simple (sin WebGL: liviano en el celular).
 * - ~30 cuadros por segundo; se pausa si la pestaña no está a la vista.
 * - Con "reducir movimiento" se dibuja un cuadro quieto.
 * - Es decoración: aria-hidden y sin eventos.
 */

type P3 = [number, number, number];
type Linea = [P3, P3, number]; // desde, hasta, opacidad relativa

/** Rectángulo horizontal (a la altura y) como 4 líneas. */
function placa(ancho: number, fondo: number, y: number, alfa: number, dx = 0, dz = 0): Linea[] {
  const a = ancho / 2 + 0;
  const f = fondo / 2;
  const p: P3[] = [
    [dx - a, y, dz - f],
    [dx + a, y, dz - f],
    [dx + a, y, dz + f],
    [dx - a, y, dz + f],
  ];
  return p.map((q, i) => [q, p[(i + 1) % 4], alfa] as Linea);
}

/** Caja (8 vértices, 12 aristas). */
function caja(ancho: number, alto: number, fondo: number, y: number, alfa: number, dx = 0, dz = 0): Linea[] {
  return [...placa(ancho, fondo, y, alfa, dx, dz), ...placa(ancho, fondo, y + alto, alfa, dx, dz)].concat(
    (
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const
    ).map(([sx, sz]) => [
      [dx + (sx * ancho) / 2, y, dz + (sz * fondo) / 2],
      [dx + (sx * ancho) / 2, y + alto, dz + (sz * fondo) / 2],
      alfa,
    ]),
  );
}

/** Círculo horizontal (el ventilador). */
function aro(r: number, y: number, alfa: number, dx: number, dz: number, n = 18): Linea[] {
  const pts: P3[] = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [dx + Math.cos(t) * r, y, dz + Math.sin(t) * r];
  });
  return pts.map((q, i) => [q, pts[(i + 1) % n], alfa] as Linea);
}

/** La vista explosionada: base, placa con piezas y tapa, separadas en altura. */
const MODELO: Linea[] = [
  ...caja(3.2, 0.25, 2.2, -1.25, 0.9), // base
  ...placa(2.8, 1.8, -0.35, 0.8), // placa
  ...caja(0.7, 0.12, 0.5, -0.33, 1, -0.7, -0.3), // chip
  ...caja(0.5, 0.1, 0.9, -0.33, 1, 0.1, 0.35), // memoria
  ...aro(0.38, -0.25, 1, 0.85, -0.25), // ventilador
  ...aro(0.2, -0.25, 0.7, 0.85, -0.25, 10),
  ...caja(3.2, 0.12, 2.2, 0.75, 0.6), // tapa
];

const ESTRELLAS = Array.from({ length: 70 }, (_, i) => {
  // Pseudoaleatorio fijo: las estrellas quedan siempre en el mismo lugar.
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return { x: r(1), y: r(2), t: 0.4 + r(3) * 1.4, fase: r(4) * Math.PI * 2 };
});

export function FondoSayso() {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = lienzo.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const estilo = getComputedStyle(document.documentElement);
    const dato = estilo.getPropertyValue("--dato").trim() || "#4fd1e0";
    let ancho = 0;
    let alto = 0;

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = window.innerWidth;
      alto = window.innerHeight;
      c.width = Math.round(ancho * dpr);
      c.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const dibujar = (ms: number) => {
      ctx.clearRect(0, 0, ancho, alto);
      // estrellas
      for (const e of ESTRELLAS) {
        const brillo = quieto ? 0.5 : 0.35 + 0.35 * Math.sin(ms / 1400 + e.fase);
        ctx.fillStyle = `rgba(232, 240, 245, ${brillo * 0.55})`;
        ctx.fillRect(e.x * ancho, e.y * alto, e.t, e.t);
      }
      // pieza: gira sobre el eje vertical, un poco inclinada; abajo a la derecha, grande y tenue
      const ang = quieto ? 0.7 : ms / 9000;
      const incl = 0.5;
      const escala = Math.min(ancho, alto) * 0.17;
      const cx = ancho * 0.66;
      const cy = alto * 0.62;
      const proyectar = ([x, y, z]: P3): [number, number] => {
        const xr = x * Math.cos(ang) - z * Math.sin(ang);
        const zr = x * Math.sin(ang) + z * Math.cos(ang);
        const yr = y * Math.cos(incl) - zr * Math.sin(incl);
        const zz = y * Math.sin(incl) + zr * Math.cos(incl);
        const persp = 5 / (5 + zz);
        return [cx + xr * escala * persp, cy - yr * escala * persp];
      };
      ctx.lineWidth = 1;
      ctx.strokeStyle = dato;
      for (const [a, b, alfa] of MODELO) {
        const [x1, y1] = proyectar(a);
        const [x2, y2] = proyectar(b);
        ctx.globalAlpha = 0.16 * alfa;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    medir();
    window.addEventListener("resize", medir);
    if (quieto) {
      dibujar(0);
      return () => window.removeEventListener("resize", medir);
    }

    let raf = 0;
    let ultimo = 0;
    const cuadro = (ms: number) => {
      raf = requestAnimationFrame(cuadro);
      if (document.hidden || ms - ultimo < 33) return; // ~30 cuadros por segundo
      ultimo = ms;
      dibujar(ms);
    };
    raf = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", medir);
    };
  }, []);

  return (
    <canvas ref={lienzo} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
  );
}
