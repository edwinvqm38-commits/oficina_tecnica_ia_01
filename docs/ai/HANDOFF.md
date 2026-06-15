# Handoff operativo

Todo agente que termine una tarea debe actualizar este archivo. El objetivo es
que el siguiente agente pueda continuar sin reconstruir el estado desde cero.

Última actualización: 2026-06-15.

## Resumen para retomar

Se creó la primera capa formal de contexto compartido y la propuesta
`MEMORY_ARCHITECTURE.md` para ordenar la persistencia conversacional. El trabajo
sigue documentando que la memoria automática no debe activarse sin arquitectura,
RLS cerrado y autorización explícita.

En la rama `security/ai-memory-rls-audit` se añadieron propuestas documentales
de remediación RLS e inventario de solo lectura. No se ejecutó SQL ni se
consultó Supabase real.

En la rama `security/supabase-client-rls-readiness` se inició la preparación
funcional del cliente para tolerar un futuro cierre seguro de RLS: captura de
errores Supabase, avisos no técnicos al usuario y continuidad local/mock cuando
fallan lecturas, escrituras o Realtime.

## Último estado

- Rama: `security/supabase-client-rls-readiness`.
- HEAD base antes de la preparación funcional:
  `83b2971 docs: address AI memory RLS audit findings`.
- Base funcional conocida: `e08fa6b`.
- La rama parte de la capa documental publicada en
  `chore/ai-context-governance`.
- Los documentos de contexto están en la raíz, `docs/ai/` y
  `docs/security/`.
- Los archivos de agentes dentro de `oficina-tecnica/` conservan sus reglas de
  Next.js y enlazan la capa raíz.
- Claude Auditor revisó la capa de gobierno incluida en `076d0c1` y no encontró
  hallazgos críticos en aquella revisión.
- Los commits documentales `076d0c1`, `1451d79` y `da676a9` ya existen.
- La auditoría detectó memoria parcial en `agent_conversations`,
  `agent_memories`, `workspace_state`, `AppState.chats`, `datasetMemory` y
  `queryFeedback`.
- Existen tablas Supabase relacionadas según código/migraciones y el inventario
  reportado en el encargo; esta tarea no consultó ni modificó Supabase real.
- Se creó `docs/ai/MEMORY_ARCHITECTURE.md`.
- Claude auditó después `MEMORY_ARCHITECTURE.md` y señaló un hallazgo crítico
  de seguridad documental: las políticas RLS reportadas para
  `agent_conversations` y `agent_memories` permiten `ALL` al rol `public` con
  `qual: true`.
- El hallazgo se documentó como riesgo presente; no se consultó ni modificó
  Supabase real.
- Se registraron en `DECISIONS.md` los principios de Supabase, Drive,
  Graphify/Graphiti, exclusión de Obsidian y aprobación formal.
- En la tarea actual no se hizo commit, push, merge ni PR.
- Se creó `docs/security/ai-memory-rls-remediation-plan.md` con una estrategia
  de contención temporal y un modelo futuro `ai_*`.
- Se creó `docs/security/ai-memory-rls-inventory-checklist.md` con consultas de
  solo lectura propuestas y explícitamente no ejecutadas.
- La auditoría de coherencia confirmó que el checklist contiene únicamente
  consultas de lectura y que el plan separa contención, esquema `ai_*`,
  migración posterior y rollback.
- Claude aprobó avanzar hacia un inventario Supabase de solo lectura y solicitó
  ajustes menores sobre `user_profiles`, recursión RLS, Storage, atomicidad de
  futuras policies y aislamiento entre workspaces.
- Estos ajustes no autorizan consultar Supabase real, ejecutar SQL, activar
  memoria automática ni modificar SISTEMA V2 / SGP-LITE.
- La preparación funcional actual no consulta Supabase real fuera de lo que la
  app ya haría en runtime; no ejecuta SQL, no cambia migraciones, no activa
  memoria automática y no usa `service_role`.
- Se agregó un helper de errores de persistencia para clasificar fallas sin
  exponer mensajes sensibles en consola o UI.
