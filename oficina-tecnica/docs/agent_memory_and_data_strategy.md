# Estrategia de agentes, memoria y consultas

## Render de respuestas

- Si un agente responde con una tabla Markdown, la app la muestra como tabla visual.
- Para listados de Supabase, pedir: "muestralo en tabla" o "dame columnas codigo, estado, responsable".
- Los agentes tienen instruccion de usar tablas compactas cuando existan columnas, costos, fechas, estados o comparaciones.

## Memoria

La conversacion se guarda en:

- `public.agent_conversations`: historial de usuario/agente.
- `public.agent_memories`: resumen operativo por agente, proyecto y tipo.

Tipos de memoria:

- `context`: contexto util de una consulta.
- `learning`: cuando el usuario ensena una regla, criterio, formato o decision recurrente.
- `decision`: reservado para aprobaciones o decisiones formales.

La app carga por defecto los ultimos 5 dias. Para limpiar memoria antigua:

```sql
select * from public.purge_old_agent_memory(5);
```

Para ver que estan aprendiendo:

```sql
select
  agent_id,
  memory_type,
  importance,
  project_id,
  left(content, 180) as resumen,
  created_at
from public.agent_memories
order by created_at desc
limit 30;
```

## Adjuntos

La app ya extrae texto de:

- PDF con texto.
- PDF escaneado con OCR, primeras paginas.
- Imagenes con OCR.
- Word `.docx`.
- Excel `.xlsx` / `.xls`.
- Texto, CSV, JSON, SQL y archivos similares.

Los adjuntos se procesan en cliente y se agregan como contexto del turno. Si el archivo no tiene texto legible, el agente debe pedir otro formato o que se copie el texto.

## Control de consumo Supabase

Reglas:

- Pantallas principales deben usar paginacion server-side.
- Nada de `select("*")` para listados grandes.
- Filtros de combos deben salir por RPC agregada, no descargando toda la tabla.
- Detalles pesados solo se cargan al abrir el registro.
- Dashboard debe usar RPC de metricas agregadas, no listas completas.

Estado actual:

- Recursos ya usa paginacion y filtros server-side.
- Filtros de Recursos usan `get_recursos_filter_options()`.
- Cotizaciones y requerimientos todavia deben migrarse por completo a RPC/listas paginadas en todas las pantallas.
