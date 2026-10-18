import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../../shared";
import { GALERIA, type EquipoGaleria } from "./galeria";

/** Exclusivo del lab: posiciones ilustrativas, jamás planos de un modelo confirmado. */
const p = (pieza: string, dim: Vec3, pos: Vec3, padre?: string): PiezaPlano => ({
  pieza, dim, pos, pivote: [0, 0, 0], forma: "caja", ...(padre ? { padre } : {}),
});
const plano = (modelo: string, piezas: PiezaPlano[]): PlanoDePiezas => ({ modelo: modelo + " · esquema genérico del lab", unidades: "cm", piezas });
const mac = (pro: boolean) => plano(pro ? "Notebook Apple Silicon con refrigeración activa" : "Notebook Apple Silicon sin ventilador", [
  p("base", [32, 1.1, 23], [0, 0, 0]),
  p("placa_logica_integrada", [18, 0.5, 5.6], [0, 1, -7], "base"),
  p("bateria_macbook", [25, 0.55, 14], [0, 0.95, 2.7], "base"),
  p("trackpad", [13, 0.4, 8.5], [0, 1.6, 5], "base"),
  p("teclado_notebook", [28, 0.4, 10.5], [0, 2, -4.8], "base"),
  p("parlante_izquierdo", [2, 0.8, 8], [-14, 1.2, 0], "base"),
  p("parlante_derecho", [2, 0.8, 8], [14, 1.2, 0], "base"),
  p("cable_pantalla", [10, 0.1, 1], [0, 1.1, -10.5], "base"),
  ...(pro ? [p("ventilador", [6, 0.9, 6], [11, 1.2, -7], "base")] : []),
]);
const celular = (iphone: boolean): PlanoDePiezas => {
  const base = GALERIA.find((e) => e.id === "celular")!.plano;
  const raiz = base.piezas.find((p) => !p.padre)!.pieza;
  return plano(iphone ? "Celular tipo iPhone" : "Celular tipo Samsung", [
    ...base.piezas.map((p) => ({ ...p })),
    p("motor_vibracion", [3.5, 0.6, 1.2], [0, 0.7, 5], raiz),
    ...(iphone ? [p("modulo_biometrico", [3.5, 0.6, 1.1], [0, 0.7, -6], raiz)] :
      [p("lector_huella", [1.2, 0.4, 2.5], [0, 0.7, 0], raiz)]),
  ]);
};
const ejemplos: EquipoGaleria[] = [
  { id: "iphone-esquema", titulo: "Celular tipo iPhone", detalle: "Esquema genérico con batería, cámaras, háptica y módulo frontal; según el modelo.", grupo: "campus", tipoEquipo: "iPhone celular smartphone", plano: celular(true) },
  { id: "samsung-esquema", titulo: "Celular tipo Samsung", detalle: "Esquema genérico con batería, cámaras, háptica y huella; según el modelo.", grupo: "campus", tipoEquipo: "Samsung Galaxy celular smartphone", plano: celular(false) },
  { id: "smartwatch", titulo: "Reloj inteligente", detalle: "Pantalla circular, correa, sensor óptico y bobina de carga", grupo: "campus", tipoEquipo: "smartwatch reloj inteligente", plano: plano("Reloj inteligente", [
    p("caja_reloj", [4.4, 0.8, 5.5], [0, 0, 0]), p("correa_reloj", [2.6, 0.3, 18], [0, -0.1, 0], "caja_reloj"),
    p("pantalla_reloj", [4, 0.2, 4], [0, 0.5, 0], "caja_reloj"), p("sensor_optico", [2.4, 0.4, 2.4], [0, -0.5, 0], "caja_reloj"),
    p("bobina_carga", [3, 0.2, 3], [0, -0.2, 0], "caja_reloj"), p("corona_reloj", [0.5, 0.5, 1.1], [2.4, 0, 0], "caja_reloj"),
  ]) },
  { id: "macbook-air", titulo: "MacBook Air · esquema", detalle: "Placa integrada, celdas adheridas y trackpad. Sin RAM/SSD removibles ni ventilador.", grupo: "campus", tipoEquipo: "MacBook Air Apple Silicon notebook", plano: mac(false) },
  { id: "macbook-pro", titulo: "MacBook Pro · esquema", detalle: "Placa integrada, batería y blower. Distribución ilustrativa.", grupo: "campus", tipoEquipo: "MacBook Pro Apple Silicon notebook", plano: mac(true) },
  { id: "canilla", titulo: "Canilla", detalle: "Cuerpo, cartucho, manija, aireador y flexibles", grupo: "campus", tipoEquipo: "canilla monocomando", plano: plano("Canilla monocomando", [
    p("canilla", [6.6, 13, 14], [0, 0, 0]), p("cartucho_canilla", [4, 5.5, 4], [0, 5, -3], "canilla"),
    p("manija_canilla", [5.4, 2.3, 10], [0, 8, -1], "canilla"), p("aireador_canilla", [2.8, 1.2, 2.8], [0, 3, 6], "canilla"),
    p("flexible_agua_izquierdo", [8, 12, 1.6], [-1, -10, -3], "canilla"), p("flexible_agua_derecho", [8, 12, 1.6], [1, -10, -1], "canilla"),
  ]) },
  { id: "lavatorio", titulo: "Desagüe del lavatorio", detalle: "Desagüe, sifón y llave de paso", grupo: "campus", tipoEquipo: "lavatorio sifon", plano: plano("Desagüe de lavatorio", [
    p("desague_lavatorio", [6.4, 10, 6.4], [0, 0, 0]), p("sifon_lavatorio", [7, 12, 13], [0, -11, -1], "desague_lavatorio"),
    p("valvula_cierre", [4, 6, 5], [-9, -5, -5], "desague_lavatorio"), p("flexible_agua", [9, 10, 1.7], [-6, -3, -4], "desague_lavatorio"),
  ]) },
  { id: "reloj-pared", titulo: "Reloj de pared", detalle: "Caja, esfera, agujas, movimiento y pila AA", grupo: "campus", tipoEquipo: "reloj pared analogico", plano: plano("Reloj de pared", [
    p("carcasa_reloj_pared", [30, 30, 3], [0, 0, 0]), p("esfera_reloj", [27, 27, 0.3], [0, 0, 1.3], "carcasa_reloj_pared"),
    // El pivote de biblioteca es el centro de la caja; compensar hasta el eje de las agujas.
    p("agujas_reloj", [8, 12.5, 0.25], [-3.42, -5.75, 1.6], "carcasa_reloj_pared"), p("mecanismo_reloj_pared", [6, 7, 3], [0, 0, -2], "carcasa_reloj_pared"),
    p("pila_aa", [1.4, 5, 1.4], [0, -3.5, -2], "carcasa_reloj_pared"),
  ]) },
  { id: "reloj-pulsera", titulo: "Reloj de pulsera", detalle: "Caja, correa, esfera, agujas y pila de botón", grupo: "campus", tipoEquipo: "reloj pulsera analogico", plano: plano("Reloj de pulsera", [
    p("caja_reloj", [4.4, 0.8, 5.5], [0, 0, 0]), p("correa_reloj", [2.6, 0.3, 18], [0, -0.1, 0], "caja_reloj"),
    p("esfera_reloj", [3.8, 0.1, 3.8], [0, 0.5, 0], "caja_reloj"), p("agujas_reloj", [1.6, 0.2, 2.2], [0, 0.65, 0], "caja_reloj"),
    p("mecanismo_reloj", [3.4, 0.8, 3.4], [0, -0.3, 0], "caja_reloj"), p("pila", [1.5, 0.3, 1.5], [0, -0.5, 0], "caja_reloj"),
  ]) },
  { id: "calculadora", titulo: "Calculadora", detalle: "Carcasa, matriz de botones, LCD y placa", grupo: "campus", tipoEquipo: "calculadora", plano: plano("Calculadora", [
    p("carcasa_calculadora", [8, 1.2, 15], [0, 0, 0]), p("teclado_calculadora", [6.5, 0.6, 8.5], [0, 0.8, 2.2], "carcasa_calculadora"),
    p("pantalla_segmentos", [6.5, 0.4, 3], [0, 0.85, -4.8], "carcasa_calculadora"), p("placa", [6, 0.2, 11], [0, 0.2, 0], "carcasa_calculadora"),
    p("pila", [2, 0.3, 2], [0, -0.5, 4], "carcasa_calculadora"),
  ]) },
  { id: "proyector-aula", titulo: "Proyector de aula", detalle: "Lente, módulo de luz, ventilador y placa AV", grupo: "campus", tipoEquipo: "proyector", plano: plano("Proyector LED de aula", [
    p("carcasa_proyector", [28, 9, 22], [0, 0, 0]), p("lente_proyector", [7, 7, 8], [-6, 0, 10], "carcasa_proyector"),
    p("modulo_led_proyector", [6, 4, 6], [-6, 0, 1], "carcasa_proyector"), p("modulador_imagen", [5, 0.6, 4], [-6, 0, 5], "carcasa_proyector"),
    p("placa_principal_av", [14, 1, 9], [4, -2, -3], "carcasa_proyector"), p("ventilador", [6, 1, 6], [9, 0, -5], "carcasa_proyector"),
  ]) },
  { id: "cisterna", titulo: "Descarga de cisterna", detalle: "Torre de descarga, flotante, pulsador y llave de paso", grupo: "campus", tipoEquipo: "cisterna inodoro", plano: plano("Mecanismos de cisterna", [
    p("valvula_descarga", [8, 18, 8], [0, 0, 0]), p("flotante_cisterna", [6, 19, 6], [-10, 0, 0], "valvula_descarga"),
    p("pulsador_descarga", [6.4, 7, 6.4], [0, 15, 0], "valvula_descarga"), p("valvula_cierre", [4, 6, 5], [-8, -12, -4], "valvula_descarga"),
  ]) },
  { id: "luminaria", titulo: "Luminaria de aula", detalle: "Difusor, tiras LED, fuente y cableado ilustrativo", grupo: "campus", tipoEquipo: "luminaria led aula", plano: plano("Luminaria LED de aula", [
    p("difusor_luminaria", [61, 1, 31], [0, 0, 0]), p("tira_led_primera", [40, 0.5, 1.2], [0, 1, -10], "difusor_luminaria"),
    p("tira_led_segunda", [40, 0.5, 1.2], [0, 1, 0], "difusor_luminaria"), p("tira_led_tercera", [40, 0.5, 1.2], [0, 1, 10], "difusor_luminaria"),
    p("fuente", [15, 2, 8], [20, 2, 5], "difusor_luminaria"), p("cable", [30, 0.2, 2], [0, 1, 13], "difusor_luminaria"),
  ]) },
  { id: "toma-pared", titulo: "Toma de pared", detalle: "Marco, módulo y tornillos; forma ilustrativa", grupo: "campus", tipoEquipo: "toma pared", plano: plano("Toma de pared", [
    p("placa_pared", [8, 12, 0.7], [0, 0, 0]), p("toma_corriente", [4.6, 4.6, 1.3], [0, 0, 0.5], "placa_pared"),
    p("tornillo_superior", [0.4, 0.4, 0.3], [0, 4.5, 0.6], "placa_pared"), p("tornillo_inferior", [0.4, 0.4, 0.3], [0, -4.5, 0.6], "placa_pared"),
  ]) },
];

/** Prioriza lo que hay a mano. La galería histórica sigue disponible en /lab/galeria. */
export const GALERIA_CAMPUS: EquipoGaleria[] = [
  ...GALERIA.filter((e) => ["notebook", "celular", "televisor", "heladera", "aire", "lavarropas", "impresora", "router"].includes(e.id)).map((e) => ({ ...e, grupo: "equipos" as const })),
  ...ejemplos,
];