- `workspace_state`, `agent_conversations` y `agent_memories` ahora devuelven
  resultados explícitos de persistencia al cliente cuando Supabase responde
  error o falla la red.
- `ChatView` y `RoundtableView` muestran un aviso no técnico si falla la carga
  o guardado de historial/persistencia, manteniendo el flujo local.

## Verificaciones de esta tarea

- Rama verificada: `security/supabase-client-rls-readiness`.
- `git status --short`: muestra cambios en `docs/ai/HANDOFF.md`,
  `oficina-tecnica/components/views/ChatView.tsx`,
  `oficina-tecnica/components/views/RoundtableView.tsx`,
  `oficina-tecnica/components/views/shared.tsx`,
  `oficina-tecnica/lib/memory/conversationMemory.ts`,
  `oficina-tecnica/lib/store/StoreProvider.tsx`,
  `oficina-tecnica/lib/store/persistence.ts` y el nuevo
  `oficina-tecnica/lib/supabase/persistenceErrors.ts`.
- `git diff --check`: sin errores; Git reporta solo avisos CRLF esperados en
  Windows.
- `npm run lint`: ejecutado dentro de `oficina-tecnica`; falla por deuda global
  preexistente fuera del alcance, con errores en archivos como
  `components/admin/UserApprovalPage.tsx`, `components/chat/ChatAutoInput.tsx`
  y `components/sgp/*`.
- `npx eslint` sobre los archivos modificados: sin errores.
- `npm run build`: ejecutado dentro de `oficina-tecnica`; completó
  correctamente.

## Próxima acción recomendada

Revisar el diff funcional/documental de preparación RLS del cliente y validar
lint/build. Si pasa revisión, preparar un commit local separado sin push. No
cerrar RLS ni crear migraciones hasta confirmar policies, grants, volumen,
Realtime, Storage y dependencias reales.

## Cambios pendientes

- Escalamiento a Gerencia del riesgo RLS antes de implementar memoria
  persistente automática.
- Autorización separada antes de consultar Supabase real.
- Aprobación arquitectónica explícita antes de diseñar SQL o migraciones.
- Commit de la preparación funcional/documental actual, solo cuando se autorice.
- Push de la rama, solo cuando se autorice.
- Las tareas funcionales permanecen registradas en `OPEN_ISSUES.md`.

## Riesgos

- El estado comercial histórico todavía puede contener variantes no cubiertas
  por filtros exactos.
- No hay pruebas automatizadas del pipeline anti-alucinación.
- El lint global tiene deuda preexistente.
- El feedback conversacional desaparece al reiniciar el proceso.
- La memoria actual está fragmentada entre historial local, snapshot compartido,
  conversaciones persistidas y `Map` temporales.
- Guardar automáticamente sin estados de confianza podría promover análisis o
  errores a supuesta verdad si se implementa sin la arquitectura propuesta.
- Las políticas RLS reportadas para `agent_conversations` y `agent_memories`
  permiten `ALL` a `public` con `qual: true`. Si siguen vigentes, constituyen
  una exposición actual y bloquean la captura automática masiva de memoria.
- Este archivo puede quedar obsoleto si un agente termina trabajo sin
  actualizarlo.

## Comandos útiles

```powershell
git branch --show-current
git status --short
git log --oneline --decorate -8
git diff --stat
git diff --check
git diff -- AGENTS.md CLAUDE.md docs/ai oficina-tecnica/AGENTS.md oficina-tecnica/CLAUDE.md
```

Para tareas funcionales dentro de la app:

```powershell
Set-Location oficina-tecnica
npm run lint
npm run build
```

La ejecución de lint/build debe decidirse según el alcance y registrarse aunque
no aplique.

## Plantilla de actualización

- Fecha:
- Agente/modelo:
- Rama y HEAD:
- Objetivo:
- Archivos modificados:
- Pruebas ejecutadas:
- Pruebas no ejecutadas y motivo:
- Decisiones:
- Riesgos:
- Próxima acción:
