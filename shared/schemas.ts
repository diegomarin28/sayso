import { z } from "zod";

/**
 * CONTRATOS COMPARTIDOS — dueño: Diego.
 * Se cambian solo por PR con etiqueta "contrato" y aviso al grupo.
 * Toda salida de un modelo de IA debe pasar por estos esquemas.
 */

export const ClaseEquipo = z.enum(["notebook", "split", "lavarropas", "otro"]);
export type ClaseEquipo = z.infer<typeof ClaseEquipo>;

/** Qué tan seguro está el sistema de un dato. */
export const EstadoDato = z.enum(["confirmado", "probable", "desconocido"]);
export type EstadoDato = z.infer<typeof EstadoDato>;

export const Riesgo = z.enum(["bajo", "medio", "alto"]);
export type Riesgo = z.infer<typeof Riesgo>;

export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;

/** Un dato con su estado. Nunca se muestra un valor sin su estado. */
export const Campo = z.object({
  valor: z.string().nullable(),
  estado: EstadoDato,
  fuente: z.string().optional(), // ej. "chapa", "usuario", "deducido"
});
export type Campo = z.infer<typeof Campo>;

// ---------- Caso y fotos ----------

export const EstadoCaso = z.enum([
  "captura",
  "identificando",
  "preparando",
  "guia",
  "cerrado",
]);

export const Caso = z.object({
  id: z.string(),
  clase: ClaseEquipo,
  sintoma: z.string(),
  estado: EstadoCaso,
  creadoEn: z.string(), // ISO 8601
});
export type Caso = z.infer<typeof Caso>;

export const TipoFoto = z.enum(["frente", "etiqueta", "interior", "puertos", "otro"]);

export const Foto = z.object({
  id: z.string(),
  casoId: z.string(),
  tipoPedido: TipoFoto,
  url: z.string(),
  calidad: z.object({
    nitidez: z.number().min(0).max(1),
    encuadreOk: z.boolean(),
  }),
  aceptada: z.boolean(),
  motivoRechazo: z.string().optional(),
});
export type Foto = z.infer<typeof Foto>;

/** Lo que la IA decide pedir a continuación. */
export const PedidoDeFoto = z.object({
  tipo: TipoFoto,
  instruccion: z.string(),
  advertencia: z.string().optional(), // ej. "apagá y desenchufá antes"
});
export type PedidoDeFoto = z.infer<typeof PedidoDeFoto>;

// ---------- Ficha ----------

export const Ficha = z.object({
  casoId: z.string(),
  clase: ClaseEquipo,
  marca: Campo,
  modelo: Campo,
  serie: Campo,
  anio: Campo,
  confirmadaPorUsuario: z.boolean(),
});
export type Ficha = z.infer<typeof Ficha>;

// ---------- Conocimiento del equipo ----------

export const EstadoCita = z.enum(["VERIFICADO", "NO_ENCONTRADO", "NO_VERIFICABLE"]);

export const Cita = z.object({
  doc: z.string(),
  pagina: z.number().int().positive().optional(),
  url: z.string().optional(),
  estado: EstadoCita,
});
export type Cita = z.infer<typeof Cita>;

export const Pieza = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/), // nombre del nodo en el GLB
  nombre: z.string(),
  descripcion: z.string(),
  ubicacion: z.string(), // en palabras, ej. "sobre el disipador"
  etiquetaManual: z.string().optional(), // número en la vista explosionada
});
export type Pieza = z.infer<typeof Pieza>;

export const PasoReparacion = z.object({
  id: z.string(),
  orden: z.number().int().positive(),
  texto: z.string(),
  piezas: z.array(z.string()), // ids de Pieza
  riesgo: Riesgo,
  cita: Cita.optional(),
});
export type PasoReparacion = z.infer<typeof PasoReparacion>;

export const Repuesto = z.object({
  pieza: z.string(),
  numeroParte: z.string(), // solo si aparece en el texto del manual
  cita: Cita,
});

export const KnowledgePack = z.object({
  modelo: z.string(),
  clase: ClaseEquipo,
  verificado: z.boolean(), // false = guía pública, mostrar NO VERIFICADO
  fuentes: z.array(z.object({ doc: z.string(), url: z.string().optional() })),
  piezas: z.array(Pieza),
  pasos: z.array(PasoReparacion),
  advertencias: z.array(z.string()),
  repuestos: z.array(Repuesto),
});
export type KnowledgePack = z.infer<typeof KnowledgePack>;

// ---------- 3D ----------

export const FormaPieza = z.enum(["caja", "cilindro", "extrusion"]);

export const PiezaPlano = z.object({
  pieza: z.string(), // id de Pieza
  forma: FormaPieza,
  dim: Vec3, // ancho, alto, profundidad (unidades del plano)
  pos: Vec3,
  pivote: Vec3,
  padre: z.string().optional(),
  etiquetaManual: z.string().optional(),
  cita: Cita.optional(),
});
export type PiezaPlano = z.infer<typeof PiezaPlano>;

/** Lo que la IA devuelve para que el navegador construya el 3D. */
export const PlanoDePiezas = z.object({
  modelo: z.string(),
  unidades: z.literal("cm"),
  piezas: z.array(PiezaPlano),
});
export type PlanoDePiezas = z.infer<typeof PlanoDePiezas>;

// ---------- Coreografía ----------

export const Eje = z.enum(["x", "y", "z"]);

export const Accion = z.discriminatedUnion("t", [
  z.object({ t: z.literal("camara"), objetivo: z.string(), zoom: z.number().positive().optional() }),
  z.object({ t: z.literal("resaltar"), pieza: z.string() }),
  z.object({ t: z.literal("rotar"), pieza: z.string(), eje: Eje, grados: z.number() }),
  z.object({ t: z.literal("desplazar"), pieza: z.string(), vec: Vec3 }),
  z.object({ t: z.literal("ocultar"), pieza: z.string() }),
  z.object({ t: z.literal("despiezar"), cantidad: z.number().min(0).max(1) }),
  z.object({ t: z.literal("restaurar") }),
]);
export type Accion = z.infer<typeof Accion>;

export const Coreografia = z.object({
  paso: z.number().int().positive(),
  dice: z.string(),
  cita: Cita.optional(),
  acciones: z.array(Accion),
  riesgo: Riesgo,
  /** Opcional: id de la pieza que conviene reemplazar (lo decide la IA con el manual). Abre las opciones de compra. */
  cambiar: z.string().regex(/^[a-z0-9_]+$/).optional(),
});
export type Coreografia = z.infer<typeof Coreografia>;

// ---------- Feed de actividad ----------

export const Agente = z.enum([
  "recepcion",
  "identificador",
  "bibliotecario",
  "cartografo",
  "experto",
  "seguridad",
  "compras",
]);

export const Evento = z.object({
  id: z.string(),
  casoId: z.string(),
  agente: Agente,
  tipo: z.string(), // ej. "foto_rechazada", "modelo_confirmado", "paso_bloqueado"
  mensaje: z.string(),
  ts: z.string(), // ISO 8601
  datos: z.record(z.string(), z.unknown()).optional(),
});
export type Evento = z.infer<typeof Evento>;
