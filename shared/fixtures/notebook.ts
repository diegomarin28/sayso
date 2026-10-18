import type {
  Caso,
  Coreografia,
  Evento,
  Ficha,
  Foto,
  KnowledgePack,
  PlanoDePiezas,
} from "../schemas";

/**
 * FIXTURES — un caso completo de notebook para trabajar sin esperar a los demás.
 * Los datos son FICTICIOS (marca y modelo de ejemplo). No son de un equipo real.
 */

export const casoEjemplo: Caso = {
  id: "caso-demo-1",
  clase: "notebook",
  sintoma: "Se apaga sola a los diez minutos y el ventilador suena muy fuerte.",
  estado: "guia",
  creadoEn: "2026-10-17T15:00:00.000Z",
};

export const fotosEjemplo: Foto[] = [
  {
    id: "foto-1",
    casoId: "caso-demo-1",
    tipoPedido: "etiqueta",
    url: "/fixtures/etiqueta-movida.jpg",
    calidad: { nitidez: 0.3, encuadreOk: true },
    aceptada: false,
    motivoRechazo: "La foto salió movida; no se lee el número de serie.",
  },
  {
    id: "foto-2",
    casoId: "caso-demo-1",
    tipoPedido: "etiqueta",
    url: "/fixtures/etiqueta-ok.jpg",
    calidad: { nitidez: 0.9, encuadreOk: true },
    aceptada: true,
  },
];

export const fichaEjemplo: Ficha = {
  casoId: "caso-demo-1",
  clase: "notebook",
  marca: { valor: "EJEMPLO", estado: "confirmado", fuente: "chapa" },
  modelo: { valor: "NB-15 (ficticio)", estado: "confirmado", fuente: "chapa" },
  serie: { valor: "SN-0000-DEMO", estado: "probable", fuente: "chapa" },
  anio: { valor: null, estado: "desconocido" },
  confirmadaPorUsuario: true,
};

export const knowledgePackEjemplo: KnowledgePack = {
  modelo: "EJEMPLO NB-15 (ficticio)",
  clase: "notebook",
  verificado: true,
  fuentes: [{ doc: "Manual de mantenimiento (ficticio)" }],
  piezas: [
    { id: "base", nombre: "Carcasa inferior", descripcion: "Base que contiene todo.", ubicacion: "abajo de todo" },
    { id: "tapa_inferior", nombre: "Tapa inferior", descripcion: "Tapa de abajo, con tornillos.", ubicacion: "abajo, cubre todo el interior", etiquetaManual: "1" },
    { id: "placa_madre", nombre: "Placa madre", descripcion: "Placa principal.", ubicacion: "centro" },
    { id: "disipador", nombre: "Disipador", descripcion: "Conduce el calor del procesador.", ubicacion: "sobre el procesador", etiquetaManual: "6" },
    { id: "ventilador", nombre: "Ventilador", descripcion: "Expulsa el aire caliente.", ubicacion: "sobre el disipador, a la derecha del procesador", etiquetaManual: "7" },
    { id: "ssd", nombre: "Disco SSD", descripcion: "Almacenamiento.", ubicacion: "izquierda de la placa", etiquetaManual: "4" },
    { id: "ram", nombre: "Memoria RAM", descripcion: "Módulo de memoria.", ubicacion: "bajo la tapa, junto al SSD", etiquetaManual: "5" },
    { id: "bateria", nombre: "Batería", descripcion: "Alimenta el equipo.", ubicacion: "parte delantera", etiquetaManual: "2" },
    { id: "wifi", nombre: "Tarjeta Wi-Fi", descripcion: "Conexión inalámbrica.", ubicacion: "esquina superior izquierda", etiquetaManual: "8" },
    { id: "tornillos_ventilador", nombre: "Tornillos del ventilador", descripcion: "Dos tornillos que lo sujetan.", ubicacion: "en el borde del ventilador" },
  ],
  pasos: [
    {
      id: "paso-1",
      orden: 1,
      texto: "Apagá, desenchufá y quitá la tapa inferior.",
      piezas: ["base"],
      riesgo: "bajo",
      cita: { doc: "Manual de mantenimiento (ficticio)", pagina: 52, estado: "VERIFICADO" },
    },
    {
      id: "paso-2",
      orden: 2,
      texto: "Aflojá los dos tornillos del ventilador y levantalo despacio.",
      piezas: ["ventilador", "tornillos_ventilador"],
      riesgo: "bajo",
      cita: { doc: "Manual de mantenimiento (ficticio)", pagina: 54, estado: "VERIFICADO" },
    },
  ],
  advertencias: ["No abras ni perfores la batería."],
  repuestos: [],
};

