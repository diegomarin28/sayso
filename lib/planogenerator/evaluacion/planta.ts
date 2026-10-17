/**
 * Geometría para comparar posiciones contra un dibujo en perspectiva: la carcasa se
 * marca con sus 4 esquinas (atrás-izq, atrás-der, frente-der, frente-izq) y se
 * interpola bilinealmente. Planta normalizada: x, z de -1 a 1 (z = 1 frente).
 */
export type Punto = [number, number];
export type Esquinas = Record<"BL" | "BR" | "FR" | "FL", Punto>;

/** Interpolación bilineal de las 4 esquinas: (x, z) de -1 a 1 → píxel. */
export function aPixel([x, z]: Punto, e: Esquinas): Punto {
  const [u, v] = [(x + 1) / 2, (z + 1) / 2];
  return [0, 1].map(
    (i) => (1 - u) * (1 - v) * e.BL[i] + u * (1 - v) * e.BR[i] + (1 - u) * v * e.FL[i] + u * v * e.FR[i],
  ) as Punto;
}

/** Inversa de la interpolación bilineal de las 4 esquinas → (x, z) de -1 a 1. */
export function aPlanta(p: Punto, e: Esquinas): Punto {
  const en = (u: number, v: number): Punto => [0, 1].map(
    (i) => (1 - u) * (1 - v) * e.BL[i] + u * (1 - v) * e.BR[i] + (1 - u) * v * e.FL[i] + u * v * e.FR[i],
  ) as Punto;
  let [u, v] = [0.5, 0.5];
  for (let k = 0; k < 50; k++) {
    // Newton con jacobiano numérico.
    const h = 1e-4;
    const f = en(u, v);
    const fu = en(u + h, v);
    const fv = en(u, v + h);
    const J = [[(fu[0] - f[0]) / h, (fv[0] - f[0]) / h], [(fu[1] - f[1]) / h, (fv[1] - f[1]) / h]];
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    const r = [p[0] - f[0], p[1] - f[1]];
    u += (J[1][1] * r[0] - J[0][1] * r[1]) / det;
    v += (J[0][0] * r[1] - J[1][0] * r[0]) / det;
  }
  return [2 * u - 1, 2 * v - 1];
}
