# Handoff operativo

Todo agente que termine una tarea debe actualizar este archivo. El objetivo es
que el siguiente agente pueda continuar sin reconstruir el estado desde cero.

Última actualización: 2026-06-15.

## Resumen para retomar

Se creó la primera capa formal de contexto compartido y la propuesta
`MEMORY_ARCHITECTURE.md` para ordenar la persistencia conversacional. El trabajo
sigue limitado a documentos de gobierno; no modifica código funcional ni
comportamiento de la aplicación.

En la rama `security/ai-memory-rls-audit` se añadieron propuestas documentales
de remediación RLS e inventario de solo lectura. No se ejecutó SQL ni se
consultó Supabase real.

## Último estado

- Rama: `security/ai-memory-rls-audit`.
- HEAD: `1451d79 docs: add persistent AI memory architecture`.
- Base funcional conocida: `e08fa6b`.
- La rama parte de la capa documental publicada en
  `chore/ai-context-governance`.
- Los documentos de contexto están en la raíz, `docs/ai/` y
  `docs/security/`.
- Los archivos de agentes dentro de `oficina-tecnica/` conservan sus reglas de
  Next.js y enlazan la capa raíz.
- Claude Auditor revisó la capa de gobierno incluida en `076d0c1` y no encontró
  hallazgos críticos en aquella revisión.
- Los commits documentales `076d0c1` y `1451d79` ya existen.
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
- En esta tarea no se hizo commit, push, merge ni PR.
- Se creó `docs/security/ai-memory-rls-remediation-plan.md` con una estrategia
  de contención temporal y un modelo futuro `ai_*`.
- Se creó `docs/security/ai-memory-rls-inventory-checklist.md` con consultas de
  solo lectura propuestas y explícitamente no ejecutadas.
- La auditoría de coherencia confirmó que el checklist contiene únicamente
  consultas de lectura y que el plan separa contención, esquema `ai_*`,
  migración posterior y rollback.

## Verificaciones de esta tarea

- Rama verificada: `security/ai-memory-rls-audit`.
- `git status --short`: solo muestra `HANDOFF.md` y los dos documentos nuevos
  de `docs/security/`.
- `git diff --check`: sin errores en archivos rastreados; los dos archivos
  nuevos también se comprobaron sin whitespace al final de línea.
- Los bloques SQL del checklist son consultas de solo lectura propuestas y no
  fueron ejecutados.
- `npm run lint`: no ejecutado; el cambio es exclusivamente documental y el
  baseline global tiene errores preexistentes.
- `npm run build`: no ejecutado; no se modificó código, configuración ni
  comportamiento de la aplicación.

## Próxima acción recomendada

Revisar el diff documental y, si se autoriza, preparar un commit local sin
push. La ejecución futura del inventario de solo lectura requiere una
autorización separada. No crear ni ejecutar migraciones hasta confirmar
policies, grants, volumen, Realtime y dependencias reales.

## Cambios pendientes

- Escalamiento a Gerencia del riesgo RLS antes de implementar memoria
  persistente automática.
- Autorización separada antes de consultar Supabase real.
- Aprobación arquitectónica explícita antes de diseñar SQL o migraciones.
- Commit de esta nueva documentación, solo cuando se autorice.
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
