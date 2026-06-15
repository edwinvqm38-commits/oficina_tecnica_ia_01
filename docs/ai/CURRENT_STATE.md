# Estado actual

Última actualización documental: 2026-06-15.

## Git

- Rama de trabajo: `chore/ai-context-governance`.
- Rama base funcional: `fix/hard-anti-hallucination`.
- Último commit conocido: `e08fa6b fix(chat): route won quotations by commercial status`.
- Al iniciar esta tarea, el worktree estaba limpio.
- `chore/ai-context-governance` no tenía rama remota.
- `e08fa6b` sí estaba publicado en `origin/fix/hard-anti-hallucination`.

Git prevalece sobre este documento si el repositorio cambia.

## Hard anti-hallucination

La rama base contiene una primera implementación funcional en varias capas:

- registry declarativo de capacidades soportadas y pendientes;
- preflight antes de llamar al modelo;
- resolución de alcance explícito o verificado en memoria;
- aclaración de consultas ambiguas;
- herramientas de consulta a Supabase;
- respuestas determinísticas para consultas de datos;
- bloqueo seguro cuando no hay datos o la capacidad no existe;
- validación posterior de códigos, montos, fechas y conteos generados por LLM;
- integración tanto en Chat como en Mesa de Trabajo.

El feedback correctivo se conserva solo en memoria del proceso.

## Consultas comerciales

El commit `e08fa6b` introdujo el arreglo básico para consultas por estado
comercial:

- las consultas por ganadas/adjudicadas detectan ambos términos;
- el filtro de `Ganada` consulta los valores exactos `Ganada` y `Adjudicado`;
- el filtro de pérdidas consulta `Perdida / No adjudicada` y `No adjudicado`.

Este commit está en remoto dentro de `origin/fix/hard-anti-hallucination`.
Permanece pendiente un hardening más tolerante a variantes históricas no
normalizadas, como diferencias de espacios, mayúsculas, acentos o codificación.

## Funcionando

- Consulta por códigos de cotización, requerimiento y referencias históricas.
- Búsquedas acotadas de cotizaciones y requerimientos.
- Consulta de ítems de un RQ recuperado.
- Consulta de recursos y clasificación eléctrica determinística.
- Respuestas honestas para análisis globales aún no implementados.
- Memoria conversacional de alcance verificado.
- Manejo de archivos con instrucciones explícitas para extracción insuficiente.

## Pendiente

- Pruebas automatizadas del pipeline de contexto.
- Robustecer consultas comerciales frente a datos históricos inconsistentes.
- Persistir feedback en una futura tabla `ai_query_feedback`.
- Implementar la fase visual para gráficos y dashboards solicitados al chat.
- Definir la siguiente fase de orquestación multiagente.
- Reducir o aislar la deuda de lint preexistente.

## No tocar sin aprobación explícita

- `main`.
- SISTEMA V2 / SGP-LITE.
- Supabase real, esquemas, SQL, datos o permisos.
- Requerimientos, RQ, importación histórica y lógica crítica.
- Comportamiento funcional fuera de una tarea aprobada.

## Alcance de esta tarea

Esta tarea crea únicamente documentación e instrucciones de contexto. No se
consultó ni modificó Supabase real y no se usaron datos productivos.
