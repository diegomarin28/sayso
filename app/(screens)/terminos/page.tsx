import type { Metadata } from "next";
import Link from "next/link";
import { VERSION_LEGALES } from "../../../lib/supabase/credenciales";
import { PaginaLegal } from "../_ui/legal";

/**
 * Términos y condiciones. BORRADOR escrito a partir de lo que hace el producto (CONTEXT.md, CLAUDE.md
 * §1 y §6): lo revisan y completan las personas antes de publicar. Ningún agente lo da por bueno.
 */

export const metadata: Metadata = { title: "Términos y condiciones · Sayso" };

export default function Terminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones" version={VERSION_LEGALES}>
      <p>
        Estos términos regulan el uso de Sayso. Al crear una cuenta, o al usar la app, aceptás estos términos y la{" "}
        <Link href="/privacidad" className="underline">
          Política de privacidad
        </Link>
        .
      </p>
      <p>
        <strong>Quién ofrece Sayso:</strong> Sayso es hoy una <strong>demo de prueba</strong> de un proyecto en
        desarrollo, para ver si puede ser un producto. Todavía no hay una empresa constituida detrás.
        <br />
        <strong>Contacto:</strong> durante la demo, podés borrar tu cuenta y tus datos desde Cuenta.
      </p>

      <h2>Qué es Sayso</h2>
      <p>
        Sayso es una guía para reparar equipos del hogar desde el celular. Contás qué se rompió, sacás fotos, confirmás
        el equipo y recibís una guía paso a paso, con un modelo 3D y un asistente que responde preguntas. Se puede usar
        sin cuenta; la cuenta sirve para guardar tus casos y retomarlos en otro celular.
      </p>

      <h2>Lo que Sayso no es</h2>
      <ul>
        <li>
          <strong>No es un servicio técnico ni reemplaza a un profesional.</strong> La guía la arma una inteligencia
          artificial a partir de manuales y fuentes públicas, y puede equivocarse o estar incompleta.
        </li>
        <li>
          <strong>El modelo 3D es una aproximación</strong> para orientarte: no es una reconstrucción exacta de tu
          equipo, salvo que la app diga otra cosa.
        </li>
        <li>
          La app marca qué datos están confirmados y cuáles son probables o desconocidos, y cita de dónde salió cada
          instrucción cuando puede. Revisalos antes de actuar.
        </li>
      </ul>

      <h2>Seguridad</h2>
      <p>
        Hay arreglos peligrosos: electricidad de red, capacitores, baterías hinchadas o dañadas, gas y refrigerantes,
        entre otros. Cuando detecta uno, Sayso <strong>frena la guía y te recomienda un técnico</strong>. No intentes
        esos pasos por tu cuenta. Antes de abrir un equipo, desenchufalo y seguí las indicaciones del fabricante.
      </p>
      <p>
        Hacés cada reparación bajo tu responsabilidad. Como es una demo gratuita, Sayso se ofrece tal cual está, sin
        garantías.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Usá un email tuyo y una contraseña que no uses en otros sitios. Cuidá tu contraseña.</li>
        <li>Podés borrar tu cuenta y tus datos cuando quieras, desde Cuenta.</li>
        <li>
          Podemos suspender cuentas que se usen para abusar del servicio (por ejemplo, de forma automatizada o para
          sobrecargarlo).
        </li>
      </ul>

      <h2>Uso permitido</h2>
      <ul>
        <li>No subas fotos ni textos de otras personas sin su permiso, ni contenido ilegal.</li>
        <li>No uses Sayso para dañar a otros ni para intentar saltear sus protecciones.</li>
      </ul>

      <h2>Contenido de terceros</h2>
      <p>
        Las guías pueden usar manuales de fabricantes y fuentes públicas, cada una con su propia licencia, que se cita
        en la app. Al ser una demo sin fines comerciales, no se vende nada con ese contenido.
      </p>

      <h2>Precio</h2>
      <p>Hoy Sayso es gratis. Si eso cambia, se avisa antes.</p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos estos términos, lo avisamos en la app y te pedimos que los aceptes de nuevo.
      </p>

      <h2>Ley aplicable</h2>
      <p>Al ser una demo sin empresa constituida, todavía no se define una ley aplicable ni una jurisdicción.</p>
    </PaginaLegal>
  );
}
