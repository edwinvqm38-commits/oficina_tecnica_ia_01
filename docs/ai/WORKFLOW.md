# Workflow de agentes

## Flujo estándar

1. **Leer contexto.** Revisar `PROJECT_CONTEXT`, `CURRENT_STATE`, `HANDOFF` y
   los documentos relacionados con la tarea.
2. **Verificar Git.** Confirmar rama, estado, base y cambios inesperados.
3. **Proponer plan.** Definir alcance, archivos, pruebas y riesgos.
4. **Esperar aprobación.** No modificar comportamiento antes de aprobar el plan.
5. **Editar.** Hacer cambios pequeños y alineados con los patrones existentes.
6. **Probar.** Ejecutar verificaciones proporcionales al riesgo o justificar por
   qué no aplican.
7. **Mostrar diff.** Revisar alcance, efectos no deseados y secretos.
8. **Commit.** Crear un commit enfocado solo cuando esté autorizado.
9. **Push solo con aprobación.** No publicar ni crear PR por defecto.
10. **Actualizar HANDOFF.** Registrar el estado final y, si hubo push, la
    referencia remota. Cuando deba viajar en el mismo commit, actualizarlo antes
    del commit y confirmar al final que sigue vigente.

## Flujo Codex constructor

1. Verificar el handoff contra el workspace.
2. Leer el código afectado y sus llamadas antes de editar.
3. Implementar el cambio aprobado con alcance conservador.
4. Añadir o ajustar pruebas según el riesgo.
5. Ejecutar pruebas, lint/build dirigido cuando aplique y `git diff --check`.
6. Mostrar resultados y actualizar el handoff.

## Flujo Claude auditor

1. Validar rama, HEAD y objetivo recibido.
2. Revisar arquitectura, contratos, riesgos y cobertura sin asumir hechos.
3. Presentar hallazgos ordenados por severidad y con referencias.
4. Separar bloqueos, recomendaciones y mejoras opcionales.
5. Registrar decisiones propuestas o solicitar su registro.
6. Actualizar el handoff si su revisión cambia la próxima acción.

## Flujo ChatGPT planificador y sintetizador

1. Convertir el objetivo en alcance, exclusiones y criterios de aceptación.
2. Identificar dependencias, fases y riesgos.
3. Asignar implementación a Codex y revisión a Claude cuando aporte valor.
4. Proporcionar el contexto mínimo sin duplicar archivos completos.
5. Sintetizar resultados y mantener una única próxima acción verificable.
6. No asumir acceso directo de lectura o escritura al repositorio local.
7. Pedir al usuario que actúe como puente copiando contexto, pegando resultados
   o autorizando a Codex/Claude a aplicar los cambios propuestos.
8. Solicitar que Codex/Claude actualice `HANDOFF.md` y `DECISIONS.md`, o entregar
   instrucciones explícitas para que el usuario las copie a un agente con acceso
   al repositorio.

## Política de ramas

- `main` es protegida conceptualmente: no se trabaja directamente en ella.
- Cada tarea usa una rama dedicada con nombre descriptivo.
- Verificar siempre la rama base solicitada.
- No hacer merge, rebase destructivo, push forzado ni borrar ramas sin
  aprobación explícita.
- Si la rama esperada no coincide, detenerse antes de editar.

## Política de commits

- Un commit debe representar una unidad coherente y revisable.
- No mezclar documentación, refactors y cambios funcionales no relacionados.
- El mensaje debe describir el efecto, no la intención vaga.
- Revisar `git status`, `git diff`, pruebas y `HANDOFF.md` antes del commit.
- No crear commits cuando la tarea lo prohíba o antes de recibir aprobación.

## Política de no tocar main

- No editar, commitear ni fusionar directamente en `main`.
- No usar `main` como destino de push durante una tarea.
- Cualquier integración a `main` requiere una instrucción posterior, revisión y
  aprobación explícita.

## Pruebas y documentación

- Cambios funcionales: ejecutar pruebas dirigidas y ampliar según el impacto.
- Cambios exclusivamente documentales: como mínimo ejecutar
  `git diff --check`; lint/build pueden no aplicar y deben reportarse como no
  ejecutados con su motivo.
- No ocultar fallos preexistentes. Diferenciarlos de regresiones introducidas.
- Actualizar `TEST_MATRIX.md` cuando aparezca un caso crítico nuevo.

## Condiciones para detenerse

Detener la edición y reportar cuando:

- la rama no sea la esperada;
- aparezcan cambios inesperados fuera del alcance;
- sea necesario tocar datos reales, SQL, permisos o sistemas excluidos;
- falte una decisión que pueda causar un cambio destructivo o incompatible.
