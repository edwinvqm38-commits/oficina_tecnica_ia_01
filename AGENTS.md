# Instrucciones para Codex

Este archivo gobierna el trabajo de agentes de desarrollo en todo el repositorio.
Las instrucciones más específicas de un subdirectorio complementan estas reglas,
pero no las reemplazan.

## Contexto obligatorio

Antes de auditar, planificar o editar:

1. Leer `docs/ai/PROJECT_CONTEXT.md`.
2. Leer `docs/ai/CURRENT_STATE.md`.
3. Leer `docs/ai/HANDOFF.md`.
4. Consultar `docs/ai/DECISIONS.md`, `docs/ai/OPEN_ISSUES.md`,
   `docs/ai/TEST_MATRIX.md`, `docs/ai/MODEL_ROUTING.md` y
   `docs/ai/WORKFLOW.md` según la tarea.
5. Verificar rama, estado del worktree y últimos commits. No asumir que el
   handoff sustituye a Git.

## Reglas de Git

- No trabajar directamente sobre `main`.
- No hacer merge a `main` salvo instrucción y aprobación explícitas.
- Trabajar en una rama dedicada que parta de la base indicada para la tarea.
- No hacer `push`, crear PR ni publicar cambios sin aprobación explícita.
- No revertir cambios ajenos. Si aparecen cambios inesperados que afectan la
  tarea, detenerse y reportarlos.
- Mantener los commits enfocados y no mezclar documentación con cambios
  funcionales no relacionados.

## Implementación y pruebas

- Auditar el código y proponer un plan antes de modificar comportamiento.
- No alterar comportamiento funcional sin aprobación.
- Mantener los cambios dentro del alcance autorizado.
- Ejecutar las pruebas proporcionales al riesgo. Si no aplican o no pueden
  ejecutarse, justificarlo claramente.
- Mostrar el diff y los resultados de verificación antes de solicitar commit o
  publicación.
- No instalar dependencias sin aprobación.

## Datos y Supabase

- Supabase es fuente real solo cuando una consulta real y autorizada recupera
  datos. No inventar registros, códigos, proyectos, clientes, montos o estados.
- No presentar datos mock, historial conversacional ni respuestas anteriores de
  agentes como evidencia de Supabase.
- No modificar datos, esquemas, SQL, permisos ni políticas reales sin alcance y
  aprobación explícitos.
- Cuando una capacidad o fuente no esté implementada, responder honestamente en
  lugar de completar la respuesta con inferencias.

## Cierre y continuidad

- Al terminar una tarea, actualizar `docs/ai/HANDOFF.md` con rama, commit base,
  cambios, pruebas, riesgos y próxima acción.
- Actualizar `docs/ai/CURRENT_STATE.md` si cambió el estado verificable del
  proyecto.
- Registrar decisiones nuevas o sustituidas en `docs/ai/DECISIONS.md`.
- Mantener hechos, decisiones, issues y propuestas claramente separados.
