import { evaluarFoto } from "../../../../lib/intake/calidad";
import { EntradaCalidad, evento, manejar } from "../../../../lib/intake/entrada";

/** POST { casoId, tipoPedido, instruccion?, imagen: { base64, mediaType }, url? } → { foto: Foto, eventos } */
export function POST(req: Request) {
  return manejar(req, EntradaCalidad, async (entrada) => {
    const { foto } = await evaluarFoto(entrada);
    const ev = foto.aceptada
      ? evento(foto.casoId, "recepcion", "foto_aceptada", `Foto de ${foto.tipoPedido} aceptada.`, { fotoId: foto.id })
      : evento(foto.casoId, "recepcion", "foto_rechazada", foto.motivoRechazo ?? "Foto rechazada.", { fotoId: foto.id });
    return { foto, eventos: [ev] };
  });
}
