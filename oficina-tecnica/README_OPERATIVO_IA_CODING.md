# README_OPERATIVO_IA_CODING.md

## Proyecto
Sistema de trabajo con IA para desarrollo de aplicaciones web empresariales, orientado a SaaS, CRM, control de proyectos, costos unitarios, presupuestos, requerimientos, dashboards, reportes y automatización documental.

## Objetivo
Usar ChatGPT, Codex, OpenRouter, DeepSeek y Gemini de forma equilibrada para conservar créditos, reducir costos y mantener calidad técnica y trazabilidad. ChatGPT actúa como director técnico, arquitecto, router de IA, generador de prompts y validador metodológico. Codex se reserva para implementación real sobre archivos del repositorio.

## Herramientas principales

### 1. ChatGPT
Rol: director técnico, analista funcional, arquitecto, generador de prompts y validador.

Uso recomendado:
- Analizar requerimientos antes de programar.
- Clasificar la solicitud por tipo: UI/UX, backend, base de datos, arquitectura, debugging, documentación, seguridad, refactorización o despliegue.
- Dividir tareas grandes en fases.
- Decidir qué herramienta conviene usar: Codex, OpenRouter, DeepSeek, Gemini directo o ChatGPT.
- Generar prompts optimizados para cada herramienta.
- Revisar resultados y proponer mejoras.
- Definir criterios de validación.
- Mantener trazabilidad y actualizar estas instrucciones cuando el flujo cambie.

### 2. Codex en VS Code
Rol: ejecutor principal dentro del proyecto sobre archivos reales.

Uso recomendado:
- Modificar varios archivos.
- Crear módulos completos.
- Refactorizar estructura del proyecto.
- Implementar frontend + backend + pruebas.
- Crear o modificar rutas, componentes y servicios.
- Resolver errores de build que involucren varios archivos.
- Aplicar arquitectura definida previamente.
- Ejecutar cambios que requieren leer el repositorio.

Uso restringido:
- No usar Codex para dudas simples.
- No usar Codex para errores pequeños sin antes diagnosticarlos.
- No usar Codex para documentación simple, SQL aislado o consultas menores.
- No usar Codex sin prompt estructurado y alcance delimitado.

Configuración recomendada:
- GPT-5.5 + Bajo: CSS puntual, textos menores y ajustes muy simples.
- GPT-5.5 + Medio: componentes pequeños, UI controlada y correcciones locales.
- GPT-5.5 + Alto: módulos, varios archivos, arquitectura interna, estabilización y errores de build complejos.
- GPT-5.5 + Extremadamente alto: solo refactorización crítica o bug realmente difícil.
- GPT-5.4: opción de ahorro para tareas medianas no críticas.
- GPT-5.4-Mini: solo tareas muy simples y de bajo riesgo.

Regla:
Para implementación real, preferir GPT-5.5 con razonamiento Medio o Alto según complejidad.

### 3. Cline + OpenRouter
Rol: segunda opinión técnica, arquitectura, UI/UX, revisión amplia y modelos alternativos.

Configuración fija:
- Provider: OpenRouter.
- Modo: Plan.
- Auto-approve: solo Read project files ON.
- Read all files OFF.
- Edit files OFF.
- Execute safe commands OFF.
- Execute all commands OFF.
- Browser OFF.
- MCP OFF.

Uso recomendado:
- Segunda opinión técnica.
- Revisión de arquitectura.
- Análisis de contexto largo.
- Evaluación de UI/UX.
- Comparación de alternativas técnicas.
- Revisión de varios archivos sin editar.

Modelos recomendados:
- `z-ai/glm-4.5-air`: arquitectura ligera, UI/UX y segunda opinión económica.
- `z-ai/glm-5.2`: decisiones técnicas importantes.
- Kimi: contexto largo y revisión amplia de varios archivos.
- Qwen Coder: revisión de código.
- Claude/GPT frontier: solo tarea crítica y justificada.

Criterio:
OpenRouter se usa para pensar, comparar y revisar; no para editar salvo autorización expresa.

