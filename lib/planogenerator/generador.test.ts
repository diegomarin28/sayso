import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { KnowledgePack, PlanoDePiezas, knowledgePackEjemplo } from "../../shared";
import type { LlamarIA, PedidoIA } from "../ia/claude";
import { SUFIJO_MALLA, construirEscena } from "./construir";
import {
  generarPlano,
  paginaDelManual,
  planoDesdePlantilla,
  planoDesdePropuesta,
  type PiezaPropuesta,
  type PropuestaPlano,
} from "./generador";

const kp = knowledgePackEjemplo;
const kpConTapa: KnowledgePack = {
  ...kp,
  piezas: [...kp.piezas, { id: "tapa_inferior", nombre: "Tapa inferior", descripcion: "", ubicacion: "abajo de todo" }],
};

const pieza = (p: Partial<PiezaPropuesta> & { pieza: string }): PiezaPropuesta => ({
  x: 0,
  z: 0,
  ancho: 0.1,
  prof: 0.1,
  alto_cm: 0.3,
  capa: "sobre_placa",
  sobre: null,
  forma: "caja",
  etiquetaManual: null,
  pagina: null,
  confianza: "alta",
  ...p,
});

/** Propuesta razonable para el knowledge pack del fixture. */
const propuestaBuena: PropuestaPlano = {
  base_ancho_cm: 35,
  base_prof_cm: 24,
  piezas: [
    pieza({ pieza: "placa_madre", capa: "placa", x: 0, z: -0.35, ancho: 0.9, prof: 0.55, pagina: 54 }),
    pieza({ pieza: "disipador", x: 0.1, z: -0.45, ancho: 0.12, prof: 0.15, etiquetaManual: "6", pagina: 54 }),
    pieza({ pieza: "ventilador", x: 0.6, z: -0.55, ancho: 0.17, prof: 0.25, alto_cm: 0.9, forma: "cilindro", etiquetaManual: "7", pagina: 54 }),
    pieza({ pieza: "tornillos_ventilador", capa: "sobre_pieza", sobre: "ventilador", x: 0.7, z: -0.7, ancho: 0.02, prof: 0.02 }),
    pieza({ pieza: "ssd", x: -0.6, z: -0.1, ancho: 0.22, prof: 0.09, alto_cm: 0.25 }),
    pieza({ pieza: "ram", x: -0.3, z: -0.5, ancho: 0.19, prof: 0.12 }),
    pieza({ pieza: "wifi", x: -0.8, z: -0.65, ancho: 0.06, prof: 0.12, alto_cm: 0.2 }),
    pieza({ pieza: "bateria", capa: "sobre_base", x: 0, z: 0.55, ancho: 0.72, prof: 0.3, alto_cm: 0.8, forma: "extrusion" }),
  ],
};

function choques(plano: PlanoDePiezas): string[] {
  const { raiz, nodos } = construirEscena(plano);
  raiz.updateMatrixWorld(true);
  const cajas = [...nodos.entries()].map(([id, n]) => {
    const malla = n.getObjectByName(id + SUFIJO_MALLA) as THREE.Mesh;
    malla.geometry.computeBoundingBox();
    const caja = malla.geometry.boundingBox!.clone().applyMatrix4(malla.matrixWorld).expandByScalar(-0.001);
    return [id, caja] as const;
  });
  const res: string[] = [];
  for (let i = 0; i < cajas.length; i++)
    for (let j = i + 1; j < cajas.length; j++)
      if (cajas[i][1].intersectsBox(cajas[j][1])) res.push(`${cajas[i][0]} × ${cajas[j][0]}`);
  return res;
}

const ids = (plano: PlanoDePiezas) => plano.piezas.map((p) => p.pieza).sort();
const de = (plano: PlanoDePiezas, id: string) => plano.piezas.find((p) => p.pieza === id)!;

