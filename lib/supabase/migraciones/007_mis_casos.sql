-- "Mis casos" (carril C): cada caso guarda el id anónimo del dispositivo (sin login), el tipo de
-- equipo en texto libre y cómo terminó. Se corre a mano en el SQL Editor, después de 001–006.
-- Se puede correr varias veces.

alter table casos add column if not exists dispositivo text;
alter table casos add column if not exists tipo_equipo text;
-- { estado: resuelto | esperando_repuesto | derivado, pieza?, compraUrl?, ts }
alter table casos add column if not exists cierre jsonb;
alter table casos add column if not exists actualizado_en timestamptz not null default now();
create index if not exists casos_dispositivo on casos (dispositivo, actualizado_en desc);

-- Resultado: las 4 columnas nuevas.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'casos'
  and column_name in ('dispositivo', 'tipo_equipo', 'cierre', 'actualizado_en')
order by 1;
