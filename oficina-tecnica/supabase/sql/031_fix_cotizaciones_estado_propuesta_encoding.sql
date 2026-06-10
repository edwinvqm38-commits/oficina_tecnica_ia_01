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
-- - solo afecta filas cuyo valor empieza con "Hist" y termina en "rico"
--   (es decir, variantes corruptas de "Historico") y que no sea ya
--   exactamente 'Histórico' (sin tocar otras filas/columnas/estados)
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

-- Repara cualquier variante de mojibake del estado "Historico".
-- En vez de comparar por igualdad exacta (que falla porque los bytes
-- corruptos pueden representarse/transmitirse distinto segun el cliente
-- SQL), se usa un patron por prefijo/sufijo ASCII: cualquier valor que
-- empiece con "Hist" y termine en "rico" pero que NO sea ya 'Histórico'
-- se considera una variante corrupta y se normaliza.
update public.cotizaciones
set estado_propuesta = 'Histórico'
where estado_propuesta like 'Hist%rico'
  and estado_propuesta <> 'Histórico';

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
