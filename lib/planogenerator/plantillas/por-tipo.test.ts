import { describe, expect, it } from "vitest";
import { fichaEjemplo, PlanoDePiezas, type ClaseEquipo, type KnowledgePack } from "../../../shared";
import type { LlamarIA } from "../../ia/claude";
import { claveManual } from "../../knowledge/manuales";
import { cachePlanosEnMemoria } from "../cache";
import { generarPlano } from "../generador";
import { obtenerPlano } from "../obtener";
import { elegirPlantilla, planoDesdePlantillaDeTipo, PLANTILLAS_POR_TIPO } from "./por-tipo";

const pack = (clase: ClaseEquipo, ids: string[], modelo = "Modelo X1"): KnowledgePack => ({
  modelo,
  clase,
  verificado: false,
  fuentes: [{ doc: "guía pública" }],
  piezas: ids.map((id) => ({ id, nombre: id.replace(/_/g, " "), descripcion: "", ubicacion: "" })),
  pasos: [],
  advertencias: [],
  repuestos: [],
});
const plantilla = (id: string) => PLANTILLAS_POR_TIPO.find((p) => p.id === id)!;
/** La IA que no puede ubicar nada: devuelve basura dos veces. */
const iaQueFalla: LlamarIA = async () => "no es json";

describe("elegirPlantilla", () => {
  it("por el tipo de equipo que dijo la recepción (y 'teléfono' no es un televisor)", () => {
    expect(elegirPlantilla(pack("otro", []), "Heladera Samsung no frost")?.id).toBe("heladera");
    expect(elegirPlantilla(pack("otro", []), "Teléfono celular Motorola")?.id).toBe("celular");
    expect(elegirPlantilla(pack("otro", []), "Smart TV 50 pulgadas")?.id).toBe("televisor");
    expect(elegirPlantilla(pack("otro", []), "Lavarropas carga frontal")?.id).toBe("lavarropas");
  });

  it("si no, por la clase del knowledge pack", () => {
    expect(elegirPlantilla(pack("split", []))?.id).toBe("aire");
    expect(elegirPlantilla(pack("lavarropas", []))?.id).toBe("lavarropas");
    expect(elegirPlantilla(pack("notebook", []))?.id).toBe("notebook");
  });

  it("el tipo dicho manda sobre la clase", () => {
    expect(elegirPlantilla(pack("split", []), "microondas")?.id).toBe("microondas");
  });

  it("si no, por las piezas del pack (solo las que distinguen un equipo)", () => {
    expect(elegirPlantilla(pack("otro", ["compresor", "puerta_freezer", "evaporador", "placa_control"]))?.id).toBe("heladera");
    expect(elegirPlantilla(pack("otro", ["tambor", "bomba_desagote", "correa"]))?.id).toBe("lavarropas");
  });

  it("sin señal suficiente no adivina: caja genérica", () => {
    expect(elegirPlantilla(pack("otro", ["placa_control", "cable_alimentacion", "tornillo_tapa"]))).toBeUndefined();
    expect(elegirPlantilla(pack("otro", []), "equipo raro")).toBeUndefined();
  });
});

describe("planoDesdePlantillaDeTipo", () => {
  it("heladera: raíz + piezas del pack por id o por tipo, todas con origen plantilla; lo que no está, avisado", () => {
    const kp = pack("otro", ["compresor", "termostato", "ventilador_freezer", "filtro_agua"]);
    const { plano, avisos } = planoDesdePlantillaDeTipo(kp, plantilla("heladera"));
    expect(() => PlanoDePiezas.parse(plano)).not.toThrow();
    expect(plano.piezas.map((p) => p.pieza).sort()).toEqual(["carcasa_heladera", "compresor", "termostato", "ventilador_freezer"]);
    expect(plano.piezas.every((p) => p.origen === "plantilla")).toBe(true);
    expect(plano.medidas).toEqual({ ancho: "plantilla", prof: "plantilla" });
    expect(plano.piezas.filter((p) => !p.padre).map((p) => p.pieza)).toEqual(["carcasa_heladera"]);
    for (const p of plano.piezas) if (p.padre) expect(p.padre).toBe("carcasa_heladera");
    // El ventilador del pack toma el lugar del ventilador de la plantilla (mismo tipo), con el id del pack.
    const vent = plantilla("heladera").plano.piezas.find((p) => p.pieza === "ventilador_evaporador")!;
    expect(plano.piezas.find((p) => p.pieza === "ventilador_freezer")!.pos).toEqual(vent.pos);
    expect(avisos.join(" ")).toMatch(/filtro_agua.*no está en el esquema/); // la suma suelta `conSueltas` (sueltas.test.ts)
  });

  it("cada plantilla, con las mismas piezas que tiene, se arma entera y valida", () => {
    for (const t of PLANTILLAS_POR_TIPO.filter((x) => x.id !== "notebook")) {
      const { plano, avisos } = planoDesdePlantillaDeTipo(pack("otro", t.plano.piezas.map((p) => p.pieza)), t);
      expect(() => PlanoDePiezas.parse(plano), t.id).not.toThrow();
      expect(plano.piezas.length, t.id).toBe(t.plano.piezas.length);
      expect(avisos, t.id).toEqual([]);
    }
  });
});

