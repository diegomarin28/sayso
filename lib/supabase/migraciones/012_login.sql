-- Login (carril C, Iaio; diseño en docs/login.md, issue #345). El dueño de cada caso pasa a ser
-- `auth.uid()` de la sesión de Supabase Auth (anónima o con email), no el `dispositivo` del celular.
-- `dispositivo` queda solo para el reclamo (lib/supabase/dueno.ts) y se borra en una migración posterior.
-- También crea `guias`: la copia fija de la guía y el plano 3D de cada caso (la escribe Login 3/3).
-- Se corre a mano en el SQL Editor, después de 001–011. Se puede correr varias veces.

alter table casos add column if not exists dueno uuid references auth.users (id) on delete cascade;
create index if not exists casos_dueno on casos (dueno, actualizado_en desc);
-- El reclamo busca por dispositivo los casos todavía sin dueño (el índice de la 007 ya lo cubre).

create table if not exists guias (
  caso_id text primary key references casos (id) on delete cascade,
  -- pack, manual, páginas y vista interior, validados con Zod antes de guardar
  preparado jsonb not null,
  -- PlanoDePiezas, origen y avisos
  plano jsonb,
  version integer not null default 1,
  creado_en timestamptz not null default now()
);

-- Solo el servidor (clave secreta) lee y escribe, como todo desde la 009.
alter table guias enable row level security;
revoke all on guias from anon, authenticated;
grant all on guias to service_role;

-- Resultado: casos.dueno es uuid; guias tiene rls = true, politicas = 0 y permisos_publicos = 0.
select 'casos.dueno' as que, data_type as detalle from information_schema.columns
where table_schema = 'public' and table_name = 'casos' and column_name = 'dueno'
union all
select 'guias', format('rls=%s politicas=%s permisos_publicos=%s', c.relrowsecurity,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'guias'),
  (select count(*) from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = 'guias' and g.grantee in ('anon', 'authenticated')))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'guias';
