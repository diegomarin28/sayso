/**
 * Mide cuánto ahorra el recorte: tokens de entrada del manual entero vs. solo las vistas
 * (contar tokens es gratis) y una sola corrida real con el recorte (gasta centavos).
 *   npx tsx --env-file=.env.local lib/planogenerator/evaluacion/medir-recorte.ts ["Marca|Modelo"]
 * Usa un manual de la caché de Supabase que ya tenga la vista interior (el primero, o el pedido).
 */
import Anthropic from "@anthropic-ai/sdk";
import { knowledgePackEjemplo } from "../../../shared";
import { subirArchivo, type LlamarIA, type PedidoIA } from "../../ia/claude";
import { descargarPdf } from "../../knowledge/descargar";
import { RegistroManual } from "../../knowledge/manuales";
import { supabaseServidor } from "../../supabase/cliente";
import { generarPlano, type EntradaGenerador } from "../generador";
import { paginasRecorte, recortarPdf } from "../recorte";

const cliente = new Anthropic();

/** Arma el pedido exacto que haría el generador, sin llamar a la IA. */
async function pedidoDe(entrada: EntradaGenerador): Promise<PedidoIA> {
  let pedido: PedidoIA | undefined;
  const grabar: LlamarIA = async (p) => ((pedido = p), "no es json");
  await generarPlano(entrada, grabar);
  return pedido!;
}

async function tokens(p: PedidoIA): Promise<number> {
  const r = await cliente.beta.messages.countTokens({
    model: p.modelo,
    system: p.system,
    messages: [{ role: "user", content: p.contenido as Anthropic.Beta.BetaContentBlockParam[] }],
    betas: ["files-api-2025-04-14"],
  });
  return r.input_tokens;
}

async function main() {
  const db = supabaseServidor();
  if (!db) throw new Error("Falta Supabase en .env.local");
  const { data, error } = await db.from("manuales").select("*").not("pagina_vista_interior", "is", null);
  if (error) throw new Error(error.message);
  const filas = (data ?? []).map((f) => RegistroManual.parse(f));
  const pedido = process.argv[2];
  const m = pedido ? filas.find((f) => `${f.marca}|${f.modelo}` === pedido) : filas[0];
  if (!m) throw new Error(`No hay manuales con vista interior en la caché (${filas.length} filas).`);
  const paginas = paginasRecorte(m.pagina_vista_interior, m.paginas_vista_explosionada)!;
  console.log(`Manual: ${m.marca} ${m.modelo} · ${m.titulo} · páginas ${paginas.join(", ")}`);

  const pdf = await descargarPdf(m.url);
  if (!pdf) throw new Error("No pude bajar el manual");
  const recorte = await recortarPdf(pdf.datos, paginas);
  if (!recorte) throw new Error("No pude recortar el manual");
  const fileId = await subirArchivo(pdf.datos, "manual.pdf");

  const kp = { ...knowledgePackEjemplo, modelo: m.modelo };
  const base: EntradaGenerador = { casoId: "medicion", knowledgePack: kp };
  const entero = await pedidoDe({ ...base, manual: { fileId, paginasVistaExplosionada: m.paginas_vista_explosionada } });
  const chico = await pedidoDe({ ...base, recorte });
  const [tEntero, tChico] = [await tokens(entero), await tokens(chico)];
  console.log(`Manual entero: ${(pdf.bytes / 1e6).toFixed(1)} MB · ${tEntero} tokens de entrada`);
  console.log(`Recorte:       ${((recorte.base64.length * 3) / 4 / 1e6).toFixed(2)} MB · ${tChico} tokens de entrada (${(tEntero / tChico).toFixed(0)}× menos)`);

  const t0 = Date.now();
  const r = await generarPlano({ ...base, recorte });
  console.log(`Corrida real con el recorte: ${r.origen}, ${((Date.now() - t0) / 1000).toFixed(1)} s, ${r.propuesta?.piezas.length ?? 0} piezas ubicadas, ${r.avisos.length} avisos`);
  for (const p of r.propuesta?.piezas ?? []) console.log(`  ${p.pieza.padEnd(22)} x=${p.x.toFixed(2)} z=${p.z.toFixed(2)} pág ${p.pagina ?? "—"} [${p.confianza}]`);
  await cliente.beta.files.delete(fileId, { betas: ["files-api-2025-04-14"] });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
