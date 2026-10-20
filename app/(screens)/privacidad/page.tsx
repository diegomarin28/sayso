import type { Metadata } from "next";
import { VERSION_LEGALES } from "../../../lib/supabase/credenciales";
import { PaginaLegal } from "../_ui/legal";

/**
 * Política de privacidad. BORRADOR: sale de docs/privacidad.md (#350) y de docs/login.md §5,
 * actualizado con Login 2/3. Lo revisan las personas antes de publicar (Ley 25.326).
 */

export const metadata: Metadata = { title: "Privacidad · Sayso" };

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Privacidad en Sayso" version={VERSION_LEGALES}>
      <p>
        Sayso te ayuda a reparar un equipo desde el celular. Para eso guarda algunos datos. Acá te contamos cuáles, para
        qué, dónde, cuánto tiempo y cómo borrarlos.
      </p>
      <p>
        <strong>Responsable de los datos:</strong> [COMPLETAR: razón social, CUIT y domicilio]
        <br />
        <strong>Contacto:</strong> [COMPLETAR: email]
      </p>

      <h2>Lo que no guardamos</h2>
      <ul>
        <li>Tu teléfono, tu dirección ni tu ubicación.</li>
        <li>
          Los datos ocultos de las fotos: se suben <strong>sin EXIF ni GPS</strong> (sin el lugar, la fecha ni el
          modelo del celular). Se sacan en tu celular y otra vez en nuestro servidor.
        </li>
        <li>Tu IP en claro (ver más abajo).</li>
      </ul>

      <h2>Lo que guardamos y para qué</h2>
      <ul>
        <li>
          <strong>Tu nombre, apellido y email</strong>, solo si creás una cuenta: para saludarte, iniciar sesión y
          recuperar tus casos en otro celular. No los ve nadie más ni van dentro de los casos.
        </li>
        <li>
          <strong>Tu contraseña</strong>, guardada cifrada por nuestro proveedor de cuentas (Supabase). Nadie de Sayso
          puede verla.
        </li>
        <li>
          <strong>Lo que contás del problema</strong>, escrito o dictado: para armar tu caso y la guía. Solo lo ves vos.
        </li>
        <li>
          <strong>Las fotos</strong>: para identificar el equipo y guiarte. Se guardan en un espacio privado y se
          muestran con un enlace que vence a los 5 minutos.
        </li>
        <li>
          <strong>La ficha del equipo</strong> (marca, modelo y número de serie). El número de serie identifica tu
          equipo, por eso lo tratamos como dato personal.
        </li>
        <li>
          <strong>Los eventos del caso</strong>: qué pasos se hicieron y cómo terminó.
        </li>
        <li>
          <strong>Tu IP, solo transformada</strong> (un hash que cambia cada día): para poner topes de uso y frenar
          abusos. No se puede volver a leer la IP.
        </li>
        <li>
          <strong>Qué versión de estos textos aceptaste y cuándo</strong>, al crear la cuenta.
        </li>
      </ul>
      <p>Ninguna otra persona que use Sayso puede ver tus casos.</p>

      <h2>Cómo te reconocemos</h2>
      <p>
        Al abrir Sayso se crea una <strong>sesión anónima</strong>: una identificación al azar, sin email ni nombre,
        guardada en una cookie que el código de la página no puede leer. Tus casos quedan en esa sesión. Si creás una
        cuenta, esa misma sesión pasa a tener tu email, y confirmás que es tuyo con un código de 6 dígitos. Antes de
        crear la sesión y de iniciar sesión hacemos una verificación de Cloudflare Turnstile contra robots.
      </p>

      <h2>Dónde se guardan</h2>
      <ul>
        <li>
          <strong>En nuestro servidor</strong> (Supabase, en San Pablo, Brasil): tu cuenta, tus casos, fotos, fichas y
          eventos.
        </li>
        <li>
          <strong>En tu celular</strong>: una copia de tus últimos 30 casos, con la guía y el 3D, para abrirlos rápido
          y sin conexión. Se borra si borrás los datos del navegador.
        </li>
      </ul>

      <h2>Con quién se comparten</h2>
      <p>Usamos servicios de terceros y les mandamos solo lo necesario:</p>
      <ul>
        <li>
          <strong>Anthropic (Claude)</strong>, la inteligencia artificial: recibe lo que contás, las fotos y la ficha
          para identificar el equipo y responderte.
        </li>
        <li>
          <strong>ElevenLabs</strong>, solo si usás la voz: recibe el audio que dictás y el texto que se lee en voz alta.
        </li>
        <li>
          <strong>Supabase</strong>, donde se guardan los datos y las cuentas.
        </li>
        <li>
          <strong>Resend</strong>, que manda los mails con los códigos: recibe tu email.
        </li>
        <li>
          <strong>Cloudflare Turnstile</strong>, la verificación contra robots: analiza señales de tu navegador.
        </li>
        <li>
          <strong>Vercel</strong>, donde está alojada la app.
        </li>
      </ul>
      <p>
        [COMPLETAR: transferencia internacional de datos y qué hace cada proveedor con lo que recibe, según sus
        términos] No vendemos tus datos ni los usamos para publicidad. [COMPLETAR: confirmar]
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <ul>
        <li>
          <strong>Sin cuenta</strong> (sesión anónima): [COMPLETAR: hoy no vencen; está previsto borrarlas con sus
          casos y fotos después de 90 días sin actividad].
        </li>
        <li>
          <strong>Con cuenta</strong>: hasta que la borres.
        </li>
        <li>
          <strong>El hash de tu IP</strong>: 2 días.
        </li>
      </ul>

      <h2>Cómo borrar o llevarte tus datos</h2>
      <ul>
        <li>
          <strong>Borrar tu cuenta</strong>: en Cuenta → Borrar cuenta. Borra tu cuenta, tus casos, fotos, fichas y
          eventos. No se puede deshacer.
        </li>
        <li>
          <strong>Descargar una copia</strong>: en Cuenta → Tus datos. Un archivo con tu cuenta, tus casos, fichas y
          eventos, y enlaces a tus fotos que vencen a los pocos minutos.
        </li>
        <li>
          <strong>La copia de tu celular</strong>: se borra borrando los datos del navegador para Sayso.
        </li>
      </ul>
      <p>
        También podés pedir acceso, corrección o borrado escribiendo a [COMPLETAR: email]. [COMPLETAR: plazo de
        respuesta, derechos de la Ley 25.326 y la autoridad de control (Agencia de Acceso a la Información Pública)]
      </p>

      <h2>Cambios</h2>
      <p>Si cambiamos esta política, lo avisamos en la app. [COMPLETAR: cómo y con cuánta anticipación]</p>
    </PaginaLegal>
  );
}
