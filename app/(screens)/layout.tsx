import { ProveedorFlujo } from "./_estado/flujo";
import { FondoSayso } from "./_ui/fondo-sayso";
import { PantallaInicio } from "./_ui/pantalla-inicio";
import { SesionInicial } from "./_ui/sesion-inicial";

export default function LayoutPantallas({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorFlujo>
      {/* La nebulosa y la pieza 3D que gira, detrás de todas las pantallas. */}
      <FondoSayso />
      {/* Al abrir la app: el logo arma sus capas y se desvanece. */}
      <PantallaInicio />
      {/* La sesión anónima (cookie httpOnly) desde el primer uso, sin pedirle nada a la persona. */}
      <SesionInicial />
      {children}
    </ProveedorFlujo>
  );
}
