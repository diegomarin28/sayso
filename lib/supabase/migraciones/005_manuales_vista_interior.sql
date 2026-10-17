-- Vista interior del manual para el cartógrafo (/api/plano). Carril A (Juanma).
-- Páginas FÍSICAS del PDF (1 = primera hoja, como gs -dFirstPage), tomadas de las citas de la API.
alter table public.manuales
  add column if not exists pagina_vista_interior integer check (pagina_vista_interior > 0);

-- paginas_vista_explosionada ahora guarda solo la vista explosionada general (antes podía traer
-- otras páginas). Se vacía en las filas viejas; el bibliotecario la vuelve a llenar solo.
update public.manuales set paginas_vista_explosionada = '{}' where pagina_vista_interior is null;
