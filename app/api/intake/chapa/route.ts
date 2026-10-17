import { leerChapa } from "../../../../lib/intake/chapa";
import { EntradaChapa, evento, manejar } from "../../../../lib/intake/entrada";

/** POST { casoId, clase, imagenes: [{ base64, mediaType }] } → { ficha: Ficha, eventos } */
export function POST(req: Request) {
  return manejar(req, EntradaChapa, async (entrada) => {
    const { ficha } = await leerChapa(entrada);
    const modelo = ficha.modelo.valor ?? "desconocido";
    return {
      ficha,
      eventos: [
        evento(entrada.casoId, "identificador", "chapa_leida", `Leí la chapa: modelo ${modelo} (${ficha.modelo.estado}).`, {
          marca: ficha.marca,
          modelo: ficha.modelo,
        }),
      ],
    };
  });
}
