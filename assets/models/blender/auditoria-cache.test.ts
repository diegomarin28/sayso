import { describe, expect, it } from 'vitest';
import { PlanoDePiezas, type KnowledgePack, type Vec3 } from '../../../shared';
import { terminarGuardado } from '../../../lib/planogenerator/obtener';
import { IndicePiezas, tipoPara } from '../../../lib/planogenerator/biblioteca';
import indice from '../../../public/models/piezas/indice.json';
import guardados from './auditoria-cache.json';

// Lectura de Supabase del 18/10. Nunca consulta una API ni llama a un modelo.
describe('regresión de planos reales guardados: reglas por tipo', () => {
  for (const caso of guardados) {
    const tipo = caso.modelo === '55V6C' ? 'televisor' : 'celular';
    const pack: KnowledgePack = { modelo: caso.modelo, clase: 'otro', verificado: false,
      fuentes: [], piezas: caso.piezas_pedidas.map(id => ({ id, nombre: id, descripcion: '', ubicacion: '' })),
      pasos: [], advertencias: [], repuestos: [] };
    it.each([0.85, 1.2])(`${tipo}: variante de tamaño %s sin condiciones por marca`, escala => {
      const original = PlanoDePiezas.parse(caso.plano);
      const plano = { ...original, piezas: original.piezas.map(p => ({ ...p,
        dim: p.dim.map((v, i) => i === (tipo === 'televisor' ? 2 : 1) ? v : v * escala) as Vec3,
        pos: p.pos.map((v, i) => i === (tipo === 'televisor' ? 2 : 1) ? v : v * escala) as Vec3 })) };
      const a = terminarGuardado(plano, { ...pack, modelo: 'Marca A variante A' }, tipo).plano;
      const b = terminarGuardado(plano, { ...pack, modelo: 'Marca B variante B' }, tipo).plano;
      expect(a.piezas).toEqual(b.piezas);
      expect(() => PlanoDePiezas.parse(a)).not.toThrow();
      const nombres = Object.keys(IndicePiezas.parse(indice).tipos);
      for (const id of caso.piezas_pedidas) {
        const pieza = a.piezas.find(p => p.pieza === id);
        expect(pieza, id).toBeDefined();
        expect(tipoPara(pieza!.formaBiblioteca ?? id, nombres), id).toBeDefined();
      }
      const raiz = a.piezas.find(p => !p.padre)!;
      if (tipo === 'televisor') expect(raiz.dim[1] / raiz.dim[0]).toBeGreaterThan(0.45);
      else expect(raiz.dim[2]).toBeGreaterThan(raiz.dim[0]);
    });
  }
});
