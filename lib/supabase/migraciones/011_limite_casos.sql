-- Límite de uso de POST /api/casos (carril C, Iaio; issue #332). Lo usa lib/supabase/limite.ts:
-- cuenta pedidos e imágenes por IP en ventanas de un minuto y de un día.
-- La IP nunca se guarda en claro: `clave` lleva un HMAC de la IP con el día (cambia cada día).
-- Las filas de más de 2 días se borran solas en cada suma (sin pg_cron ni servicios aparte).
-- Se corre a mano en el SQL Editor, después de 001–010. Se puede correr varias veces.
-- Sin esta tabla el límite igual anda, pero cuenta en memoria (cada instancia por su lado).

create table if not exists limite_uso (
  -- "<qué>:<hash>", ej. "pedidos:3f9a…" (sin IP en claro)
  clave text not null,
  -- inicio de la ventana (minuto o día, en UTC)
  ventana timestamptz not null,
  cantidad integer not null default 0,
  primary key (clave, ventana)
);
create index if not exists limite_uso_ventana on limite_uso (ventana);

-- Suma atómica: dos instancias que suman a la vez no se pisan. Devuelve el total de la ventana.
create or replace function sumar_limite_uso(p_clave text, p_ventana timestamptz, p_cantidad integer)
returns integer
language plpgsql
set search_path = public
as $$
declare
  total integer;
begin
  delete from limite_uso where ventana < now() - interval '2 days';
  insert into limite_uso (clave, ventana, cantidad) values (p_clave, p_ventana, p_cantidad)
  on conflict (clave, ventana) do update set cantidad = limite_uso.cantidad + excluded.cantidad
  returning cantidad into total;
  return total;
end;
$$;

-- Solo el servidor (clave secreta) lee y escribe; el navegador no ve esta tabla.
alter table limite_uso enable row level security;
revoke all on limite_uso from anon, authenticated;
revoke all on function sumar_limite_uso(text, timestamptz, integer) from anon, authenticated, public;
grant all on limite_uso to service_role;
grant execute on function sumar_limite_uso(text, timestamptz, integer) to service_role;

-- Resultado: rls = true, politicas = 0 y permisos_publicos = 0.
select c.relname as tabla, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as politicas,
  (select count(*) from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated')) as permisos_publicos
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'limite_uso';
