-- Caché de manuales que encuentra y verifica el bibliotecario (carril A, Juanma).
-- Se aplica en el SQL Editor de Supabase (o con la CLI). Revisó: Iaio.

create table if not exists public.manuales (
  id uuid primary key default gen_random_uuid(),
  -- marca + modelo normalizados (mayúsculas, sin espacios ni guiones), para buscar
  clave text not null unique,
  marca text not null,
  modelo text not null,
  url text not null,
  titulo text not null,
  paginas_vista_explosionada integer[] not null default '{}',
  -- true = PDF real descargado y con citas de página verificadas al leerlo
  verificado boolean not null default false,
  fuente text not null check (fuente in ('fabricante', 'ifixit', 'otro')),
  creado_en timestamptz not null default now()
);

-- Sin políticas: solo el servidor (clave secreta) lee y escribe. El navegador no ve esta tabla.
alter table public.manuales enable row level security;
