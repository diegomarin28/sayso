import type { PiezaPlano, PlanoDePiezas, Vec3 } from "../../../shared";

/**
 * Plantillas genéricas POR TIPO de equipo: medidas típicas en cm, no de un modelo.
 * Son la red de seguridad cuando la IA no puede ubicar las piezas (`/api/plano` con origen
 * "plantilla"; la pantalla dice "esquema genérico, no es tu modelo exacto") y los ejemplos de
 * /lab y /lab/galeria. Nunca se guardan en la caché como si fueran de un modelo.
 * La heladera y el aire incluyen una pieza sin forma en la biblioteca (el sensor) para ver la primitiva.
 */
const pieza = (id: string, dim: Vec3, pos: Vec3, forma: PiezaPlano["forma"] = "caja", padre?: string): PiezaPlano => ({
  pieza: id,
  forma,
  dim,
  pos,
  pivote: [0, 0, 0],
  ...(padre ? { padre } : {}),
});

export const planoHeladera: PlanoDePiezas = {
  modelo: "Heladera genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_heladera", [60, 172, 65], [0, 86, 0]),
    pieza("puerta_freezer", [60, 50, 8], [0, 147, 36.5], "caja", "carcasa_heladera"),
    pieza("puerta_heladera", [60, 117, 8], [0, 61, 36.5], "caja", "carcasa_heladera"),
    pieza("bisagra_superior", [7, 3, 3], [-25, 173.5, 31], "caja", "carcasa_heladera"),
    pieza("compresor", [18, 17, 14], [0, 10.5, -22], "cilindro", "carcasa_heladera"),
    pieza("condensador", [45, 80, 2], [0, 95, -34], "caja", "carcasa_heladera"),
    pieza("evaporador", [40, 20, 3], [0, 140, -27], "caja", "carcasa_heladera"),
    pieza("bandeja_verduras", [52, 18, 30], [0, 12, 14], "caja", "carcasa_heladera"),
    pieza("ventilador_evaporador", [12, 12, 3], [20, 140, -24], "cilindro", "carcasa_heladera"),
    pieza("resistencia_deshielo", [30, 4, 6], [0, 128, -27], "caja", "carcasa_heladera"),
    pieza("termostato", [4, 3, 3], [22, 112, -28], "caja", "carcasa_heladera"),
    pieza("placa_control", [15, 1.8, 10], [0, 173, -20], "caja", "carcasa_heladera"),
    pieza("cable_alimentacion", [28, 1, 2], [10, 4, -34], "caja", "carcasa_heladera"),
    pieza("sensor_temperatura", [1, 2, 1], [15, 100, -28], "cilindro", "carcasa_heladera"),
  ],
};

export const planoAire: PlanoDePiezas = {
  modelo: "Aire split, unidad interior genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_split", [80, 28, 20], [0, 14, 0]),
    pieza("ventilador_tangencial", [64, 9, 9], [-3, 8, 2], "cilindro", "carcasa_split"),
    pieza("serpentin_evaporador", [70, 16, 3], [-3, 18, -4], "caja", "carcasa_split"),
    pieza("motor_ventilador", [8, 9, 9], [35, 8, 1], "cilindro", "carcasa_split"),
    pieza("placa_control", [10, 1.5, 8], [34, 22, -2], "caja", "carcasa_split"),
    pieza("filtro_izquierdo", [34, 0.6, 16], [-18, 26.5, -1], "caja", "carcasa_split"),
    pieza("filtro_derecho", [34, 0.6, 16], [18, 26.5, -1], "caja", "carcasa_split"),
    pieza("manguera_desagote", [20, 3, 2.5], [-30, 2, -7], "cilindro", "carcasa_split"),
    pieza("cable_alimentacion", [20, 1, 1.6], [28, 2, -7], "caja", "carcasa_split"),
    pieza("bandeja_condensado", [70, 1.5, 8], [-3, 10.5, -4], "caja", "carcasa_split"),
    pieza("sensor_temperatura", [1, 2, 1], [-36, 20, -6], "cilindro", "carcasa_split"),
  ],
};

