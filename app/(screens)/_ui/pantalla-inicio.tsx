import { LEMA, NOMBRE_PRODUCTO, Simbolo } from "./marca";

/**
 * Pantalla de carga al abrir la app: el celular del logo arma sus capas, aparece el nombre y se
 * desvanece. Es solo CSS (globals.css, .inicio): se ve desde el primer instante, sin esperar el
 * JavaScript, y no vuelve a aparecer al pasar de una pantalla a otra (el layout no se desmonta).
 */
export function PantallaInicio() {
  return (
    <div className="inicio" aria-hidden>
      <div className="flex flex-col items-center gap-5">
        <Simbolo tam={132} />
        <p className="inicio-nombre text-5xl font-extrabold tracking-tight">{NOMBRE_PRODUCTO}</p>
        <p className="inicio-lema max-w-xs px-6 text-center text-sm text-texto-suave">{LEMA}</p>
      </div>
    </div>
  );
}
