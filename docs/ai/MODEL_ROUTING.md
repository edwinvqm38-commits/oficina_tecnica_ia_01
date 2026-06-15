# Enrutamiento de modelos

El modelo se elige por tipo de trabajo y riesgo, no por costumbre. Antes de
cambiar de modelo, entregar el contexto mínimo definido al final.

## Codex / GPT-5.5

Usar para:

- inspección directa del repositorio y Git;
- implementación y edición precisa de código;
- depuración, pruebas y verificación de diffs;
- cambios que requieren seguir patrones locales;
- tareas end-to-end con un resultado verificable en el workspace.

Preferir razonamiento alto cuando el cambio cruza routing, datos, seguridad,
permisos o contratos entre módulos.

## Claude

Usar principalmente para:

- auditoría arquitectónica;
- revisión crítica de planes o diffs;
- síntesis de documentación extensa;
- detección de contradicciones, riesgos y supuestos;
- comparación de alternativas antes de aprobar implementación.

Claude no debe modificar código funcional sin plan aprobado y debe dejar sus
decisiones o recomendaciones en el handoff correspondiente.

## ChatGPT planificador y sintetizador

Usar para:

- clarificar objetivos y restricciones;
- dividir iniciativas en fases;
- preparar criterios de aceptación;
- coordinar qué trabajo conviene asignar a Codex o revisar con Claude;
- sintetizar hallazgos, decisiones y próximos pasos recibidos de otros agentes.

La planificación no sustituye la inspección local antes de implementar.
ChatGPT no debe asumirse con acceso directo de lectura o escritura al
repositorio local. El usuario actúa como puente: copia el contexto, pega
resultados o autoriza a Codex/Claude a aplicar los cambios.

Cuando ChatGPT proponga cambios en `docs/ai/`, `HANDOFF.md` y `DECISIONS.md`
deben ser actualizados por Codex/Claude con acceso al repositorio, o mediante
instrucciones explícitas que el usuario copie a uno de esos agentes.

## Nivel de razonamiento

| Nivel | Usar cuando | Evitar |
| --- | --- | --- |
| Medio | Documentación acotada, búsquedas puntuales, cambios mecánicos y bajo riesgo. | Arquitectura transversal o datos críticos. |
| Alto | Debugging, diseño de cambios, revisión de flujos, migraciones propuestas y comportamiento compartido. | Repetir auditorías ya documentadas. |
| Extremo | Incidentes difíciles, seguridad, pérdida de datos, migraciones irreversibles o contradicciones profundas entre fuentes. | Tareas rutinarias o cuando falta evidencia básica que puede obtenerse directamente. |

## Ahorro de créditos y tokens

- Leer primero `CURRENT_STATE.md` y `HANDOFF.md`.
- Usar búsquedas dirigidas y abrir solo los archivos relevantes.
- No volver a enumerar todo el repositorio si Git y el handoff no cambiaron.
- Reutilizar decisiones y matriz de pruebas existentes.
- Evitar pegar archivos completos en el handoff; registrar rutas y conclusiones.
- Separar auditoría de implementación cuando requieran modelos distintos.
- Escalar el razonamiento solo si el riesgo o la incertidumbre lo justifican.
- No enviar secretos, credenciales, dumps de Supabase ni datos reales como
  contexto entre modelos.

## No duplicar auditorías

Antes de auditar:

1. Verificar fecha, rama y HEAD del último handoff.
2. Compararlos con Git.
3. Reutilizar hallazgos que sigan vigentes.
4. Auditar de nuevo únicamente archivos cambiados, riesgos sin evidencia o
   afirmaciones que no puedan confirmarse.

## Contexto mínimo al cambiar de modelo

Entregar:

- objetivo y restricciones;
- rama, HEAD y `git status --short`;
- documentos de `docs/ai/` relevantes;
- archivos ya inspeccionados o modificados;
- decisiones aprobadas;
- pruebas ejecutadas y resultados;
- riesgos y preguntas abiertas;
- próxima acción concreta.