/** Hijos de una pieza raíz: `[id, dim, pos, forma?]` → piezas con `padre` (así el despiece las separa). */
const hijos = (padre: string, lista: Array<[string, Vec3, Vec3, PiezaPlano["forma"]?]>) =>
  lista.map(([id, dim, pos, forma]) => pieza(id, dim, pos, forma ?? "caja", padre));

/** Celular visto desde atrás (la tapa trasera arriba): marco con la placa media, batería, placa y cámaras. */
export const planoCelular: PlanoDePiezas = {
  modelo: "Celular genérico (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("marco", [7.4, 0.8, 15.8], [0, 0.4, 0]),
    ...hijos("marco", [
      ["pantalla", [7.1, 0.35, 15.5], [0, -0.2, 0]],
      ["bateria", [5.6, 0.45, 8.6], [0, 1.03, 2.4]],
      ["placa_madre", [6, 0.25, 5.4], [0, 0.93, -4.6]],
      ["camara_trasera", [2.6, 0.7, 2.6], [-1.6, 1.4, -5.6]],
      ["camara_frontal", [0.8, 0.5, 0.8], [1.8, 1.3, -6.6]],
      ["placa_carga", [6, 0.2, 1.8], [0, 0.9, 6.8]],
      ["conector_carga", [0.9, 0.32, 0.75], [0, 1.16, 7.4]],
      ["parlante_inferior", [1.8, 0.35, 1], [-2.1, 1.08, 6.6]],
      ["tapa_trasera", [7.3, 0.18, 15.7], [0, 1.9, 0]],
    ]),
  ],
};

/** Televisor de 46" parado, visto de frente: panel, retroiluminación con tiras de LED, fuente y placa. */
export const planoTelevisor: PlanoDePiezas = {
  modelo: "Televisor genérico (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_televisor", [100, 66, 10], [0, 33, 0]),
    ...hijos("carcasa_televisor", [
      ["pantalla_panel", [100, 58, 2.3], [0, 35, 4.4]],
      ["retroiluminacion", [96, 56, 0.4], [0, 35, 2.9]],
      ["tira_led_1", [44, 1.2, 0.9], [0, 15, 2.2]],
      ["tira_led_2", [44, 1.2, 0.9], [0, 28, 2.2]],
      ["tira_led_3", [44, 1.2, 0.9], [0, 42, 2.2]],
      ["tira_led_4", [44, 1.2, 0.9], [0, 55, 2.2]],
      ["fuente", [16, 10, 3], [-22, 26, -1.5]],
      ["placa_control", [15, 10, 2.5], [20, 26, -1.5]],
      ["parlante_izquierdo", [10, 3, 4], [-36, 6, -1]],
      ["parlante_derecho", [10, 3, 4], [36, 6, -1]],
      ["cable_alimentacion", [20, 1, 2], [-30, 2, -3.5]],
    ]),
  ],
};

/** Lavarropas de carga frontal: tambor, puerta ojo de buey, motor con correa, bomba y válvula. */
export const planoLavarropas: PlanoDePiezas = {
  modelo: "Lavarropas genérico (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_lavarropas", [60, 86, 60], [0, 43, 0]),
    ...hijos("carcasa_lavarropas", [
      ["tambor", [48, 48, 36], [0, 48, 2]],
      ["puerta_ojo_de_buey", [46, 44, 12], [0, 50, 31]],
      ["motor", [20, 14, 11.5], [0, 12, -16]],
      ["correa", [10, 40, 2], [0, 32, -26]],
      ["capacitor_motor", [4.4, 8.5, 4.4], [16, 10, -18]],
      ["bomba", [12, 10, 9.6], [-20, 8, 16]],
      ["manguera_desagote", [30, 5.5, 2.6], [-14, 4, -26]],
      ["valvula_agua", [8, 5.6, 2.8], [20, 80, -26]],
      ["resistencia", [34, 4, 6], [0, 22, 2]],
      ["panel_control", [56, 8, 3], [0, 81, 29]],
      ["placa_control", [15, 2.5, 10], [16, 80, 12]],
    ]),
  ],
};