### 4. Continue + DeepSeek directo
Rol: herramienta económica para consultas puntuales y debugging.

Configuración:
- Provider: DeepSeek.
- Modelo base: DeepSeek Chat.
- Modo Chat: errores, SQL, TypeScript, React/Vite y funciones pequeñas.
- Modo Plan: diagnóstico por pasos sin modificar archivos.
- Modo Agent: solo si ChatGPT lo indica y con archivos específicos.

Uso recomendado:
- Analizar errores de consola.
- Corregir funciones específicas.
- Revisar consultas SQL.
- Optimizar lógica puntual de backend.
- Explicar código.
- Diagnosticar antes de usar Codex.

Uso restringido:
- No usar como arquitecto principal de una aplicación grande.
- No usar para módulos completos ni cambios masivos.
- No usar para decisiones críticas de seguridad sin validación.

Control de gasto:
- Recarga de referencia: US$ 5.
- Alerta: US$ 3.
- Auto recarga OFF.
- Evitar horario punta Perú: 8–11 PM y 1–5 AM, salvo urgencia.

### 5. Gemini directo
Usar solo cuando esté disponible gratis/educativo para:
- Documentación larga.
- Contexto amplio.
- Validación conceptual.

No usar Gemini vía OpenRouter por defecto.

## Clasificación de solicitudes

Antes de responder o generar un prompt, clasificar cada solicitud en una de estas categorías:

1. Arquitectura general
2. Diseño de base de datos
3. UI/UX y frontend visual
4. Backend/API
5. Debugging/error puntual
6. Refactorización
7. Seguridad/permisos/autenticación
8. Reportes/PDF/Excel
9. Documentación técnica
10. Despliegue/hosting
11. Integración con servicios externos
12. Revisión global del repositorio

## Matriz de decisión

| Tipo de solicitud | Herramienta principal | Configuración / secundaria |
|---|---|---|
| Arquitectura general | ChatGPT | Cline/OpenRouter GLM-4.5-air Plan |
| Arquitectura crítica | ChatGPT + Cline/OpenRouter | GLM-5.2 o Kimi Plan |
| Crear módulo completo | Codex | GPT-5.5 Alto |
| MVP inicial | Codex | GPT-5.5 Alto |
| Cambios en varios archivos | Codex | GPT-5.5 Medio/Alto |
| UI/UX visual | Cline/OpenRouter | GLM-4.5-air Plan; Codex implementa |
| Ajuste visual pequeño | Codex | GPT-5.5 Bajo/Medio |
| Error puntual | Continue + DeepSeek | Chat |
| Error complejo | Continue + DeepSeek | Plan; Codex si involucra varios archivos |
| SQL/base de datos puntual | Continue + DeepSeek | Chat |
| Backend puntual | DeepSeek | Codex si toca varios archivos |
| Refactorización grande | ChatGPT + Codex | OpenRouter/Kimi como segunda opinión |
| Revisión de muchos archivos | Cline/OpenRouter | Kimi o GLM-5.2 Plan |
| Revisión de código | Cline/OpenRouter | Qwen Coder o GLM-4.5-air |
| Documentación técnica | ChatGPT | Gemini directo si conviene |
| Seguridad y roles | ChatGPT + Cline/OpenRouter | Codex implementa |
| Reportes PDF/Excel | ChatGPT + Codex | DeepSeek para función puntual |
| Despliegue | ChatGPT | Codex para configuración |
| Duda simple | ChatGPT | sin gastar API |

## Protocolo antes de usar Codex

Antes de enviar una tarea a Codex, ChatGPT debe entregar:

1. Diagnóstico de la solicitud.
2. Tipo de tarea.
3. Riesgo/consumo esperado: bajo, medio o alto.
4. Herramienta recomendada.
5. Configuración exacta de modelo y razonamiento.
6. Justificación costo/calidad.
7. Prompt optimizado y delimitado.
8. Criterios de validación.
9. Indicación de si conviene actualizar `README_OPERATIVO_IA_CODING.md` o `PROJECT_CONTEXT.md`.

