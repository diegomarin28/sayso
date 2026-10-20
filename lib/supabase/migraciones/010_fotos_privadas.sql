-- Fotos de las personas en un bucket privado (carril C, Iaio; issue #330). El bucket `fotos` de 001
-- es público: cualquiera con la URL veía la foto, también la de la etiqueta del equipo. Desde acá:
--   - `fotos-usuarios` (privado): fotos de las personas, en `<casoId>/<fotoId>.<ext>`. Sin políticas de
--     Storage: solo el servidor (service_role) sube y lee; para mostrarlas, URL firmada de vencimiento corto.
--   - `fotos` (sigue público): solo las páginas del manual que sube lib/knowledge/imagen.ts, en `manuales/`.
-- Las fotos viejas de personas en `fotos/<casoId>/` se mueven con scripts/mover-fotos-privadas.ts
-- (SQL no alcanza: cambiar bucket_id en storage.objects deja el archivo huérfano).
-- Se corre a mano en el SQL Editor, después de 001–009. Se puede correr varias veces.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-usuarios', 'fotos-usuarios', false, 7340032, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Resultado 1: `fotos-usuarios` con publico = false y `fotos` con publico = true.
select id, public as publico, file_size_limit, allowed_mime_types
from storage.buckets where id in ('fotos', 'fotos-usuarios') order by id;

-- Resultado 2: políticas de Storage que nombran los buckets de fotos. Lo esperado es ninguna; si
-- aparece alguna para anon/authenticated sobre `fotos-usuarios`, avisar en un issue carril-c.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%fotos%';

-- Resultado 3: fotos de personas que todavía están en el bucket público (tiene que llegar a 0
-- después de correr el script con --aplicar).
select count(*) as fotos_de_personas_en_publico
from storage.objects where bucket_id = 'fotos' and name not like 'manuales/%';
