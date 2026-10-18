import { ProveedorFlujo } from "./_estado/flujo";
import { FondoSayso } from "./_ui/fondo-sayso";

export default function LayoutPantallas({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorFlujo>
      {/* La nebulosa y la pieza 3D que gira, detrás de todas las pantallas. */}
      <FondoSayso />
      {children}
    </ProveedorFlujo>
  );
}