## Formato de respuesta obligatorio de ChatGPT

Cuando el usuario solicite una mejora o corrección técnica, responder con esta estructura:

### 1. Diagnóstico
Explicar qué tipo de tarea es y qué impacto tiene.

### 2. Clasificación técnica
Indicar si corresponde a UI/UX, backend, base de datos, debugging, arquitectura, seguridad, reportes, documentación o despliegue.

### 3. Consumo estimado
Indicar bajo, medio o alto.

### 4. Herramienta recomendada
Indicar una de estas opciones:
- Codex
- Cline/OpenRouter
- Continue/DeepSeek
- ChatGPT solamente
- Combinación escalonada

### 5. Configuración exacta
- Codex: modelo + razonamiento.
- Cline/OpenRouter: modelo + modo Plan.
- Continue/DeepSeek: modelo + modo Chat/Plan/Agent.

### 6. Motivo costo/calidad
Explicar por qué esa herramienta ahorra créditos o mejora calidad.

### 7. Prompt recomendado
Entregar el prompt exacto para copiar en la herramienta correspondiente.

### 8. Criterios de validación
Indicar cómo revisar si el resultado quedó correcto.

### 9. README / PROJECT_CONTEXT
Indicar si conviene actualizar documentación y qué regla registrar.

## Reglas de prompts

### Prompt Codex
Debe incluir:
- objetivo;
- alcance;
- archivos/carpetas;
- restricciones;
- resultado esperado;
- validación;
- indicación explícita de si puede o no hacer commit, push o staging.

### Prompt Cline/OpenRouter
Debe incluir:
- objetivo;
- módulo;
- archivos si se conocen;
- restricciones;
- qué no debe modificar;
- resultado esperado;
- criterios de revisión.

Siempre en Modo Plan. No editar ni ejecutar comandos.

### Prompt Continue/DeepSeek
Debe incluir:
- error exacto;
- archivo afectado;
- fragmento de código;
- resultado esperado;
- restricción de no cambiar arquitectura.

No enviar repo completo, ZIP, `node_modules`, `dist` ni archivos grandes innecesarios.

## Reglas de ahorro de créditos

1. Codex se usa solo cuando se requiere modificar archivos reales o implementar cambios multiarchivo.
2. DeepSeek se usa primero para debugging puntual, SQL y funciones pequeñas.
3. OpenRouter se usa para arquitectura, UI/UX, revisión amplia y segunda opinión.
4. ChatGPT se usa para analizar y preparar prompts antes de ejecutar.
5. No enviar prompts vagos a Codex.
6. No pedir a Codex que “revise todo” sin delimitar alcance.
7. Dividir tareas grandes en fases.
8. Validar cada fase antes de pasar a la siguiente.
9. No enviar la misma tarea a varias herramientas.
10. Si una IA falla, ChatGPT resume antes de cambiar de herramienta.
11. Revisar Usage semanalmente.
12. Revisar límites de Codex antes de tareas grandes.
13. Auto recarga OFF en OpenRouter y DeepSeek.
14. No usar modelos caros sin justificación.
15. Registrar decisiones importantes.

## Plantilla de solicitud al usuario

Cuando el usuario pida ayuda, solicitar o inferir estos datos:

- Nombre del proyecto o módulo.
- Tecnología usada.
- Problema actual.
- Resultado esperado.
- Archivos afectados, si se conocen.
- Error de consola, si existe.
- Nivel de urgencia.
- Si se busca gastar pocos créditos o priorizar calidad.

## Prompt maestro para ChatGPT

Actúa como director técnico, arquitecto de software y router de IA para desarrollo web empresarial. Antes de recomendar una herramienta, analiza la solicitud y clasifícala por tipo: arquitectura, UI/UX, frontend, backend, base de datos, debugging, seguridad, documentación, reportes, refactorización o despliegue.

El objetivo es conservar créditos de Codex, controlar saldos de OpenRouter/DeepSeek y mantener calidad técnica.

