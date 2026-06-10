-- 031_fix_cotizaciones_estado_propuesta_encoding.sql
-- PROPUESTA NO DESTRUCTIVA.
-- Corrige el "mojibake" (texto con codificacion UTF-8 corrompida) que quedo
-- en public.cotizaciones.estado_propuesta tras una importacion historica.
-- No reimporta datos, no borra registros, no cambia el significado del
-- estado (los registros "Historico" siguen siendo "Historico"), solo
-- corrige el texto visible.
--
-- Alcance:
-- - solo actualiza public.cotizaciones.estado_propuesta
-- - solo afecta filas cuyo valor coincide EXACTAMENTE con los patrones
--   corruptos conocidos (sin tocar otras filas/columnas)
-- - usa las politicas UPDATE ya existentes (023_cotizaciones_update_policy.sql)
-- - no crea ni modifica policies/permissions

begin;

-- Validacion manual 1 (antes): cuantas filas tienen el patron corrupto.
select
  estado_propuesta,
  count(*) as filas
from public.cotizaciones
where estado_propuesta like '%Ã%'
group by estado_propuesta
order by filas desc;

-- Repara la corrupcion "doble" (incluye el caracter de reemplazo U+FFFD
-- re-codificado como Latin1->UTF8): "HistÃ¯Â¿Â½rico" -> "Histórico"
update public.cotizaciones
set estado_propuesta = 'Histórico'
where estado_propuesta = 'HistÃ¯Â¿Â½rico';

-- Repara la corrupcion "simple" (un solo paso de Latin1->UTF8):
-- "HistÃ³rico" -> "Histórico"
update public.cotizaciones
set estado_propuesta = 'Histórico'
where estado_propuesta = 'HistÃ³rico';

-- Validacion manual 2 (despues): ya no deberian quedar filas con 'Ã'
-- en estado_propuesta. Si esta consulta devuelve filas, revisalas
-- manualmente antes de repetir/ajustar este script.
select
  estado_propuesta,
  count(*) as filas
from public.cotizaciones
where estado_propuesta like '%Ã%'
group by estado_propuesta
order by filas desc;

commit;
