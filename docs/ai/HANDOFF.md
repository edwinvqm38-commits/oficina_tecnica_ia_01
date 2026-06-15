# Handoff operativo

Todo agente que termine una tarea debe actualizar este archivo. El objetivo es
que el siguiente agente pueda continuar sin reconstruir el estado desde cero.

Última actualización: 2026-06-15.

## Resumen para retomar

Se creó la primera capa formal de contexto compartido para Codex, Claude y
ChatGPT. El trabajo está limitado a documentos de gobierno; no modifica código
funcional ni comportamiento de la aplicación.

## Último estado

- Rama: `chore/ai-context-governance`.
- Base/HEAD funcional conocido: `e08fa6b`.
- La rama parte del estado de `fix/hard-anti-hallucination`.
- Los documentos de contexto están en la raíz y en `docs/ai/`.
- Los archivos de agentes dentro de `oficina-tecnica/` conservan sus reglas de
  Next.js y enlazan la capa raíz.
- Claude Auditor revisó la capa documental y no encontró hallazgos críticos.
- Se aplicaron sus ajustes documentales menores antes del commit.
- No se hizo commit, push, merge ni PR.
- No se consultó ni modificó Supabase real.

## Verificaciones de esta tarea

- `git status --short`: solo muestra los documentos autorizados.
- `git diff --check`: completado sin errores.
- Revisión adicional de archivos nuevos: sin whitespace final.
- `npm run lint`: no ejecutado; el cambio es exclusivamente documental y el
  baseline global tiene errores preexistentes.
- `npm run build`: no ejecutado; no se modificó código, configuración ni
  comportamiento de la aplicación.

## Próxima acción recomendada

Revisar el diff y, si queda aprobado, preparar un commit documental local en
esta misma rama. No publicar la rama hasta recibir aprobación separada para el
push.

## Cambios pendientes

- Revisión final del diff documental.
- Commit documental, solo cuando se autorice.
- Push de la rama, solo cuando se autorice.
- Las tareas funcionales permanecen registradas en `OPEN_ISSUES.md`.

## Riesgos

- El estado comercial histórico todavía puede contener variantes no cubiertas
  por filtros exactos.
- No hay pruebas automatizadas del pipeline anti-alucinación.
- El lint global tiene deuda preexistente.
- El feedback conversacional desaparece al reiniciar el proceso.
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
