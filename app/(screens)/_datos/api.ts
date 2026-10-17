import {
  Caso,
  Ficha,
  Foto,
  PedidoDeFoto,
  fichaEjemplo,
  fotosEjemplo,
} from "@/shared";

/**
 * Fuente de datos de las pantallas. Por ahora responde con los fixtures de `shared/`
 * (con demoras para ver los estados de carga). Cuando Juanma tenga `/api/intake` y
 * `/api/ficha`, se cambian estas funciones por llamadas reales y las pantallas no cambian.
 */

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function entenderSintoma(texto: string): Promise<Caso> {
  await esperar(1200);
  return Caso.parse({
    id: `caso-${Date.now()}`,
    clase: "notebook", // TODO(A1): lo decide la IA a partir del texto
    sintoma: texto.trim(),
    estado: "captura",
    creadoEn: new Date().toISOString(),
  });
}

export async function pedidosDeFoto(): Promise<PedidoDeFoto[]> {
  await esperar(300);
  return PedidoDeFoto.array().parse([
    { tipo: "frente", instruccion: "Sacale una foto de frente, con la tapa abierta." },
    {
      tipo: "etiqueta",
      instruccion: "Dala vuelta y sacale una foto a la etiqueta de abajo. Que se lean las letras.",
      advertencia: "Apagala y desenchufala antes de darla vuelta.",
    },
    { tipo: "puertos", instruccion: "Ahora los costados, donde están los puertos." },
  ]);
}

/** Mock del control de calidad: la primera foto de la etiqueta sale "movida", como en el fixture. */
export async function evaluarFoto(
  casoId: string,
  tipo: PedidoDeFoto["tipo"],
  url: string,
  intento: number,
): Promise<Foto> {
  await esperar(1600);
  const rechazada = tipo === "etiqueta" && intento === 1;
  const base = rechazada ? fotosEjemplo[0] : fotosEjemplo[1];
  return Foto.parse({
    ...base,
    id: `foto-${tipo}-${intento}`,
    casoId,
    tipoPedido: tipo,
    url,
  });
}

export async function leerChapa(casoId: string): Promise<Ficha> {
  await esperar(1800);
  return Ficha.parse({ ...fichaEjemplo, casoId, confirmadaPorUsuario: false });
}