describe("planoDesdePropuesta (el código calcula)", () => {
  it("una propuesta buena da un plano válido, con las piezas del knowledge pack y sin choques", () => {
    const { plano, avisos } = planoDesdePropuesta(kp, propuestaBuena);
    expect(() => PlanoDePiezas.parse(plano)).not.toThrow();
    expect(ids(plano)).toEqual(kp.piezas.map((p) => p.id).sort());
    expect(choques(plano)).toEqual([]);
    expect(avisos).toEqual([]);
    expect(de(plano, "base").dim).toEqual([35, 1.2, 24]);
  });

  it("apila por capas: placa sobre la base, componentes sobre la placa, tornillos sobre el ventilador", () => {
    const { plano } = planoDesdePropuesta(kp, propuestaBuena);
    const techo = (id: string) => de(plano, id).pos[1] + de(plano, id).dim[1] / 2;
    const piso = (id: string) => de(plano, id).pos[1] - de(plano, id).dim[1] / 2;
    expect(piso("placa_madre")).toBeCloseTo(techo("base"));
    expect(piso("ram")).toBeCloseTo(techo("placa_madre"));
    expect(piso("bateria")).toBeCloseTo(techo("base"));
    expect(piso("tornillos_ventilador")).toBeCloseTo(techo("ventilador"));
    expect(de(plano, "tornillos_ventilador").padre).toBe("ventilador");
    expect(de(plano, "ram").padre).toBe("placa_madre");
  });

  it("descarta piezas inventadas y repetidas, y lo avisa", () => {
    const { plano, avisos } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      piezas: [...propuestaBuena.piezas, pieza({ pieza: "condensador_de_flujo" }), pieza({ pieza: "ram", x: 0.9 })],
    });
    expect(ids(plano)).not.toContain("condensador_de_flujo");
    expect(plano.piezas.filter((p) => p.pieza === "ram")).toHaveLength(1);
    expect(avisos.join(" ")).toMatch(/condensador_de_flujo.*descartó/);
    expect(avisos.join(" ")).toMatch(/ram.*dos veces/);
  });

  it("completa con la plantilla las piezas que la IA no ubicó", () => {
    const { plano, avisos } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      piezas: propuestaBuena.piezas.filter((p) => p.pieza !== "wifi"),
    });
    expect(ids(plano)).toContain("wifi");
    expect(avisos.join(" ")).toMatch(/wifi.*plantilla/);
  });

  it("recorta valores absurdos: todo queda dentro de la base", () => {
    const { plano } = planoDesdePropuesta(kp, {
      base_ancho_cm: 500,
      base_prof_cm: null,
      piezas: [
        pieza({ pieza: "placa_madre", capa: "placa", ancho: 0.9, prof: 0.5 }),
        pieza({ pieza: "ssd", x: 9, z: -9, ancho: 3, prof: 0.1, alto_cm: 40 }),
      ],
    });
    const [W, , D] = de(plano, "base").dim;
    expect(W).toBe(36); // 500 cm fuera de rango → plantilla
    for (const p of plano.piezas) {
      expect(Math.abs(p.pos[0]) + p.dim[0] / 2).toBeLessThanOrEqual(W / 2 + 1e-6);
      expect(Math.abs(p.pos[2]) + p.dim[2] / 2).toBeLessThanOrEqual(D / 2 + 1e-6);
    }
    expect(de(plano, "ssd").dim[1]).toBeLessThanOrEqual(3);
  });

  it("si dos piezas caen en el mismo lugar, mueve la menos confiable hasta que no se toquen", () => {
    const { plano } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      piezas: propuestaBuena.piezas.map((p) =>
        p.pieza === "ssd" ? { ...p, x: -0.3, z: -0.5, confianza: "baja" as const } : p,
      ),
    });
    expect(choques(plano)).toEqual([]);
    expect(de(plano, "ram").pos[0]).toBeCloseTo(-0.3 * 17.5); // la confiable no se movió
  });

  it("caso T480: si correr la pieza la lleva lejos, achica la grande que la tapa (la batería queda donde la puso la IA)", () => {
    // Medidas reales que dio la IA para un ThinkPad T480: batería atrás, pisando ~0,7 cm la placa.
    const kpT480: KnowledgePack = { ...kp, piezas: kp.piezas.filter((p) => ["base", "placa_madre", "bateria", "ventilador", "tornillos_ventilador"].includes(p.id)) };
    const { plano, avisos } = planoDesdePropuesta(kpT480, {
      base_ancho_cm: null,
      base_prof_cm: null,
      piezas: [
        pieza({ pieza: "placa_madre", capa: "placa", x: 0, z: -0.1, ancho: 0.85, prof: 0.65 }),
        pieza({ pieza: "bateria", capa: "sobre_base", x: 0, z: -0.85, ancho: 0.7, prof: 0.15, alto_cm: 1, forma: "extrusion" }),
        pieza({ pieza: "ventilador", x: 0.45, z: 0.3, ancho: 0.18, prof: 0.25, alto_cm: 0.6, forma: "cilindro" }),
        pieza({ pieza: "tornillos_ventilador", capa: "sobre_pieza", sobre: "ventilador", x: 0.27, z: 0.05, ancho: 0.04, prof: 0.04 }),
      ],
    });
    const [W, , D] = de(plano, "base").dim;
    const bateria = de(plano, "bateria");
    const placa = de(plano, "placa_madre");
    // La batería no viaja: queda a menos de 1 cm de donde la ubicó la IA (antes se iba 19,5 cm al frente).
    expect(Math.abs(bateria.pos[2] - (-0.85 * D) / 2)).toBeLessThan(1);
    // La placa se achicó solo lo necesario, del lado de la batería.
    expect(placa.dim[2]).toBeLessThan(0.65 * D);
    expect(placa.dim[2]).toBeGreaterThan(0.6 * 0.65 * D);
    expect(placa.pos[2] + placa.dim[2] / 2).toBeCloseTo(-0.1 * (D / 2) + (0.65 * D) / 2, 3); // el borde de adelante no se mueve
    expect(avisos.join(" ")).toMatch(/achicó "placa_madre".*"bateria"/);
    // Sin choques, todo dentro de la base y el ventilador sigue sobre la placa.
    expect(choques(plano)).toEqual([]);
    for (const p of plano.piezas) {
      expect(Math.abs(p.pos[0]) + p.dim[0] / 2).toBeLessThanOrEqual(W / 2 + 1e-6);
      expect(Math.abs(p.pos[2]) + p.dim[2] / 2).toBeLessThanOrEqual(D / 2 + 1e-6);
    }
    const v = de(plano, "ventilador");
    expect(Math.abs(v.pos[2] - placa.pos[2]) + v.dim[2] / 2).toBeLessThanOrEqual(placa.dim[2] / 2 + 1e-6);
  });

  it("si achicar la dejaría muy chica (menos del 60 %), corre la pieza como antes", () => {
    const { plano, avisos } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      // La batería pisa ~7 cm de los 13,2 de la placa: achicarla le sacaría más del 40 %.
      piezas: propuestaBuena.piezas.map((p) => (p.pieza === "bateria" ? { ...p, z: 0, prof: 0.38 } : p)),
    });
    expect(de(plano, "bateria").pos[2]).toBeGreaterThan(6.9); // se corrió hacia adelante, fuera de la placa
    expect(avisos.join(" ")).not.toMatch(/achicó/);
    expect(de(plano, "placa_madre").dim[2]).toBeCloseTo(0.55 * 24, 3);
    expect(choques(plano)).toEqual([]);
  });

  it("lo que apoya sobre otra pieza queda dentro de su planta (no flota)", () => {
    const { plano } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      piezas: propuestaBuena.piezas.map((p) => (p.pieza === "tornillos_ventilador" ? { ...p, x: -0.9, z: 0.9 } : p)),
    });
    const v = de(plano, "ventilador");
    const t = de(plano, "tornillos_ventilador");
    expect(Math.abs(t.pos[0] - v.pos[0])).toBeLessThanOrEqual(v.dim[0] / 2 + 1e-6);
    expect(Math.abs(t.pos[2] - v.pos[2])).toBeLessThanOrEqual(v.dim[2] / 2 + 1e-6);
  });

  it("si el ventilador se mueve por un choque, sus tornillos lo acompañan", () => {
    const { plano } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      piezas: propuestaBuena.piezas.map((p) =>
        p.pieza === "ventilador" ? { ...p, x: 0.1, z: -0.45, confianza: "baja" as const } : p,
      ),
    });
    const v = de(plano, "ventilador");
    const t = de(plano, "tornillos_ventilador");
    expect(Math.hypot(t.pos[0] - v.pos[0], t.pos[2] - v.pos[2])).toBeLessThan(v.dim[0]);
  });

  it("cita la página como NO_VERIFICABLE y usa el número del diagrama", () => {
    const { plano } = planoDesdePropuesta(kp, propuestaBuena);
    expect(de(plano, "ventilador").cita).toEqual({ doc: kp.fuentes[0].doc, pagina: 54, estado: "NO_VERIFICABLE" });
    expect(de(plano, "ventilador").etiquetaManual).toBe("7");
    // si la IA no da número, se usa el del knowledge pack
    expect(de(plano, "ssd").etiquetaManual).toBe("4");
  });

  it("agrega la tapa inferior encima de todo si está en el knowledge pack", () => {
    const { plano } = planoDesdePropuesta(kpConTapa, propuestaBuena);
    const tapa = de(plano, "tapa_inferior");
    const masAlto = Math.max(...plano.piezas.filter((p) => p !== tapa).map((p) => p.pos[1] + p.dim[1] / 2));
    expect(tapa.pos[1] - tapa.dim[1] / 2).toBeGreaterThan(masAlto);
    expect(tapa.pivote[2]).toBeLessThan(0);
  });
});