Para cada solicitud entrega:
1. Diagnóstico.
2. Clasificación técnica.
3. Consumo esperado: bajo, medio o alto.
4. Herramienta recomendada.
5. Configuración exacta.
6. Justificación costo/calidad.
7. Prompt listo para copiar.
8. Criterios de validación.
9. Recomendación de actualización del README o PROJECT_CONTEXT si aplica.

No envíes tareas grandes a Codex sin dividirlas en fases. No uses Codex para consultas simples. Prioriza DeepSeek para debugging puntual y SQL. Prioriza OpenRouter para arquitectura, UI/UX y segunda opinión. Prioriza Codex cuando se necesite modificar directamente varios archivos del repositorio.

## Validación real del proyecto `oficina-tecnica`

Scripts confirmados en este repositorio:

```powershell
npm run lint
npm run build
npm run dev
```

No usar `npm run check`: el proyecto actual no define ese script.

Secuencia mínima recomendada:
1. `npm run lint`
2. `npm run build`
3. `npm run dev`
4. prueba funcional en navegador
5. `git status --short`

Antes de crear o aplicar migraciones Supabase, ejecutar `supabase migration list` y confirmar que el historial local/remoto está reconciliado.

Estado conocido de validación al 2026-08-12:
- ESLint: 0 errores.
- 76 warnings preexistentes en la validación global.
- No corregir warnings globales durante tareas no relacionadas.
- Build exitoso.
- `/api/context-resolver` registrado como ruta dinámica.

## Reglas consolidadas del Context Resolver

### Precedencia
1. Código explícito de entidad.
2. Contexto conversacional.
3. Filtros específicos.
4. Discovery/listado general.

### Prioridad de fuentes
1. Datos estructurados actuales de Supabase.
2. Fuentes documentales/históricas.
3. Contexto conversacional.
4. Inferencia del agente.

Las contradicciones entre fuentes deben declararse explícitamente.

### Requerimientos: cabecera vs detalle
Consultas de cabecera:
- estado;
- avance;
- responsable;
- proyecto/servicio;
- fecha;
- datos generales.

En estos casos cargar solo el RQ principal.

Consultas de detalle:
- materiales;
- recursos;
- ítems;
- cantidades;
- precios;
- proveedor;
- partidas;
- entregables;
- desglose.

En estos casos sí cargar `requerimiento_items`.

## Reglas consolidadas de Mesa de Trabajo

- `@PM ...` → responde solo PM.
- `@IC ...` → responde solo IC.
- Múltiples menciones → responden todos los mencionados.
- Sin mención → se selecciona un único agente principal por especialidad.
- Sin match claro → PM actúa como coordinador.
- Modo coordinación explícito se mantiene.
- Context Resolver se ejecuta una sola vez por mensaje.
- Una `deterministicAnswer` no cancela una ronda multiagente.
- “redactando…” solo debe mostrarse para el agente que realmente está generando.

## Renderizado y navegación contextual

### Renderer compartido
Chat y Mesa reutilizan `components/chat/MdText.tsx`.

Debe soportar:
- Markdown.
- tablas.
- enlaces.
- listas.
- código inline.
- tablas responsive con scroll horizontal.

### Enlaces internos
No depender de `localhost`.

Ejemplos:
```text
/requerimientos?rqCode=RQ-...
/cotizaciones?quotationCode=COT-...
```

### Workspaces embebidos en Mesa
Desde Mesa de Trabajo:
- clic en un RQ → abre el workspace real de requerimiento encima de Mesa;
- clic en una cotización → abre el workspace real de cotización encima de Mesa;
- no usar `iframe`;
- no duplicar sidebar ni aplicación completa;
- conservar conversación y scroll;
- permitir editar y guardar con los mismos permisos y handlers del módulo;
- `Abrir módulo completo` queda como acción secundaria.

Componentes reutilizados:
- `RequirementWorkspaceModal`
- `QuotationWorkspaceModal`
- `RequerimientosContent`
- `CotizacionesContent`

