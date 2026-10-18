import { describe, expect, it } from "vitest";
import { knowledgePackEjemplo, type KnowledgePack } from "../../../shared";
import { avisoRiesgoAlto } from "./aviso-riesgo";

const paso = (orden: number, texto: string, riesgo: "bajo" | "medio" | "alto") => ({ id: `p${orden}`, orden, texto, piezas: [], riesgo });
const pack = (pasos: KnowledgePack["pasos"]): KnowledgePack => ({ ...knowledgePackEjemplo, pasos });

describe("avisoRiesgoAlto", () => {
  it("con un paso de riesgo alto: hasta qué paso llega la guía, con el texto corto del primero", () => {
    const p = pack([
      paso(1, "Apagá el equipo y desenchufalo.", "bajo"),
      paso(2, "Sacá los tornillos de la tapa inferior.", "medio"),
      paso(4, "Desconectá la batería de la placa y retirala. Tiene adhesivo fuerte.", "alto"),
      paso(3, "Ubicá la batería.", "bajo"),
      paso(5, "Abrí la fuente.", "alto"),
    ]);
    expect(avisoRiesgoAlto(p)).toBe(
      "Antes de empezar: esta guía te explica hasta el paso 4. El paso 4 (riesgo alto: Desconectá la batería de la placa y retirala) no lo animamos: ahí te recomendamos llevarlo a un técnico.",
    );
  });

  it("un paso largo se recorta", () => {
    const largo = "Despegá con cuidado la batería hinchada usando alcohol isopropílico debajo de las tiras adhesivas del lado de la bisagra";
    expect(avisoRiesgoAlto(pack([paso(1, largo, "alto")]))).toMatch(/riesgo alto: Despegá con cuidado .{20,}…\) no lo animamos/);
  });

  it("sin pasos de riesgo alto, nada", () => {
    expect(avisoRiesgoAlto(pack([paso(1, "Limpiá las rejillas.", "bajo"), paso(2, "Cambiá el ventilador.", "medio")]))).toBeNull();
  });
});
