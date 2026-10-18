import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, planoEjemplo } from "../../shared";
import { CasoGuardado } from "../../app/(screens)/_datos/mis-casos";
import { CASOS_DEMO } from "./casos";
import { casoGuardado } from "./mis-casos";

describe("Mis casos de prueba desde la caché (sin IA)", () => {
  const [tv] = CASOS_DEMO;
  const armado = {
    pack: knowledgePackEjemplo,
    manual: null,
    vistas: { interior: 68, explosionada: 51 },
    vistaInterior: null,
    imagenesPaginas: { 68: "https://ej.com/p68.png" },
  };
  const plano = { plano: planoEjemplo, avisos: ["guardado"], manualUrl: null, piezasPedidas: [] };

  it("arma un caso que la pantalla de Mis casos acepta, con la guía lista para abrir", () => {
    const c = casoGuardado(tv, armado, plano, "2026-10-17T23:00:00.000Z");
    expect(CasoGuardado.safeParse(c).success).toBe(true);
    expect(c.caso).toMatchObject({ id: `prueba-${tv.id}`, sintoma: tv.relato, estado: "guia" });
    expect(c.tipoEquipo).toBe(tv.tipoEquipo);
    expect(c.ficha?.modelo.valor).toBe(tv.modelo);
    // Igual que /api/knowledge: la vista explosionada va como lista.
    expect(c.guia?.preparado).toMatchObject({ paginasVistaExplosionada: [51], paginaVistaInterior: 68, desdeCache: true });
    expect(c.guia?.preparado.imagenesPaginas).toEqual({ 68: "https://ej.com/p68.png" });
  });

  it("el plano sale terminado como lo devuelve hoy /api/plano (con las piezas del pack)", () => {
    const c = casoGuardado(tv, armado, plano);
    const ids = c.guia!.plano.plano.piezas.map((p) => p.pieza);
    for (const p of knowledgePackEjemplo.piezas.filter((p) => !["base", "tapa_inferior"].includes(p.id))) expect(ids).toContain(p.id);
    expect(c.guia!.plano.avisos[0]).toBe("guardado");
  });

  it("un pack guardado que no valida no se carga", () => {
    expect(() => casoGuardado(tv, { ...armado, pack: { roto: true } }, plano)).toThrow();
  });
});
