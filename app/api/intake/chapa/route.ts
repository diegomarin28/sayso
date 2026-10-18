import { fichaConFoto, fichaVacia, leerChapa, reconocerPorFoto } from "../../../../lib/intake/chapa";
import { EntradaChapa, evento, manejar } from "../../../../lib/intake/entrada";

/**
 * POST { casoId, clase, tipoEquipo?, imagenes: [etiqueta...], imagenesFrente?: [equipo entero...] }
 *   → { ficha: Ficha, eventos }
 * Si la etiqueta no da el modelo y hay foto del frente, se reconoce el equipo por la foto:
 * marca y modelo quedan "probable" (fuente "foto") y la persona los tiene que confirmar en la ficha.
 */
export function POST(req: Request) {
  return manejar(req, EntradaChapa, async (entrada) => {
    const eventos = [];
    let ficha = entrada.imagenes.length ? (await leerChapa(entrada)).ficha : fichaVacia(entrada.casoId, entrada.clase);
    if (entrada.imagenes.length) {
      eventos.push(
        evento(entrada.casoId, "identificador", "chapa_leida", `Leí la chapa: modelo ${ficha.modelo.valor ?? "desconocido"} (${ficha.modelo.estado}).`, {
          marca: ficha.marca,
          modelo: ficha.modelo,
        }),
      );
    }
    // Falta la marca o el modelo y hay foto del frente: se reconoce por la foto (el logo suele dar la marca).
    if ((ficha.marca.estado === "desconocido" || ficha.modelo.estado === "desconocido") && entrada.imagenesFrente.length) {
      const r = await reconocerPorFoto({ clase: entrada.clase, tipoEquipo: entrada.tipoEquipo, imagenes: entrada.imagenesFrente });
      ficha = fichaConFoto(ficha, r);
      eventos.push(
        evento(
          entrada.casoId,
          "identificador",
          "equipo_reconocido_por_foto",
          ficha.marca.fuente === "foto" || ficha.modelo.fuente === "foto"
            ? `Por la foto parece ${[ficha.marca.valor, ficha.modelo.valor].filter(Boolean).join(" ")}. Confirmalo en la ficha.`
            : "No pude reconocer el equipo por la foto: completá la marca y el modelo en la ficha.",
          { confianza: r.confianza },
        ),
      );
    }
    return { ficha, eventos };
  });
}
