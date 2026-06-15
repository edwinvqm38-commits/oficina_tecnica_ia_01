# Issues abiertos

Este archivo registra deuda y riesgos; no convierte hipótesis en hechos. Cada
issue debe cerrarse solo después de verificar código, pruebas y Git.

| ID | Estado | Issue | Evidencia actual / siguiente acción |
| --- | --- | --- | --- |
| OI-001 | Parcial | Mejorar la tolerancia de las consultas comerciales frente a variantes históricas de estado. | El fix comercial base `e08fa6b` ya existe en `origin/fix/hard-anti-hallucination`; no está pendiente recuperarlo ni commitearlo. Lo pendiente es verificar e implementar, en otra tarea, tolerancia a mayúsculas, espacios, acentos, codificación y valores históricos inconsistentes. |
| OI-002 | Abierto | Datos históricos inconsistentes. | Existen estados históricos equivalentes y antecedentes de mojibake. Auditar con datos autorizados antes de proponer normalización. |
| OI-003 | Abierto | Lint global con errores preexistentes. | La auditoría del 2026-06-15 observó 70 errores y 1597 advertencias, incluyendo archivos funcionales y un worker PDF vendorizado. Definir baseline y exclusiones sin mezclarlo con hotfixes. |
| OI-004 | Pendiente | Feedback persistente `ai_query_feedback`. | `queryFeedback.ts` usa un `Map` en memoria. Diseñar esquema, RLS, privacidad y migración en una fase aprobada. |
| OI-005 | Pendiente | Visual renderer. | Gráficos y dashboards solicitados al chat deben responder honestamente hasta contar con renderer y contrato de datos. |
| OI-006 | Pendiente | Siguiente fase de Mesa multiagente. | Existe `RoundtableView`, pero la ampliación de orquestación, decisiones y responsabilidades sigue separada. |
| OI-007 | Pendiente | Pruebas automatizadas. | No se encontraron archivos de test para el pipeline crítico. Priorizar router, registry, filtros comerciales, alcance y validación. |
| OI-008 | Abierto | Pérdida de continuidad si `HANDOFF.md` no se actualiza. | Hacer la actualización parte obligatoria del cierre y de la revisión previa al commit. |

## No incluidos en el alcance actual

- Cambios a Supabase, SQL, permisos o datos reales.
- Cambios a Requerimientos/RQ o importación histórica.
- Integración con SISTEMA V2 / SGP-LITE.
- Refactors funcionales motivados por la deuda de lint.
