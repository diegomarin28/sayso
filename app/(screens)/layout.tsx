import { ProveedorFlujo } from "./_estado/flujo";
import { ActivadorDemo } from "./_ui/activador-demo";

export default function LayoutPantallas({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorFlujo>
      {children}
      <ActivadorDemo />
    </ProveedorFlujo>
  );
}