/** Microondas: gabinete, puerta, transformador, capacitor, ventilador y plato (el magnetrón no tiene forma: primitiva). */
export const planoMicroondas: PlanoDePiezas = {
  modelo: "Microondas genérico (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_microondas", [48, 28.8, 37.6], [0, 14.4, 0]),
    ...hijos("carcasa_microondas", [
      ["puerta", [36, 26, 4], [-5, 14.4, 20]],
      ["panel_control", [10, 26, 2], [19, 14.4, 19.5]],
      ["transformador", [10, 8, 9], [18, 5, -6]],
      ["capacitor", [4, 4, 9], [18, 4, 8]],
      ["ventilador_magnetron", [10, 10, 3.4], [18, 18, 10]],
      ["magnetron", [8, 9, 8], [18, 17, -6]],
      ["placa_control", [10, 1.5, 8], [18, 25, 8]],
      ["plato_giratorio", [30, 0.6, 30], [-5, 1.5, 0], "cilindro"],
      ["motor_plato", [5, 3, 5], [-5, -0.5, 0]],
    ]),
  ],
};

/** Aspiradora de mano (escoba): boquilla con cepillo y ruedas abajo, tubo, depósito con ciclón, filtro y motor arriba. */
export const planoAspiradora: PlanoDePiezas = {
  modelo: "Aspiradora genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("boquilla_suelo", [26, 10.4, 11], [0, 5.2, 8]),
    ...hijos("boquilla_suelo", [
      ["cepillo_rotativo", [24, 4.9, 4.9], [0, 3, 9]],
      ["rueda_goma_izquierda", [3.5, 8.2, 8.2], [-15, 4.1, 5]],
      ["rueda_goma_derecha", [3.5, 8.2, 8.2], [15, 4.1, 5]],
      ["manguera_tubo", [5, 50, 5], [0, 36, 4]],
      ["deposito_polvo", [12.8, 16.2, 12.6], [0, 70, 0]],
      ["separador_ciclon", [11.6, 13.3, 9.6], [0, 84.7, 0]],
      ["filtro_hepa", [12, 2, 8.8], [0, 92.4, 0]],
      ["motor", [9, 10, 8], [0, 98.5, 0]],
    ]),
  ],
};

/** Secador de pelo: cuerpo con mango, motor y ventilador atrás, resistencia en mica, boquilla y difusor. */
export const planoSecador: PlanoDePiezas = {
  modelo: "Secador de pelo genérico (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("carcasa_secador", [16, 18, 8.8], [0, 9, 0]),
    ...hijos("carcasa_secador", [
      ["motor", [3, 3, 4], [-5, 13, 0]],
      ["ventilador_axial", [5, 1.5, 5], [-3, 13, 0]],
      ["soporte_mica", [8, 4, 8], [3, 13, 0]],
      ["selector_deslizante", [4.5, 2.3, 1.7], [0, 5, 4.6]],
      ["boquilla_concentradora", [8, 7.6, 7.6], [12, 13, 0]],
      ["difusor_secador", [14.6, 8.6, 14.6], [-22, 4.3, 0]],
      ["cable_alimentacion", [30, 1, 2], [0, 0.5, 9]],
    ]),
  ],
};

/** Impresora de chorro de tinta sin carcasa: carro con cartuchos sobre el riel, encoder, rodillo y placa. */
export const planoImpresora: PlanoDePiezas = {
  modelo: "Impresora genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("bandeja_papel", [30, 2, 18], [0, 1, 0]),
    ...hijos("bandeja_papel", [
      ["riel_lineal", [32, 3, 3], [0, 13, -10]],
      ["cinta_encoder", [31.6, 1.2, 0.2], [0, 16, -11.8]],
      ["carro_impresion", [13, 6, 9.7], [-6, 13, -5]],
      ["cabezal_impresion", [7, 5, 5.2], [-6, 8.5, -5]],
      ["cartucho_tinta_negro", [4, 5.3, 3.6], [-8.5, 17.5, -5]],
      ["cartucho_tinta_color", [4, 5.3, 3.6], [-3.5, 17.5, -5]],
      ["rodillo_arrastre", [28, 2, 2], [0, 5, 2]],
      ["engranaje_arrastre", [0.7, 6, 6], [15, 5, 2]],
      ["motor_arrastre", [5, 4, 4], [18, 5, -4]],
      ["placa_control", [12, 1.5, 9], [10, 3, -14]],
      ["fuente", [14, 3, 8], [-10, 3.5, -14]],
    ]),
  ],
};

