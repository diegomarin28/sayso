import Link from "next/link";
import { DiceExperto, Flecha, Pantalla } from "./(screens)/_ui/experto";

export default function NoEncontrada() {
  return (
    <Pantalla>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <DiceExperto texto="Esa página no existe." />
        <p className="text-base text-texto-suave">Puede que el link esté viejo. Empezá de nuevo desde el inicio.</p>
      </div>
      <Link
        href="/"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-acento text-lg font-semibold text-black transition active:scale-[0.98]"
      >
        Ir al inicio <Flecha />
      </Link>
    </Pantalla>
  );
}
