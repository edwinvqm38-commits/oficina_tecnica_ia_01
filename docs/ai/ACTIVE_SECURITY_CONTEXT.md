# Active Security Context — IA Gerencial / Oficina Virtual Multiagente

Fecha de contexto: 2026-06-15

## Resumen ejecutivo

Este archivo existe para evitar confusión entre ramas, PRs y próximos pasos. Es la referencia principal para Edwin, ChatGPT, Codex y Claude en esta fase de seguridad.

Desde este punto se debe trabajar con **una sola rama visible y un solo PR abierto**.

## Rama activa única

Usar solo esta rama:

```text
security/rls-policies-hardening
```

No continuar trabajando sobre la rama intermedia:

```text
security/auth-gated-store-hydration
```

Esa rama fue usada como paso intermedio, pero ya no debe ser el foco operativo de Edwin.

## Pull Request activo único

Usar solo este PR:

```text
PR #2 — security: gate AI memory persistence by approved users
```

URL:

```text
https://github.com/edwinvqm38-commits/oficina_tecnica_ia_01/pull/2
```

El PR #1 fue cerrado intencionalmente para evitar confusión. No fue mergeado. Sus cambios están incluidos dentro de la rama final `security/rls-policies-hardening`.

## Base y alcance del PR activo

Base del PR activo:

```text
security/supabase-client-rls-readiness
```

Head del PR activo:

```text
security/rls-policies-hardening
```

El PR activo contiene dos commits principales:

```text
233b273 fix: gate remote store persistence by approved profile
4398d22 security: require approved users for AI memory RLS
```

Además, este archivo de contexto fue agregado para trazabilidad operativa.

## Qué incluye esta fase

### 1. Gate cliente para persistencia remota

Archivos relevantes:

```text
oficina-tecnica/lib/store/StoreProvider.tsx
oficina-tecnica/lib/store/persistence.ts
oficina-tecnica/lib/supabase/persistenceErrors.ts
oficina-tecnica/components/views/ChatView.tsx
oficina-tecnica/components/views/RoundtableView.tsx
```

Objetivo:

- La app no debe hidratar, guardar, hacer polling ni activar Realtime remoto hasta confirmar sesión válida y perfil aprobado.
- La condición mínima para habilitar persistencia remota es `user_profiles.status === 'approved'`.
- ChatView y RoundtableView no deben leer/escribir `agent_conversations` cuando la persistencia remota no esté habilitada.
- Se corrigió una condición de carrera en `resolveAccess` usando `accessRequestId` para descartar resoluciones obsoletas.

Estado:

- Auditado por Claude.
- Corrección crítica CR-1 aplicada.
- Build pasó.
- Lint focalizado pasó.

### 2. Migración SQL local propuesta para RLS

Archivo relevante:

```text
oficina-tecnica/supabase/sql/037_ai_memory_rls_approved_users.sql
```

Objetivo:

- Endurecer RLS para que solo usuarios aprobados puedan acceder a:
  - `workspace_state`
  - `agent_conversations`
  - `agent_memories`

Helpers propuestos:

```sql
public.is_approved_user(uuid default auth.uid())
public.has_approved_role(text[])
```

Corrección aplicada por auditoría Claude:

```sql
up.role::text = any(allowed_roles)
```

Motivo:

- Compatibilidad si `user_profiles.role` es enum `app_role` o texto.

Estado:

- Migración creada localmente.
- Auditada por Claude.
- Corrección crítica aplicada.
- No fue ejecutada en Supabase local ni remoto.

## Qué NO se hizo

No se debe asumir que estas acciones ya ocurrieron:

- No se ejecutó SQL.
- No se aplicó migración en Supabase remoto.
- No se aplicó migración en Supabase local/staging.
- No se tocaron datos reales.
- No se hizo merge.
- No se tocó SGP-LITE.
- No se tocó Requerimientos/RQ/cotizaciones/Propuesta Técnica.
- No se cambió la lógica histórica sensible del sistema.

## Restricciones críticas para próximos cambios

Mientras esta fase esté abierta:

- No hacer `supabase db push`.
- No ejecutar `supabase migration up` contra remoto.
- No ejecutar SQL manual en Supabase remoto.
- No hacer merge sin validar Vercel y sin decidir explícitamente.
- No abrir nuevas ramas salvo indicación explícita.
- No mezclar esta fase con SGP-LITE ni módulos de Requerimientos.
- No usar `git add .`; usar siempre `git add` selectivo.

## Qué debe revisar Claude si vuelve a auditar

Claude debe revisar solo el PR activo:

```text
PR #2 — security: gate AI memory persistence by approved users
```

Debe enfocarse en:

1. Que el gate cliente siga fail-closed.
2. Que `StoreProvider.tsx` no habilite remoto por sesión obsoleta.
3. Que ChatView y RoundtableView estén protegidos por `remoteConfigured`.
4. Que la migración `037_ai_memory_rls_approved_users.sql` cierre `workspace_state`, `agent_conversations` y `agent_memories` por usuario aprobado.
5. Que `user_profiles` siga permitiendo login/gate y lectura del perfil propio.
6. Que no se haya ejecutado SQL remoto.
7. Que no se hayan tocado módulos prohibidos.

## Qué debe revisar Codex si continúa el trabajo

Codex debe trabajar solo sobre:

```text
security/rls-policies-hardening
```

y solo si Edwin lo solicita.

Acciones permitidas en la siguiente fase:

- Preparar pruebas locales/staging para la migración.
- Documentar matriz de validación.
- Revisar Vercel preview de la rama activa.
- Ajustes mínimos si Vercel o auditoría detectan error.

Acciones no permitidas sin aprobación explícita de Edwin:

- Ejecutar SQL.
- Aplicar migraciones.
- Hacer merge.
- Hacer cambios en SGP-LITE.
- Tocar datos reales.
- Cambiar RQ/Requerimientos/cotizaciones/Propuesta Técnica.

## Vercel

Para revisión visual, usar deployment de la rama:

```text
security/rls-policies-hardening
```

Qué se puede validar en Vercel:

- La app carga correctamente.
- Login/logout no rompe el frontend.
- Usuario no aprobado no debe activar persistencia remota.
- Usuario aprobado debe mantener comportamiento funcional.
- Chat y Mesa deben funcionar sin errores visuales.

Qué NO se valida en Vercel:

- La migración RLS no se valida visualmente porque no fue ejecutada.
- La seguridad real de RLS debe probarse en Supabase local/staging antes de aplicar remoto.

## Próximo paso recomendado

1. Revisar Vercel preview de la rama `security/rls-policies-hardening`.
2. Si Vercel está bien, preparar pruebas local/staging para la migración SQL.
3. No mergear todavía.
4. No aplicar migración remota todavía.

## Regla simple para Edwin

Si hay duda, recordar esto:

```text
Solo usar PR #2.
Solo usar rama security/rls-policies-hardening.
No ejecutar SQL.
No hacer merge.
Primero revisar Vercel.
```
