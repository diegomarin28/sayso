import { describe, expect, it } from "vitest";
import { fichaEjemplo, knowledgePackEjemplo, type KnowledgePack } from "../../shared";
import type { LlamarIA, PedidoIA } from "../ia/claude";
import { cachePlanosEnMemoria } from "./cache";
import { propuestaDesdePlantilla } from "./generador";
import { obtenerPlano } from "./obtener";

const kp = knowledgePackEjemplo;
const propuesta = JSON.stringify({ base_ancho_cm: null, base_prof_cm: null, piezas: propuestaDesdePlantilla({ modelo: "x", unidades: "cm", piezas: [] }) });
const contador = () => {
  const llamadas: PedidoIA[] = [];
  const llamar: LlamarIA = async (p) => {
    llamadas.push(p);
    return propuesta;
  };
  return { llamadas, llamar };
};
const entrada = { casoId: "c", knowledgePack: kp, ficha: fichaEjemplo };

describe("obtenerPlano (caché por marca + modelo)", () => {
  it("la primera vez genera y guarda; la segunda reusa sin llamar a la IA", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    const a = await obtenerPlano(entrada, { cache, llamar });
    const b = await obtenerPlano(entrada, { cache, llamar });
    expect(a.desdeCache).toBe(false);
    expect(b.desdeCache).toBe(true);
    expect(b.plano).toEqual(a.plano);
    expect(llamadas).toHaveLength(1);
  });

  it("si el pack nuevo pide piezas que no se pidieron antes, regenera", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    await obtenerPlano(entrada, { cache, llamar });
    const otroPack: KnowledgePack = {
      ...kp,
      piezas: [...kp.piezas, { id: "parlantes", nombre: "Parlantes", descripcion: "", ubicacion: "" }],
    };
    const r = await obtenerPlano({ ...entrada, knowledgePack: otroPack }, { cache, llamar });
    expect(r.desdeCache).toBe(false);
    expect(llamadas).toHaveLength(2);
  });

  it("la plantilla genérica (IA falló) no se guarda", async () => {
    const cache = cachePlanosEnMemoria();
    const falla: LlamarIA = async () => "no es json";
    const r = await obtenerPlano(entrada, { cache, llamar: falla });
    expect(r.origen).toBe("plantilla");
    const { llamadas, llamar } = contador();
    expect((await obtenerPlano(entrada, { cache, llamar })).desdeCache).toBe(false);
    expect(llamadas).toHaveLength(1);
  });

  it("sin modelo en la ficha no hay clave: genera y no guarda", async () => {
    const cache = cachePlanosEnMemoria();
    const { llamadas, llamar } = contador();
    const sinModelo = { ...fichaEjemplo, modelo: { valor: null, estado: "desconocido" as const } };
    await obtenerPlano({ ...entrada, ficha: sinModelo }, { cache, llamar });
    await obtenerPlano({ ...entrada, ficha: sinModelo }, { cache, llamar });
    expect(llamadas).toHaveLength(2);
  });

  it("con el manual subido, le pasa el PDF por file_id y las páginas de la vista explosionada", async () => {
    const { llamadas, llamar } = contador();
    await obtenerPlano(
      { ...entrada, manual: { fileId: "file_123", paginasVistaExplosionada: [51, 52] } },
      { cache: cachePlanosEnMemoria(), llamar },
    );
    expect(llamadas[0].contenido[0]).toMatchObject({ type: "document", source: { type: "file", file_id: "file_123" } });
    expect(JSON.stringify(llamadas[0].contenido)).toContain("páginas 51, 52");
  });
});
