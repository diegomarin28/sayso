import { EntradaPedidos, evento, manejar } from "../../../../lib/intake/entrada";
import { decidirPedidos } from "../../../../lib/intake/pedidos";

/** POST { casoId, clase, sintoma, tipoEquipo? } → { pedidos: PedidoDeFoto[], eventos } (tipoEquipo: el de /api/intake/entender) */
export function POST(req: Request) {
  return manejar(req, EntradaPedidos, async ({ casoId, clase, sintoma, tipoEquipo }) => {
    const { pedidos, porIA } = await decidirPedidos(clase, sintoma, undefined, tipoEquipo);
    return {
      pedidos,
      eventos: [
        evento(casoId, "recepcion", "fotos_pedidas", `Pido ${pedidos.length} fotos para revisar el equipo.`, {
          tipos: pedidos.map((p) => p.tipo),
          porIA,
        }),
      ],
    };
  });
}
