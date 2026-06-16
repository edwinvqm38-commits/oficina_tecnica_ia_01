# Buenas prácticas de egress con Supabase

Guía de referencia para mantener bajo el consumo de egress (datos
transferidos desde Supabase) en esta app. Está basada en los patrones ya
usados en la mayoría del código (`lib/chat/contextQuery.ts`,
`lib/sgp/recursosRepository.ts`) y en los cambios aplicados en este
diagnóstico a `lib/store/persistence.ts` / `lib/store/types.ts`.

## 1. Nunca usar `select('*')` en tablas que pueden crecer

Seleccionar siempre las columnas necesarias explícitamente:

```ts
// Mal
supabase.from("cotizaciones").select("*");

// Bien
supabase.from("cotizaciones").select("id, codigo, cliente_nombre, estado");
```

Esto ya es la norma en `contextQuery.ts` y `recursosRepository.ts` — mantenerla
al agregar nuevas consultas.

## 2. Paginar y limitar siempre

Usar `.range(from, to)` o `.limit(n)` en cualquier lista que pueda crecer sin
límite (cotizaciones, requerimientos, recursos, notificaciones, logs). Ver
`lib/sgp/recursosRepository.ts:listRecursos` y
`lib/admin/adminDataViewer.ts` para el patrón con `count: "exact"` +
`range()`.

## 3. Filtrar en el servidor, no en el cliente

Aplicar `.eq()`, `.ilike()`, `.is()` en la query en vez de traer todo y
filtrar en JS. Evita transferir filas que de todas formas se van a descartar.

## 4. Debounce en búsquedas y en sincronización de estado

- Las búsquedas con texto libre (`/proyecto`, autocompletado) deben
  debouncearse (~250-300ms) antes de golpear Supabase — ya implementado en
  `ChatAutoInput.tsx`.
- El guardado de `workspace_state` (estado compartido de toda la app) está
  debounceado a 1500ms en `lib/store/persistence.ts:saveRemote` — antes
  estaba en 800ms; el aumento reduce la frecuencia de upserts en sesiones con
  edición rápida (escribiendo, marcando aprobaciones, etc.) sin notarse en la
  UI.

## 5. No sincronizar estado pesado o que no necesita ser compartido

`workspace_state` es una fila única compartida por todos los usuarios — todo
lo que se guarda ahí se lee de vuelta por cada cliente conectado. Antes de
agregar algo a `AppState`, preguntarse si realmente necesita vivir ahí:

- Los chats privados ("Chat privado", agentes legacy `ic`/`pm`/`ie`/`gg`)
  **no se sincronizan** — solo el hilo `roundtable` de Mesa de trabajo (ver
  `SHARED_CHAT_THREADS` / `pickSharedChats` en `lib/store/types.ts`).
- Las API keys de proveedores de modelo se redactan antes de sincronizar
  (`redactProviderKeys`) — nunca deben salir de este navegador en texto
  plano.
- El `dataUrl` (base64) de archivos adjuntos en el chat compartido se quita
  antes de sincronizar (`stripAttachmentData` en `lib/store/types.ts`) — un
  solo adjunto puede pesar varios MB en base64; solo el texto extraído
  (`content`) necesita ser compartido entre usuarios.
- Antes de subir un upsert, se compara contra el último payload sincronizado
  con éxito (`lastSyncedPayload` en `persistence.ts`) y se omite el upsert si
  no cambió nada — evita escrituras duplicadas por ecos de Realtime u otros
  efectos.

## 6. No guardar archivos completos en Supabase

Los adjuntos del chat se procesan client-side (extracción de texto vía
`lib/chat/fileExtraction.ts`) y solo el texto extraído + metadata (nombre,
tipo, tamaño, estado de extracción) se envían al LLM y se sincronizan. El
archivo binario original nunca se sube a Supabase Storage ni a una tabla.

## 7. Evitar refetch innecesario

- `mergeChats` / `mergeWithSeed` devuelven la misma referencia de objeto
  cuando no hay cambios reales, para que los `useEffect` que dependen de
  `state` no se vuelvan a disparar (y por lo tanto no vuelvan a llamar a
  `saveRemote`) sin necesidad.
- El poll de respaldo cada 5s (`StoreProvider.tsx`) solo actualiza el estado
  si `mergeChats` detecta mensajes nuevos — si no hay nada nuevo, no hay
  re-render ni nuevo guardado.

## 8. Logging estructurado para detectar regresiones de egress

`lib/store/persistence.ts` registra cada lectura/escritura fallida con
`console.warn("[persistence]", { category: "network", operation: "workspace-read" | "workspace-write", detail })`,
y cada lectura/escritura exitosa con `console.debug`. Si en producción se ve
un volumen alto de estos logs, es señal de reintentos excesivos o de un
problema de permisos/RLS (ver `038_workspace_state_rls_diagnostic_fix_PROPOSED.sql`).
