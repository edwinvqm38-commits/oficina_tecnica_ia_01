# Handoff operativo

Todo agente que termine una tarea debe actualizar este archivo. El objetivo es
que el siguiente agente pueda continuar sin reconstruir el estado desde cero.

Última actualización: 2026-06-15.

## Resumen para retomar

Se creó la primera capa formal de contexto compartido y la propuesta
`MEMORY_ARCHITECTURE.md` para ordenar la persistencia conversacional. El trabajo
sigue limitado a documentos de gobierno; no modifica código funcional ni
comportamiento de la aplicación.

## Último estado

- Rama: `chore/ai-context-governance`.
- HEAD: `076d0c1 docs: add shared AI context governance`.
- Base funcional conocida: `e08fa6b`.
- La rama parte del estado de `fix/hard-anti-hallucination`.
- Los documentos de contexto están en la raíz y en `docs/ai/`.
- Los archivos de agentes dentro de `oficina-tecnica/` conservan sus reglas de
  Next.js y enlazan la capa raíz.
- Claude Auditor revisó la capa de gobierno incluida en `076d0c1` y no encontró
  hallazgos críticos en aquella revisión.
- El commit documental `076d0c1` ya fue creado localmente.
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
- No se hizo push, merge ni PR.

## Verificaciones de esta tarea

- `git status --short`: solo muestra cambios en `CURRENT_STATE.md`,
  `DECISIONS.md`, `HANDOFF.md`, `OPEN_ISSUES.md` y el nuevo
  `MEMORY_ARCHITECTURE.md`.
- `git diff --stat`: sin archivos fuera del alcance documental; el archivo
  nuevo no aparece en esta estadística mientras permanezca sin seguimiento.
- `git diff --check`: sin errores en archivos rastreados; el archivo nuevo
  también se comprobó sin whitespace al final de línea.
- `npm run lint`: no ejecutado; el cambio es exclusivamente documental y el
  baseline global tiene errores preexistentes.
- `npm run build`: no ejecutado; no se modificó código, configuración ni
  comportamiento de la aplicación.

## Próxima acción recomendada

Revisar el diff de las correcciones solicitadas por Claude y preparar el commit
documental local, sin push. No crear SQL, tablas ni migraciones hasta que la
arquitectura y una corrección RLS específica sean aprobadas.

## Cambios pendientes

- Revisión final de los ajustes documentales derivados de la auditoría de
  Claude.
- Escalamiento a Gerencia del riesgo RLS antes de implementar memoria
  persistente automática.
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