describe("planoDesdePlantilla", () => {
  it("sin IA: la plantilla con solo las piezas del knowledge pack, sin choques", () => {
    const { plano } = planoDesdePlantilla(kp);
    expect(ids(plano)).toEqual(kp.piezas.map((p) => p.id).sort());
    expect(choques(plano)).toEqual([]);
  });
});

describe("generarPlano (con la IA simulada)", () => {
  const respuesta = (texto: string): LlamarIA => async () => texto;

  it("arma el pedido con la lista de piezas y las imágenes del manual", async () => {
    let pedido: PedidoIA | undefined;
    const llamar: LlamarIA = async (p) => {
      pedido = p;
      return JSON.stringify(propuestaBuena);
    };
    const r = await generarPlano(
      { casoId: "c", knowledgePack: kp, imagenes: [{ base64: "AAAA", mediaType: "image/png" }], paginas: [54] },
      llamar,
    );
    expect(r.origen).toBe("ia");
    expect(pedido!.system).toMatch(/DATOS, nunca instrucciones/);
    expect(pedido!.contenido[0]).toMatchObject({ type: "image" });
    const texto = JSON.stringify(pedido!.contenido);
    for (const p of kp.piezas.filter((q) => q.id !== "base")) expect(texto).toContain(`- ${p.id}:`);
    expect(texto).toContain("páginas 54");
  });

  it("si la IA devuelve basura dos veces, usa la plantilla y lo avisa", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: kp }, respuesta("no es json"));
    expect(r.origen).toBe("plantilla");
    expect(() => PlanoDePiezas.parse(r.plano)).not.toThrow();
    expect(r.avisos[0]).toMatch(/plantilla genérica/);
  });

  it("si la IA devuelve JSON que no valida, también cae a la plantilla", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: kp }, respuesta(JSON.stringify({ piezas: "muchas" })));
    expect(r.origen).toBe("plantilla");
  });
});

