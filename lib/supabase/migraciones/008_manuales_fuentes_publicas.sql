-- Fuentes de la guía pública (cuando no hay manual), para no volver a buscarlas en la web. Carril A (Juanma).
-- Si una fila tiene fuentes_publicas, es "solo guía": `url` es la primera de ellas, no un manual.
alter table public.manuales
  add column if not exists fuentes_publicas text[] not null default '{}';
