import { EntradaPedidos, evento, manejar } from "../../../../lib/intake/entrada";
import { decidirPedidos } from "../../../../lib/intake/pedidos";

/** POST { casoId, clase, sintoma } → { pedidos: PedidoDeFoto[], eventos } */
export function POST(req: Request) {
  return manejar(req, EntradaPedidos, async ({ casoId, clase, sintoma }) => {
    const { pedidos, extrasDeIA } = await decidirPedidos(clase, sintoma);
    return {
      pedidos,
      eventos: [
        evento(casoId, "recepcion", "fotos_pedidas", `Pido ${pedidos.length} fotos para revisar el equipo.`, {
          tipos: pedidos.map((p) => p.tipo),
          extrasDeIA,
        }),
      ],
    };
  });
}
