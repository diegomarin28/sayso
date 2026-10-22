import { ProveedorFlujo } from "./_estado/flujo";
import { AvisoSinConexion } from "./_ui/aviso-sin-conexion";
import { PantallaInicio } from "./_ui/pantalla-inicio";
import { SesionInicial } from "./_ui/sesion-inicial";

export default function LayoutPantallas({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorFlujo>
      {/* El fondo (la cuadrícula) es CSS: body::before en globals.css. */}
      {/* Al abrir la app: el logo arma sus capas y se desvanece. */}
      <PantallaInicio />
      {/* La sesión anónima (cookie httpOnly) desde el primer uso, sin pedirle nada a la persona. */}
      <SesionInicial />
      <AvisoSinConexion />
      {children}
    </ProveedorFlujo>
  );
}