describe("respaldo de /api/plano cuando la IA no puede ubicar las piezas", () => {
  it("usa la plantilla del tipo, con el aviso de esquema genérico", async () => {
    const kp = pack("otro", ["compresor", "termostato", "condensador"]);
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "heladera" }, iaQueFalla);
    expect(r.origen).toBe("plantilla");
    expect(r.plano.piezas.some((p) => p.pieza === "carcasa_heladera")).toBe(true);
    expect(r.plano.piezas.every((p) => p.origen === "plantilla")).toBe(true);
    expect(r.avisos[0]).toMatch(/plantilla genérica de heladera \(esquema genérico, no es tu modelo exacto\)/);
  });

  it("sin plantilla para ese tipo, la caja genérica de siempre", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack("otro", ["placa_control", "cable_alimentacion"]) }, iaQueFalla);
    expect(r.origen).toBe("plantilla");
    expect(r.plano.piezas.some((p) => p.pieza === "base")).toBe(true); // la caja
    expect(r.avisos[0]).toMatch(/se usa la plantilla genérica\./);
  });

  it("la plantilla nunca se guarda en la caché como si fuera del modelo", async () => {
    const cache = cachePlanosEnMemoria();
    let llamadas = 0;
    const llamar: LlamarIA = async (p) => (llamadas++, iaQueFalla(p));
    const entrada = { casoId: "c", knowledgePack: pack("otro", ["compresor", "termostato"]), ficha: fichaEjemplo, tipoEquipo: "heladera" };
    const a = await obtenerPlano(entrada, { cache, llamar });
    const b = await obtenerPlano(entrada, { cache, llamar });
    expect([a.origen, b.origen]).toEqual(["plantilla", "plantilla"]);
    expect(b.desdeCache).toBe(false);
    expect(llamadas).toBe(4); // dos intentos por vez: la segunda vez vuelve a probar con la IA
    expect(await cache.get(claveManual(fichaEjemplo.marca.valor, fichaEjemplo.modelo.valor!))).toBeFalsy();
  });
});