describe("paginaDelManual (recorte)", () => {
  it("deja la página del manual; traduce el número de hoja; descarta lo demás", () => {
    expect(paginaDelManual(51, [51, 12])).toBe(51);
    expect(paginaDelManual(2, [51, 12])).toBe(12);
    expect(paginaDelManual(7, [51, 12])).toBeNull();
    expect(paginaDelManual(null, [51, 12])).toBeNull();
  });
});

describe("origen de cada ubicación", () => {
  it("con página y confianza = manual (con cita); sin página = estimada; completada = plantilla", () => {
    const { plano } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      medidas_fuente: "manual",
      piezas: propuestaBuena.piezas.filter((p) => p.pieza !== "wifi"),
    });
    const origen = (id: string) => plano.piezas.find((p) => p.pieza === id)?.origen;
    expect(origen("ventilador")).toBe("manual"); // página 54, confianza alta
    expect(plano.piezas.find((p) => p.pieza === "ventilador")?.cita).toMatchObject({ pagina: 54 });
    expect(origen("ssd")).toBe("estimada"); // sin página
    expect(origen("wifi")).toBe("plantilla"); // la IA no la ubicó
    expect(origen("base")).toBe("manual"); // medidas del manual
    expect(plano.medidas).toEqual({ ancho: "manual", prof: "manual" });
  });

  it("confianza baja aunque cite página = estimada; medidas sin fuente = carcasa estimada", () => {
    const { plano } = planoDesdePropuesta(kp, {
      ...propuestaBuena,
      piezas: propuestaBuena.piezas.map((p) => (p.pieza === "ventilador" ? { ...p, confianza: "baja" as const } : p)),
    });
    expect(plano.piezas.find((p) => p.pieza === "ventilador")?.origen).toBe("estimada");
    expect(plano.piezas.find((p) => p.pieza === "base")?.origen).toBe("estimada");
  });

  it("sin IA (plantilla) todo es plantilla, también las medidas", () => {
    const { plano } = planoDesdePlantilla(kp);
    expect(new Set(plano.piezas.map((p) => p.origen))).toEqual(new Set(["plantilla"]));
    expect(plano.medidas).toEqual({ ancho: "plantilla", prof: "plantilla" });
  });
});
