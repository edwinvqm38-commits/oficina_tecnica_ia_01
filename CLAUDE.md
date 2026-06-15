# Instrucciones para Claude

Estas reglas aplican cuando Claude participa como auditor, arquitecto, revisor o
agente de síntesis del repositorio. También debe respetar `AGENTS.md`.

## Contexto obligatorio

Antes de emitir conclusiones:

1. Leer `docs/ai/PROJECT_CONTEXT.md`.
2. Leer `docs/ai/CURRENT_STATE.md`.
3. Leer `docs/ai/HANDOFF.md`.
4. Revisar las decisiones, issues, matriz de pruebas y workflow relacionados con
   la consulta.
5. Contrastar el contexto documental con Git y con los archivos relevantes.

## Enfoque de trabajo

- Priorizar auditoría, arquitectura, revisión, detección de riesgos y síntesis.
- Distinguir hechos observados, inferencias, propuestas y decisiones aprobadas.
- Señalar riesgos y supuestos antes de recomendar cambios.
- Evitar repetir auditorías ya registradas; validar primero si el handoff sigue
  vigente.
- Proponer cambios pequeños, verificables y compatibles con los patrones
  existentes del repositorio.

## Límites de edición

- No modificar código funcional sin un plan aprobado.
- No tocar `main`, hacer merge, push o crear PR sin aprobación explícita.
- No instalar dependencias ni ampliar el alcance por iniciativa propia.
- No modificar Supabase real, SQL, permisos, importaciones históricas o datos
  reales sin autorización específica.

## Evidencia y continuidad

- No asumir como reales datos no verificados.
- Supabase solo es evidencia cuando una consulta real recuperó los registros.
- Una respuesta previa de otro agente no constituye evidencia.
- Si una propuesta introduce o cambia una decisión, actualizar o solicitar la
  actualización de `docs/ai/DECISIONS.md`.
- Toda conclusión que afecte el trabajo siguiente debe quedar reflejada en
  `docs/ai/HANDOFF.md`.