/** Consola de videojuegos sin carcasa (y un mando al lado): placa, blindaje, lectora, fuente y ventilador. */
export const planoConsola: PlanoDePiezas = {
  modelo: "Consola genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("placa_consola", [20, 1.2, 16.4], [-4, 0.6, 0]),
    ...hijos("placa_consola", [
      ["disipador", [8, 1, 8], [-6, 1.7, -1]],
      ["blindaje_metalico", [22, 1.2, 20], [-4, 4, 0]],
      ["unidad_optica", [14, 2.3, 14.7], [-4, 6.4, 0]],
      ["fuente", [10, 3, 14], [13, 1.5, 0]],
      ["ventilador", [8, 3, 8], [-17, 1.5, -5]],
      ["puerto_hdmi", [2, 0.8, 1.2], [2, 1.6, -8.4]],
      ["conector_usb_a", [1.6, 0.75, 1.6], [-10, 1.6, 8.4]],
      ["joystick_analogico_izquierdo", [2.5, 2.7, 2], [26, 1.4, 4]],
      ["joystick_analogico_derecho", [2.5, 2.7, 2], [33, 1.4, 6]],
      ["boton_gatillo_izquierdo", [4, 1.2, 2.5], [25, 0.6, -2]],
      ["boton_gatillo_derecho", [4, 1.2, 2.5], [34, 0.6, -2]],
    ]),
  ],
};

/** Router / módem: placa con antenas, puertos RJ45, coaxial, jaula SFP y botón de reset. */
export const planoRouter: PlanoDePiezas = {
  modelo: "Router genérico (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("placa_router", [12, 1.7, 9], [0, 0.9, 0]),
    ...hijos("placa_router", [
      ["antena_wifi_izquierda", [1.8, 18.6, 1.8], [-5, 11, -5.2]],
      ["antena_wifi_derecha", [1.8, 18.6, 1.8], [5, 11, -5.2]],
      ["puerto_rj45_1", [1.8, 1.6, 2.1], [-3.6, 2.5, -3.6]],
      ["puerto_rj45_2", [1.8, 1.6, 2.1], [-1.6, 2.5, -3.6]],
      ["puerto_rj45_3", [1.8, 1.6, 2.1], [0.4, 2.5, -3.6]],
      ["puerto_rj45_4", [1.8, 1.6, 2.1], [2.4, 2.5, -3.6]],
      ["conector_coaxial", [1.4, 1.6, 1.6], [4.6, 2.5, -3.6]],
      ["jaula_sfp", [1.7, 1.3, 6], [4.8, 2.4, 1]],
      ["boton_reset", [0.94, 0.68, 0.65], [-5.2, 2.1, -3.8]],
      ["blindaje_metalico", [5, 1.2, 4], [-1, 2.4, 1.5]],
    ]),
  ],
};

/** Cafetera espresso sin carcasa: depósito, bomba, caldera y bloque térmico, portafiltro, lanza de vapor y molino. */
export const planoCafetera: PlanoDePiezas = {
  modelo: "Cafetera espresso genérica (ejemplo del lab)",
  unidades: "cm",
  piezas: [
    pieza("bloque_termico", [12.8, 5.1, 6], [4, 13, -4]),
    ...hijos("bloque_termico", [
      ["deposito_agua", [12.5, 21.8, 8.5], [-12, 10.9, -8]],
      ["bomba", [8, 7, 7], [-6, 3.5, 2]],
      ["valvula_antirretorno", [7, 1.7, 2], [-6, 8, 2]],
      ["caldera_cafetera", [11, 13.4, 11], [4, 22.3, -4]],
      ["junta_portafiltro", [7, 0.8, 7], [4, 10, 3]],
      ["portafiltro", [16.7, 3.9, 6.4], [8, 7.5, 3]],
      ["filtro_cafe", [6, 2.5, 6], [4, 7.8, 3]],
      ["lanza_vapor", [5.3, 14, 1.4], [15, 7, 2]],
      ["molino_muelas", [9, 3, 9], [-4, 31, 4]],
      ["tolva_cafe", [12, 12, 12], [-4, 38.5, 4]],
    ]),
  ],
};
