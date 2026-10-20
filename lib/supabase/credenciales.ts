import { z } from "zod";

/**
 * Reglas de email y contraseña (docs/login.md §2). Las usan las rutas de `app/api/cuenta` y la
 * pantalla de cuenta, para avisar antes de mandar. Supabase vuelve a revisar la contraseña con su
 * propia regla (Authentication → Sign In / Providers → Email → Password requirements), que tiene
 * que ser la misma: 8 o más, con letras y números.
 */

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** 72 es el máximo que usa bcrypt (Supabase): más largo se cortaría sin avisar. */
export const Contrasena = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/)
  .regex(/\d/);

/** Nombre o apellido: letras (con tildes), espacios, apóstrofo y guion. Para el saludo ("Hola, Ana"). */
export const Nombre = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/);

/**
 * Versión de los Términos y la Política de privacidad (páginas /terminos y /privacidad). Al crear la
 * cuenta se guarda cuál aceptó la persona y cuándo. Cambiarla cuando cambie el texto.
 */
export const VERSION_LEGALES = "borrador-2026-10-20";

export const REGLA_CONTRASENA = "8 o más caracteres, con letras y números.";

export const emailValido = (email: string) => Email.safeParse(email).success;
export const nombreValido = (n: string) => Nombre.safeParse(n).success;
export const contrasenaValida = (c: string) => Contrasena.safeParse(c).success;
