import { ImageResponse } from "next/og";

// Los mismos que NOMBRE_PRODUCTO y LEMA de (screens)/_ui/marca.tsx (es un módulo de cliente: no se importa acá).
const NOMBRE_PRODUCTO = "Sayso";
const LEMA = "Contale qué se rompió con tu voz. Te guío con el manual de tu equipo, en 3D.";

/** La imagen de la vista previa del link (WhatsApp, mail, redes): el nombre y el lema, con los colores de la app. */
export const alt = `${NOMBRE_PRODUCTO}: ${LEMA}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0e1a24",
          backgroundImage: "radial-gradient(60% 60% at 25% 30%, rgba(139,107,255,0.22), transparent 70%)",
          color: "#ffffff",
        }}
      >
        {/* El celular en capas del logo, simplificado: tres placas grises. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 48 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 120, height: 22, borderRadius: 8, background: "#a3b1bd", opacity: 1 - i * 0.25, marginLeft: i * 14 }} />
          ))}
        </div>
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4 }}>{NOMBRE_PRODUCTO}</div>
        <div style={{ fontSize: 44, color: "#9db3c2", marginTop: 20, maxWidth: 980, lineHeight: 1.25 }}>{LEMA}</div>
        <div style={{ width: 160, height: 10, borderRadius: 5, background: "#ffb020", marginTop: 48 }} />
      </div>
    ),
    size,
  );
}