describe("lo que traiga el jurado en la mano", () => {
  it.each([
    ["AirPods Pro", "auriculares"],
    ["Apple Watch Series 8", "reloj"],
    ["mouse Logitech", "mouse"],
    ["teclado mecánico", "teclado"],
    ["control de PlayStation", "mando"],
    ["joystick de Xbox", "mando"],
    ["PlayStation 5", "consola"],
    ["parlante JBL", "parlante"],
    ["cargador de celular", "cargador"],
    ["control remoto del aire", "control_remoto"],
    ["iPad Air", "tablet"],
    ["Samsung Galaxy S21 celular", "celular"],
  ])("%s → %s", (dicho, id) => {
    expect(elegirPlantilla(pack("otro", []), dicho)?.id).toBe(id);
  });

  // Prueba a ciegas: como lo diría alguien del jurado o como lo resume la recepción (lib/intake/entender.ts).
  it.each([
    ["los auriculares de mi hija", "auriculares"],
    ["Galaxy Buds 2", "auriculares"],
    ["vincha bluetooth JBL Tune 510BT", "auriculares"],
    ["cascos gamer HyperX", "auriculares"],
    ["un joystick de la Play", "mando"],
    ["el control de la Play 4", "mando"],
    ["un Joy-Con de la Switch", "mando"],
    ["el control de la tele", "control_remoto"],
    ["el control del aire", "control_remoto"],
    ["mando a distancia", "control_remoto"],
    ["un smartwatch Xiaomi", "reloj"],
    ["Mi Band 7", "reloj"],
    ["Galaxy Watch 5", "reloj"],
    ["ratón gamer Razer", "mouse"],
    ["Magic Keyboard", "teclado"],
    ["un parlantito bluetooth", "parlante"],
    ["Echo Dot de Alexa", "parlante"],
    ["fuente de la notebook", "cargador"],
    ["el cargador de la notebook", "cargador"],
    ["una tablet Samsung Galaxy Tab A8", "tablet"],
    ["Lenovo Tab M10", "tablet"],
    ["Kindle", "tablet"],
    ["Samsung Galaxy A54", "celular"],
    ["Motorola Moto G32", "celular"],
    ["un Xiaomi Redmi Note 12", "celular"],
    ["la Play 4", "consola"],
    ["Nintendo Switch", "consola"],
    ["smart tv", "televisor"],
    ["secadora de ropa", "lavarropas"],
  ])("a ciegas: %s → %s", (dicho, id) => {
    expect(elegirPlantilla(pack("otro", []), dicho)?.id).toBe(id);
  });

  it("sin el nombre del aparato ni una plantilla parecida, no adivina: decide el pack", () => {
    for (const dicho of ["planchita de pelo", "afeitadora Philips", "cepillo de dientes eléctrico", "Chromecast", "calculadora Casio", "cámara de fotos Canon", "GoPro Hero 9", "pendrive", "power bank"]) {
      expect(elegirPlantilla(pack("otro", []), dicho)?.id, dicho).toBeUndefined();
    }
  });

  it("también se reconoce por las piezas del pack (sin que la recepción diga qué es)", () => {
    expect(elegirPlantilla(pack("otro", ["sensor_mouse", "rueda_scroll", "microswitch_izquierdo"]))?.id).toBe("mouse");
    expect(elegirPlantilla(pack("otro", ["estuche_auriculares", "almohadilla_silicona"]))?.id).toBe("auriculares");
  });

  it("si la IA no ubica nada, el respaldo es el esqueleto del aparato, con origen plantilla", async () => {
    const r = await generarPlano({ casoId: "c", knowledgePack: pack("otro", ["bateria", "placa", "sensor_mouse"]), tipoEquipo: "mouse" }, iaQueFalla);
    expect(r.origen).toBe("plantilla");
    expect(r.plano.piezas.find((p) => !p.padre)?.pieza).toBe("carcasa_mouse");
    expect(r.plano.piezas.every((p) => p.origen === "plantilla")).toBe(true);
  });
});

describe("completar lo que la IA no ubicó con el esqueleto del tipo", () => {
  it("TV: la IA ubica una pieza; las demás del pack salen del esqueleto del TV (no de la notebook) y no queda vacío", async () => {
    const kp = pack("otro", ["placa_principal", "fuente", "tira_led_1", "parlante_izquierdo"]);
    const propuesta = {
      base_ancho_cm: 100, base_prof_cm: 58, medidas_fuente: "estimada",
      piezas: [{ pieza: "placa_principal", x: 0.3, z: 0, ancho: 0.2, prof: 0.3, alto_cm: 1.5, capa: "sobre_base", sobre: null, forma: "caja", etiquetaManual: null, pagina: 4, confianza: "alta" }],
    };
    const r = await generarPlano({ casoId: "c", knowledgePack: kp, tipoEquipo: "televisor" }, async () => JSON.stringify(propuesta));
    const ids = r.plano.piezas.map((p) => p.pieza);
    for (const id of ["placa_principal", "fuente", "tira_led_1", "parlante_izquierdo"]) expect(ids, id).toContain(id);
    const de = (id: string) => r.plano.piezas.find((p) => p.pieza === id)!;
    expect(de("fuente").origen).toBe("plantilla");
    expect(de("placa_principal").origen).toBe("manual");
    // Del esqueleto del TV: la tira de LED arriba de los parlantes (en la notebook no hay tiras ni parlantes así).
    expect(de("tira_led_1").pos[1]).toBeGreaterThan(de("parlante_izquierdo").pos[1]);
  });
});
