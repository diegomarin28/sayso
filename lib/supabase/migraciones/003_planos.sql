-- Caché del plano 3D (carril B, Diego): un plano por marca + modelo, generado por el cartógrafo
-- (/api/plano) leyendo el manual. Se corre a mano en el SQL Editor, después de 001 y 002.
-- Se puede correr varias veces.

create table if not exists planos (
  -- marca + modelo normalizados, igual que la tabla manuales (claveManual de lib/knowledge/manuales.ts)
  clave text primary key,
  marca text not null,
  modelo text not null,
  -- PlanoDePiezas (shared/schemas.ts), validado con Zod antes de guardar
  plano jsonb not null,
  -- correcciones que hizo el código sobre la propuesta de la IA
  avisos jsonb not null default '[]',
  -- ids de pieza que se pidieron al generarlo (para saber si sirve para otro pack del mismo modelo)
  piezas_pedidas text[] not null default '{}',
  manual_url text,
  creado_en timestamptz not null default now()
);

-- Solo el servidor (clave secreta) lee y escribe; el navegador no ve esta tabla.
alter table planos enable row level security;
revoke all on planos from anon, authenticated;

-- Resultado: rls = true y 0 políticas.
select c.relname as tabla, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.tablename = c.relname) as politicas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'planos';
