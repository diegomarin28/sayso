import { ProveedorFlujo } from "./_estado/flujo";
import { FondoSayso } from "./_ui/fondo-sayso";
import { PantallaInicio } from "./_ui/pantalla-inicio";

export default function LayoutPantallas({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorFlujo>
      {/* La nebulosa y la pieza 3D que gira, detrás de todas las pantallas. */}
      <FondoSayso />
      {/* Al abrir la app: el logo arma sus capas y se desvanece. */}
      <PantallaInicio />
      {children}
    </ProveedorFlujo>
  );
}
