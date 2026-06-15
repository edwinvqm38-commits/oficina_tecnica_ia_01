# Registro de decisiones

Las decisiones vigentes se registran aquí. Si una decisión cambia, no se borra:
se marca como sustituida y se enlaza la nueva decisión.

| ID | Estado | Decisión | Consecuencia |
| --- | --- | --- | --- |
| D-001 | Vigente | Usar un registry declarativo de capacidades junto con respuestas honestas para capacidades pendientes. | El modelo no debe simular tools, rankings o análisis no implementados. |
| D-002 | Vigente | Hard anti-hallucination es el principio rector de consultas de datos. | Las garantías críticas se implementan en la aplicación mediante routing, consultas, respuestas determinísticas y validación. |
| D-003 | Temporal | Mantener el feedback correctivo en memoria del proceso. | Las correcciones sirven durante la sesión, pero no sobreviven un reinicio. |
| D-004 | Pendiente | Migrar en una fase futura el feedback a `ai_query_feedback`. | Requiere diseño de esquema, permisos, privacidad y migración aprobada. |
| D-005 | Vigente | Tratar visuales, dashboards y renderers de archivos como una fase separada. | Una petición de gráfico no autoriza a fabricar una visualización ni ampliar el alcance actual. |
| D-006 | Vigente | Tratar la ampliación de la Mesa multiagente como una fase separada. | La vista existente no implica que toda la orquestación multiagente futura esté implementada. |
| D-007 | Vigente | Supabase es fuente real solo cuando una consulta real recupera registros. | No se inventan datos ni se usa una respuesta previa de agente como evidencia. |
| D-008 | Vigente | No tocar SISTEMA V2 / SGP-LITE sin aprobación explícita. | La integración futura no forma parte del comportamiento actual ni de esta capa documental. |
| D-009 | Vigente | Mantener contexto compartido en documentos pequeños con responsabilidades separadas. | `CURRENT_STATE` describe hechos actuales, `HANDOFF` continuidad, `DECISIONS` decisiones y `OPEN_ISSUES` deuda. |
| D-010 | Vigente | No modificar código funcional sin plan y aprobación. | Auditoría y propuesta preceden cualquier cambio de comportamiento. |

## Criterios para nuevas decisiones

Una entrada nueva debe indicar:

- problema que resuelve;
- alternativas consideradas;
- evidencia disponible;
- impacto y reversibilidad;
- aprobación recibida;
- documentos o código afectados.
