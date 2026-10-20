-- Todo Supabase solo para el servidor (carril C, Iaio). Ninguna pantalla usa la clave pública:
-- se cierra la lectura pública de `eventos` (política "eventos visibles" de 001/002 y Realtime) y
-- todas las tablas de `public`, también las que se creen después, quedan sin permisos para
-- `anon` y `authenticated`. El servidor usa la clave secreta (service_role) y sigue igual.
-- Se corre a mano en el SQL Editor, después de 001–008. Se puede correr varias veces.

-- RLS en todas las tablas de public y ninguna política (sin políticas, la clave pública no ve nada).
do $$
declare t record; p record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Sin feed en vivo: eventos sale de Realtime.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'eventos'
  ) then
    alter publication supabase_realtime drop table public.eventos;
  end if;
end $$;

-- Sin permisos para la clave pública ni para usuarios logueados; el servidor los conserva.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Lo que se cree después en public (desde el SQL Editor) nace cerrado.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

-- Resultado: cada tabla tiene que decir rls = true, politicas = 0, permisos_publicos = 0 y realtime = false.
select c.relname as tabla, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as politicas,
  (select count(*) from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated')) as permisos_publicos,
  exists (select 1 from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = c.relname) as realtime
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by 1;

-- Aparte (no lo cambia esta migración): políticas de Storage. Si alguna deja a anon listar el
-- bucket `fotos`, avisar en un issue carril-c. Para verlas, correr sola esta consulta:
-- select policyname, cmd, roles, qual from pg_policies where schemaname = 'storage' and tablename = 'objects';