export const planoEjemplo: PlanoDePiezas = {
  modelo: "EJEMPLO NB-15 (ficticio)",
  unidades: "cm",
  piezas: [
    { pieza: "base", forma: "caja", dim: [36, 1.2, 25], pos: [0, 0, 0], pivote: [0, 0, 0] },
    { pieza: "placa_madre", forma: "caja", dim: [30, 0.4, 20], pos: [0, 1, 0], pivote: [0, 0, 0], padre: "base" },
    { pieza: "disipador", forma: "caja", dim: [8, 0.8, 5], pos: [4, 1.6, -2], pivote: [0, 0, 0], padre: "placa_madre", etiquetaManual: "6" },
    { pieza: "ventilador", forma: "cilindro", dim: [5, 0.8, 5], pos: [10, 1.6, -2], pivote: [0, 0, 0], padre: "placa_madre", etiquetaManual: "7" },
    { pieza: "ssd", forma: "caja", dim: [8, 0.3, 2.2], pos: [-10, 1.4, 4], pivote: [0, 0, 0], padre: "placa_madre", etiquetaManual: "4" },
    { pieza: "ram", forma: "caja", dim: [7, 0.3, 2.6], pos: [-8, 1.4, 0], pivote: [0, 0, 0], padre: "placa_madre", etiquetaManual: "5" },
    { pieza: "bateria", forma: "caja", dim: [26, 0.8, 6], pos: [0, 1.0, 8.5], pivote: [0, 0, 0], padre: "base", etiquetaManual: "2" },
    { pieza: "wifi", forma: "caja", dim: [3, 0.2, 2.5], pos: [-12, 1.4, -6], pivote: [0, 0, 0], padre: "placa_madre", etiquetaManual: "8" },
    { pieza: "tornillos_ventilador", forma: "cilindro", dim: [0.4, 0.4, 0.4], pos: [12.5, 2.1, -2], pivote: [0, 0, 0], padre: "ventilador" },
    // La notebook se ve dada vuelta: la tapa de abajo queda arriba y el 3D arranca cerrado.
    { pieza: "tapa_inferior", forma: "caja", dim: [36, 0.3, 25], pos: [0, 2.5, 0], pivote: [0, 0, 0], padre: "base", etiquetaManual: "1" },
  ],
};

/**
 * La guía de ejemplo (modo fixture, sin IA): qué hacer, cómo y qué vas a ver, desde apagar hasta limpiar
 * el ventilador. Al final, la pantalla suma "probalo" y "si sigue igual, cambiá esta pieza" (#124).
 */
export const coreografiaEjemplo: Coreografia[] = [
  {
    paso: 1,
    dice: "Apagá la notebook y desenchufá el cargador. Si está caliente, esperá unos minutos: vas a trabajar con ella apagada.",
    cita: { doc: "Manual de mantenimiento (ficticio)", pagina: 52, estado: "VERIFICADO" },
    acciones: [{ t: "camara", objetivo: "general" }],
    riesgo: "bajo",
  },
  {
    paso: 2,
    dice: "Dala vuelta sobre un paño y sacá los tornillos de la tapa de abajo. Levantala desde el borde de las bisagras: vas a ver la batería adelante y el ventilador a la derecha.",
    cita: { doc: "Manual de mantenimiento (ficticio)", pagina: 52, estado: "VERIFICADO" },
    acciones: [
      { t: "camara", objetivo: "general" },
      { t: "rotar", pieza: "tapa_inferior", eje: "x", grados: -100 },
    ],
    riesgo: "bajo",
  },
  {
    paso: 3,
    dice: "Antes de tocar nada, desconectá la batería: tirá del conector hacia afuera, derecho y sin hacer palanca sobre la batería.",
    cita: { doc: "Manual de mantenimiento (ficticio)", pagina: 53, estado: "VERIFICADO" },
    acciones: [
      { t: "camara", objetivo: "bateria", zoom: 1.4 },
      { t: "resaltar", pieza: "bateria" },
    ],
    riesgo: "bajo",
  },
  {
    paso: 4,
    dice: "Este es el ventilador: es el que suena fuerte. Lo sostienen dos tornillos en el borde.",
    cita: { doc: "Manual de mantenimiento (ficticio)", pagina: 54, estado: "VERIFICADO" },
    acciones: [
      { t: "camara", objetivo: "ventilador", zoom: 1.6 },
      { t: "resaltar", pieza: "ventilador" },
    ],
    riesgo: "bajo",
  },
  {
    paso: 5,
    dice: "Aflojá los dos tornillos y levantá el ventilador despacio. Limpiá el polvo de las aspas y de la salida de aire con un pincel seco.",
    cita: { doc: "Manual de mantenimiento (ficticio)", pagina: 54, estado: "VERIFICADO" },
    acciones: [
      { t: "resaltar", pieza: "tornillos_ventilador" },
      { t: "rotar", pieza: "ventilador", eje: "y", grados: 180 },
      { t: "desplazar", pieza: "ventilador", vec: [0, 4, 0] },
    ],
    riesgo: "bajo",
  },
];

export const eventosEjemplo: Evento[] = [
  {
    id: "ev-1",
    casoId: "caso-demo-1",
    agente: "recepcion",
    tipo: "foto_rechazada",
    mensaje: "La foto de la etiqueta salió movida. Pedí repetirla.",
    ts: "2026-10-17T15:01:00.000Z",
  },
  {
    id: "ev-2",
    casoId: "caso-demo-1",
    agente: "identificador",
    tipo: "modelo_confirmado",
    mensaje: "Modelo leído de la chapa y confirmado por la persona.",
    ts: "2026-10-17T15:02:00.000Z",
  },
];
