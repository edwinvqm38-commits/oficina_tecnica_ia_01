-- 210_trim_workspace_state_egress.sql
-- Limpia payloads pesados del workspace_state para cortar egress innecesario.
--
-- Motivo:
-- - workspace_state se sincroniza para Mesa de trabajo.
-- - Si un adjunto entra como dataUrl/base64 dentro de chats.roundtable,
--   cada lectura/realtime transmite el archivo embebido completo.
-- - Conservamos metadata del archivo, pero removemos dataUrl y dejamos solo
--   los ultimos 60 mensajes compartidos.

begin;

with roundtable_messages as (
  select
    ws.id,
    msg,
    ord,
    count(*) over (partition by ws.id) as total_count
  from public.workspace_state ws
  cross join lateral jsonb_array_elements(coalesce(ws.state #> '{chats,roundtable}', '[]'::jsonb))
    with ordinality as e(msg, ord)
  where ws.id = 'default'
),
clean_messages as (
  select
    id,
    jsonb_agg(
      case
        when msg ? 'attachments' then jsonb_set(
          msg,
          '{attachments}',
          coalesce((
            select jsonb_agg(att - 'dataUrl')
            from jsonb_array_elements(coalesce(msg -> 'attachments', '[]'::jsonb)) as a(att)
          ), '[]'::jsonb),
          true
        )
        else msg
      end
      order by ord
    ) as messages
  from roundtable_messages
  where ord > greatest(total_count - 60, 0)
  group by id
)
update public.workspace_state ws
set
  state = jsonb_set(
    ws.state,
    '{chats,roundtable}',
    coalesce(cm.messages, '[]'::jsonb),
    true
  ),
  updated_at = now()
from clean_messages cm
where ws.id = cm.id;

-- Diagnostico rapido despues de ejecutar:
-- select id, pg_size_pretty(pg_column_size(state)::bigint) as state_size
-- from public.workspace_state
-- order by id;

commit;
