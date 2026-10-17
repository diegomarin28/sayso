-- Refuerza los permisos: solo el servidor (clave secreta) lee y escribe casos, fotos,
-- fichas y packs; el navegador (clave pública) solo lee eventos. Se puede correr varias veces.

alter table casos enable row level security;
alter table fotos enable row level security;
alter table fichas enable row level security;
alter table eventos enable row level security;
alter table knowledge_packs enable row level security;

-- Borra cualquier política previa de estas tablas (por si se crearon a mano con otra configuración).
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('casos', 'fotos', 'fichas', 'eventos', 'knowledge_packs')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "eventos visibles" on eventos for select to anon, authenticated using (true);

revoke insert, update, delete on casos, fotos, fichas, eventos, knowledge_packs from anon, authenticated;
revoke select on casos, fotos, fichas, knowledge_packs from anon, authenticated;

-- Fila de prueba que entró antes de este arreglo.
delete from casos where id = 'intruso';

-- Resultado: las 5 tablas tienen que decir rls = true.
select c.relname as tabla, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.tablename = c.relname) as politicas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('casos', 'fotos', 'fichas', 'eventos', 'knowledge_packs')
order by 1;
