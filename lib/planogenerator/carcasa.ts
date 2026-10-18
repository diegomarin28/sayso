import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../shared";
import { pararPlano } from "./orientacion";
import type { PlantillaDeEquipo } from "./plantillas/por-tipo";

/** Si el alto de la cara está más lejos que esto (en veces) del típico del tipo, no es el alto: es la profundidad. */
export const FACTOR_ALTO_DUDOSO = 2;
/** Al estirar la planta, una pieza que ocupa al menos esta fracción (un panel) se estira con ella. */
const OCUPA_LA_PLANTA = 0.8;

/**
 * El plano que arma la IA es siempre una notebook acostada: una base (`base`, el chasis de notebook,
 * 1,2 cm) con las piezas apiladas encima. Para un equipo con plantilla de su tipo:
 * - la base pasa a ser la carcasa del tipo (`marco` en un celular, `carcasa_televisor` en un TV…;
 *   la notebook ya tiene la suya: su base no se toca),
 *   con el espesor real del equipo; si las piezas apiladas quedan más gruesas que el equipo (un
 *   celular de 1,6 cm en vez de 0,8), se comprime el alto;
 * - si el equipo acostado tiene tapa (la trasera del celular, la inferior de la notebook) y el plano
 *   no la trae, se agrega: así el 3D arranca CERRADO y se abre cuando la guía saca la tapa;
 * - un equipo parado (TV, heladera…) se para (ver `pararPlano`).
 * Idempotente: un plano ya ajustado (o de una plantilla, que ya viene en su forma) no cambia. Se
 * aplica al generar y también al leer de la caché (los planos viejos se arreglan solos).
 */
export function ajustarPlanoAlTipo(plano: PlanoDePiezas, plantilla: PlantillaDeEquipo): PlanoDePiezas {
  const base = plano.piezas.find((p) => !p.padre && p.pieza === "base");
  // Solo los planos armados por el generador: base acostada (más fina que ancha y que profunda).
  if (!base || base.dim[1] >= Math.min(base.dim[0], base.dim[2])) return plano;
  const raizTipo = plantilla.plano.piezas.find((p) => !p.padre) ?? plantilla.plano.piezas[0];
  // Espesor real del equipo en la planta acostada: el alto de un acostado, la profundidad de un parado.
  const espesor = plantilla.parado ? raizTipo.dim[2] : raizTipo.dim[1];

  const notebook = plantilla.id === "notebook";
  let piezas = plano.piezas.map((p) => ({ ...p }));
  let medidas = plano.medidas;

  // Parado: la planta es la cara (ancho × alto). Si el "alto" no cuadra con el tipo (un plano viejo con
  // la profundidad, 123 × 7,5 cm), se estira la planta en z hasta la proporción típica: queda estimada.
  // Se estiran los lugares, no las piezas (una placa de 4,5 cm no pasa a medir 48); solo las que ocupan
  // casi toda la planta (un panel) se estiran con ella.
  if (plantilla.parado) {
    const tipica = raizTipo.dim[1] / raizTipo.dim[0];
    const [W, , D] = base.dim;
    if (Math.abs(Math.log(D / W / tipica)) > Math.log(FACTOR_ALTO_DUDOSO)) {
      const f = (W * tipica) / D;
      const cz = base.pos[2];
      piezas = piezas.map((p) => {
        const g = (!p.padre && p.pieza === base.pieza) || p.dim[2] >= D * OCUPA_LA_PLANTA ? f : 1;
        return {
          ...p,
          pos: [p.pos[0], p.pos[1], cz + (p.pos[2] - cz) * f] as Vec3,
          dim: [p.dim[0], p.dim[1], p.dim[2] * g] as Vec3,
          pivote: [p.pivote[0], p.pivote[1], p.pivote[2] * g] as Vec3,
        };
      });
      medidas = { ancho: medidas?.ancho ?? "estimada", prof: "estimada" };
    }
  }
  const piso = Math.min(...piezas.map((p) => p.pos[1] - p.dim[1] / 2));
  const techo = () => Math.max(...piezas.map((p) => p.pos[1] + p.dim[1] / 2));
  const apilado = techo() - piso;
  if (!notebook && !plantilla.parado && apilado > espesor * 1.05) {
    const f = espesor / apilado;
    piezas = piezas.map((p) => ({
      ...p,
      pos: [p.pos[0], piso + (p.pos[1] - piso) * f, p.pos[2]] as Vec3,
      dim: [p.dim[0], p.dim[1] * f, p.dim[2]] as Vec3,
      pivote: [p.pivote[0], p.pivote[1] * f, p.pivote[2]] as Vec3,
    }));
  }

  // La base pasa a ser la carcasa del tipo, envolviendo lo apilado (si el pack ya usa ese id, queda `base`).
  const id = notebook || piezas.some((p) => p.pieza === raizTipo.pieza) ? "base" : raizTipo.pieza;
  if (!notebook) {
    const grosor = Math.max(espesor, techo() - piso);
    piezas = piezas.map((p) => {
      if (p.pieza === "base") return { ...p, pieza: id, pos: [p.pos[0], piso + grosor / 2, p.pos[2]] as Vec3, dim: [p.dim[0], grosor, p.dim[2]] as Vec3 };
      return p.padre === "base" ? { ...p, padre: id } : p;
    });
  }

  // La tapa del tipo, si el equipo acostado la tiene y el plano no (el 3D arranca cerrado).
  const tapa = plantilla.parado ? undefined : plantilla.plano.piezas.find((p) => p.pieza.startsWith("tapa"));
  if (tapa && !piezas.some((p) => p.pieza.startsWith("tapa"))) {
    const raiz = piezas.find((p) => p.pieza === id)!;
    const [W, , D] = raiz.dim;
    const escala = [W / raizTipo.dim[0], 1, D / raizTipo.dim[2]];
    const alto = tapa.dim[1];
    const nueva: PiezaPlano = {
      pieza: tapa.pieza,
      forma: tapa.forma,
      dim: [tapa.dim[0] * escala[0], alto, tapa.dim[2] * escala[2]],
      pos: [raiz.pos[0], techo() + alto / 2, raiz.pos[2]],
      pivote: [tapa.pivote[0] * escala[0], tapa.pivote[1], tapa.pivote[2] * escala[2]],
      padre: id,
      origen: "plantilla",
    };
    piezas = [...piezas, nueva];
  }

  const ajustado = { ...plano, piezas, ...(medidas ? { medidas } : {}) };
  return plantilla.parado ? pararPlano(ajustado) : ajustado;
}
