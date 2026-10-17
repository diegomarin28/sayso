-- Gasto diario de la IA (freno de gasto, lib/ia/freno.ts): una fila por día con el total estimado
-- en USD de todas las llamadas a Claude. Lo usa IA_LIMITE_USD_DIA para pausar la IA.
-- Se corre a mano en el SQL Editor, después de 001–005. Se puede correr varias veces.
-- Sin esta tabla el freno igual anda, pero cuenta en memoria (cada instancia por su lado).

create table if not exists gasto_ia (
  -- día en la zona horaria del freno (IA_ZONA_HORARIA, por defecto Argentina)
  dia date primary key,
  usd numeric not null default 0,
  actualizado_en timestamptz not null default now()
);

-- Suma atómica: dos instancias que suman a la vez no se pisan. Devuelve el total del día.
create or replace function sumar_gasto_ia(p_dia date, p_usd numeric)
returns numeric
language sql
as $$
  insert into gasto_ia (dia, usd) values (p_dia, p_usd)
  on conflict (dia) do update set usd = gasto_ia.usd + excluded.usd, actualizado_en = now()
  returning usd;
$$;

-- Solo el servidor (clave secreta) lee y escribe; el navegador no ve esta tabla.
alter table gasto_ia enable row level security;
revoke all on gasto_ia from anon, authenticated;
revoke all on function sumar_gasto_ia(date, numeric) from anon, authenticated, public;

-- Resultado: rls = true y 0 políticas.
select c.relname as tabla, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.tablename = c.relname) as politicas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'gasto_ia';
