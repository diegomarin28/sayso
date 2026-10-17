-- Esquema base de Experto al lado. Se corre una vez en el SQL Editor de Supabase.
-- Cada fila guarda el objeto entero validado por Zod en `datos` (contratos de shared/),
-- más algunas columnas sueltas para filtrar. Escribe solo el servidor (clave secreta);
-- el navegador solo puede leer eventos (para el feed en vivo).

create table if not exists casos (
  id text primary key,
  clase text not null,
  sintoma text not null,
  estado text not null,
  creado_en timestamptz not null default now(),
  datos jsonb not null
);

create table if not exists fotos (
  id text primary key,
  caso_id text not null references casos (id) on delete cascade,
  tipo_pedido text not null,
  aceptada boolean not null,
  creado_en timestamptz not null default now(),
  datos jsonb not null
);
create index if not exists fotos_caso on fotos (caso_id);

create table if not exists fichas (
  caso_id text primary key references casos (id) on delete cascade,
  confirmada boolean not null default false,
  actualizado_en timestamptz not null default now(),
  datos jsonb not null
);

create table if not exists eventos (
  id text primary key,
  caso_id text not null references casos (id) on delete cascade,
  agente text not null,
  tipo text not null,
  mensaje text not null,
  ts timestamptz not null,
  datos jsonb
);
create index if not exists eventos_caso_ts on eventos (caso_id, ts);

-- Caché del knowledge pack (carril A): un armado por marca + modelo + síntoma.
create table if not exists knowledge_packs (
  clave text primary key,
  creado_en timestamptz not null default now(),
  armado jsonb not null
);

alter table casos enable row level security;
alter table fotos enable row level security;
alter table fichas enable row level security;
alter table eventos enable row level security;
alter table knowledge_packs enable row level security;

drop policy if exists "eventos visibles" on eventos;
create policy "eventos visibles" on eventos for select to anon, authenticated using (true);

-- Feed en vivo.
do $$
begin
  alter publication supabase_realtime add table eventos;
exception when duplicate_object then null;
end $$;

-- Fotos del usuario: bucket público con rutas imposibles de adivinar (caso/foto con UUID).
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;
