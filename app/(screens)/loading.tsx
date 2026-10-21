import { Orbe, Pantalla } from "./_ui/experto";

/** Mientras llega la próxima pantalla (red lenta): el toque se nota enseguida, nunca queda en blanco. */
export default function Cargando() {
  return (
    <Pantalla>
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-texto-suave">
        <Orbe estado="pensando" tam={56} />
        <p className="text-sm">Un segundo…</p>
      </div>
    </Pantalla>
  );
}
