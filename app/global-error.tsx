"use client";

/**
 * Último recurso: se rompió el layout de la app. Reemplaza todo el documento, así que no hereda
 * `globals.css`: los colores son los de la identidad (fondo, texto y --acento) escritos acá.
 */
export default function ErrorGlobal({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          background: "#0e1a24",
          color: "#e8f0f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div role="alert">
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Sayso se trabó.</h1>
          <p style={{ margin: 0, color: "#9db3c2" }}>No se perdió nada de lo que hiciste. Probá de nuevo.</p>
        </div>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            height: 56,
            border: 0,
            borderRadius: 16,
            background: "#ffb020",
            color: "#000",
            fontSize: 17,
            fontWeight: 600,
          }}
        >
          Probar de nuevo
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- el router puede estar roto: recarga completa */}
        <a href="/" style={{ color: "#9db3c2", textAlign: "center", padding: 12 }}>
          Ir al inicio
        </a>
      </body>
    </html>
  );
}