## Git PC casa / trabajo

Fuente oficial: repositorio privado GitHub/GitLab/Bitbucket.

Antes de empezar:
```powershell
git pull
```

Al terminar:
```powershell
git status
git add <archivos controlados>
git commit -m "descripcion"
git push
```

No subir:
- `.env`
- `.env.local`
- `node_modules`
- `dist`
- credenciales.

Mantener `.env.example`.

Si se continuará en otra PC:
```powershell
git status
git add .
git commit -m "Avance: describir cambios"
git push
```

En otra PC, si el repo no existe:
```powershell
git clone URL_DEL_REPOSITORIO
cd NOMBRE_DEL_PROYECTO
npm install
cp .env.example .env
npm run dev
```

Si ya existe:
```powershell
cd NOMBRE_DEL_PROYECTO
git pull
npm install
npm run dev
```

## Historial de decisiones

| Fecha | Decisión | Motivo | Herramienta priorizada |
|---|---|---|---|
| 2026-07-08 | Se define flujo Codex + OpenRouter + DeepSeek | Evitar agotar créditos de Codex antes de fin de mes | ChatGPT como director técnico |
| 2026-08-12 | Se confirma que `oficina-tecnica` valida con `npm run lint`, `npm run build` y `npm run dev`; no existe `npm run check` | Evitar comandos inválidos y pérdida de tiempo | ChatGPT + terminal |
| 2026-08-12 | Se consolida Context Resolver con precedencia código explícito > contexto conversacional > filtros > discovery | Evitar respuestas masivas cuando existe una entidad específica | ChatGPT + Codex GPT-5.5 |
| 2026-08-12 | Se establece prioridad Supabase actual > contexto histórico/documental | Evitar contradicciones y mezcla de fuentes | ChatGPT + Codex GPT-5.5 |
| 2026-08-12 | Mesa de Trabajo usa un agente sin mención y múltiples agentes solo con menciones o coordinación explícita | Evitar respuestas duplicadas y consumo innecesario | ChatGPT + Codex GPT-5.5 |
| 2026-08-12 | Context Resolver se ejecuta una vez por mensaje y las consultas simples de RQ usan carga liviana | Reducir latencia y riesgo de timeout | ChatGPT + Codex GPT-5.5 |
| 2026-08-12 | Tablas y enlaces de entidades se renderizan mediante `MdText` compartido | Mejorar legibilidad y navegación | Codex GPT-5.5 |
| 2026-08-12 | RQ y Cotizaciones se abren desde Mesa usando workspaces embebidos reales y sin `iframe` | Mantener conversación, scroll y capacidad de edición | ChatGPT + Codex GPT-5.5 |
| 2026-08-12 | Se cierra la fase de Context Resolver/Mesa con commit `7e7de05` en `feature/requirement-email-thread` | Mantener trazabilidad de la implementación validada | Git |
| 2026-08-24 | Reconciliar migration history local/remoto antes de continuar con nuevas migraciones | Evitar drift de Supabase y futuros fallos de db push | Supabase CLI + Codex |

## Métricas sugeridas

Registrar semanalmente:
- Créditos consumidos en Codex.
- Créditos consumidos en OpenRouter.
- Créditos consumidos en DeepSeek.
- Número de tareas por categoría.
- Errores corregidos.
- Módulos creados.
- Tareas que debieron haberse enviado a otra herramienta.
- Recomendaciones para la semana siguiente.

## Actualización del README

Cuando una nueva regla mejore el flujo de trabajo, agregar una entrada en:
1. Historial de decisiones.
2. Matriz de decisión, si cambia el criterio.
3. Reglas de ahorro, si aparece un patrón de gasto.
4. Modelos recomendados, si se identifica un modelo más eficiente.
5. Validación real del proyecto, si cambian los scripts.
6. `PROJECT_CONTEXT.md`, si cambia arquitectura o comportamiento funcional.

Regla de registro:
```text
fecha | decisión | motivo | herramienta priorizada
```
