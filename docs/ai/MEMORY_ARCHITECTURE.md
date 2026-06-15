# Arquitectura de memoria persistente

Estado del documento: propuesta arquitectónica, sin implementación ni SQL.

Última actualización: 2026-06-15.

## 1. Propósito

Definir cómo Oficina Técnica IA debe capturar, conservar, clasificar, validar y
recuperar memoria conversacional sin confundir historial con verdad oficial.

La arquitectura busca:

- dar continuidad al Chat privado y a la Mesa de Trabajo;
- conservar automáticamente conversaciones relevantes;
- mantener trazabilidad entre respuestas, fuentes y correcciones;
- separar análisis de agentes de decisiones oficiales;
- recuperar antecedentes útiles sin introducir alucinaciones;
- preparar integraciones futuras con Google Drive y, opcionalmente,
  Graphify/Graphiti.

## 2. Alcance

Este documento cubre:

- historial de mensajes humanos y de agentes;
- resúmenes automáticos de conversaciones;
- memorias candidatas y criterios oficiales;
- correcciones y aprendizaje trazable;
- vínculos con proyectos, agentes, registros Supabase y archivos;
- confianza, aprobación, seguridad, privacidad, retención y recuperación;
- migración conceptual desde los mecanismos actuales.

No autoriza cambios de código, SQL, tablas, migraciones, permisos ni datos
reales.

## 3. Principios rectores

1. **Supabase es la memoria oficial.** El historial y la memoria estructurada
   persistente deben tener una fuente canónica única.
2. **Captura automática.** No se depende de que el usuario pulse “guardar
   memoria” para conservar historial relevante.
3. **Guardar no es validar.** La persistencia automática no otorga autoridad.
4. **Análisis no es decisión.** Toda respuesta de un agente nace como análisis,
   propuesta o antecedente.
5. **Aprobación explícita.** Solo una acción o flujo formal convierte una
   memoria en decisión o criterio oficial.
6. **Trazabilidad.** Toda memoria derivada debe enlazar sus mensajes, registros
   y archivos fuente.
7. **Correcciones no destructivas.** Los errores corregidos se conservan con su
   relación de sustitución y no se borran silenciosamente.
8. **Recuperación mínima y pertinente.** Solo se inyecta memoria autorizada,
   vigente y relevante para la consulta.
9. **Datos operativos se revalidan.** Una memoria no sustituye una consulta
   actual a Supabase cuando el dato puede haber cambiado.
10. **Privacidad por diseño.** El acceso se limita por workspace, usuario,
    proyecto, conversación y sensibilidad.
11. **Evolución por fases.** Drive y Graphify/Graphiti se incorporan después de
    estabilizar el modelo canónico en Supabase.

## 4. Estado actual detectado

La aplicación tiene persistencia parcial distribuida:

| Mecanismo | Función actual | Naturaleza |
| --- | --- | --- |
| `AppState.chats` | Historial visible de Chat y Mesa | Estado React |
| `localStorage` | Caché persistente del estado de la aplicación | Local al navegador |
| `workspace_state` | Snapshot JSON compartido, especialmente `roundtable` | Persistente en Supabase |
| `agent_conversations` | Pares usuario/respuesta por agente y proyecto opcional | Persistente en Supabase |
| `agent_memories` | Destino previsto para decisión, aprendizaje o contexto | Persistente, uso activo incompleto |
| `datasetMemory` | Último alcance y dataset verificados por hilo | `Map` temporal del cliente |
| `queryFeedback` | Correcciones conversacionales | `Map` temporal del cliente |
| `lib/ai-office` | Modelo visual de memoria y aprobaciones | MVP mock |

Hallazgos relevantes:

- el Chat privado persiste visualmente en `localStorage`;
- la Mesa comparte el hilo `roundtable` mediante `workspace_state`;
- existe guardado y recuperación de `agent_conversations`;
- la recuperación por proyecto del Chat no está alineada con su guardado actual;
- `datasetMemory` y `queryFeedback` se pierden al recargar;
- `queryFeedback` registra correcciones, pero sus lectores no alimentan todavía
  consultas futuras;
- `agent_memories` tiene función de escritura, pero no un flujo activo completo
  de clasificación, aprobación y recuperación;
- no existen todavía resúmenes versionados, vínculos de evidencia, retención ni
  búsqueda semántica de memoria.

## 5. Tablas Supabase existentes relacionadas

### Evidencia del repositorio

El código y las migraciones versionadas describen:

#### `agent_conversations`

| Campo | Tipo conocido | Uso actual |
| --- | --- | --- |
| `id` | `uuid` | Identificador del mensaje persistido |
| `user_id` | `text` | Email o identificador compartido de Mesa |
| `agent_id` | `text` | Agente asociado |
| `project_id` | `text`, nullable | Alcance de proyecto opcional |
| `role` | `text` | `user` o `assistant` |
| `content` | `text` | Contenido del mensaje |
| `model_used` | `text`, nullable | Modelo de la respuesta |
| `complexity` | `text`, nullable | Complejidad de routing |
| `created_at` | `timestamptz` | Fecha de creación |

El inventario auditado reporta una política RLS `allow all`, aplicada al rol
`public`, con comando `ALL` y condición `qual: true`. Si continúa vigente,
cualquier cliente con anon key podría leer o modificar conversaciones. Es un
riesgo de seguridad presente a confirmar y escalar, no una mejora futura.

#### `agent_memories`

| Campo | Tipo conocido | Uso previsto |
| --- | --- | --- |
| `id` | `uuid` | Identificador |
| `agent_id` | `text` | Agente relacionado |
| `project_id` | `text`, nullable | Proyecto relacionado |
| `memory_type` | `text` | `decision`, `learning` o `context` |
| `content` | `text` | Contenido de memoria |
| `importance` | `integer` | Prioridad de 1 a 5 |
| `created_at` | `timestamptz` | Fecha de creación |

El inventario auditado reporta la misma política RLS abierta: `allow all`, rol
`public`, comando `ALL` y `qual: true`. Si continúa vigente, cualquier cliente
con anon key podría leer o modificar memorias. Este hallazgo es crítico antes
de ampliar o poblar memoria persistente.

#### `workspace_state`

| Campo | Tipo conocido | Uso actual |
| --- | --- | --- |
| `id` | `text` | Identificador del workspace |
| `state` | `jsonb` | Snapshot de estado compartido |
| `updated_at` | `timestamptz` | Última actualización |

### Inventario externo reportado

El encargo informa que una revisión autorizada de Supabase confirmó la vista
`rag_documentos_view`. Esta tarea no volvió a consultar Supabase real.

La vista reportada expone campos vinculados a RQ, cotizaciones y documentos,
incluyendo:

- `id`, `codigo`, `cotizacion_id`, `cotizacion_codigo`;
- `cliente`, `unidad`, `titulo`, `descripcion`, `estado`;
- fechas, `solicitante_rq`, `tipo_servicio_nombre`, `area_nombre`;
- `responsable`, `avance`, `total_rq`, `observacion`;
- `metadata`, `created_at`, `updated_at`, `prioridad` y `texto`.

La vista puede ser una fuente documental útil para recuperación futura, pero no
debe tratarse como memoria oficial ni modificarse desde esta arquitectura.

## 6. Limitaciones de las tablas actuales

### `agent_conversations`

- su RLS reportada permite `ALL` a `public` con `qual: true`; debe confirmarse y
  corregirse mediante una intervención aprobada antes de captura automática;
- no tiene una entidad formal de conversación o `thread_id`;
- usa `user_id` textual y no una identidad normalizada basada en `auth.uid()`;
- no distingue Chat privado, Mesa, canal, workspace o participante;
- guarda contenido, pero no relaciones de evidencia, adjuntos, clasificación,
  estado de entrega ni correcciones;
- el par usuario/respuesta se replica por cada agente participante;
- no ofrece idempotencia explícita para evitar duplicados;
- no tiene política de retención, borrado lógico ni sensibilidad;
- `project_id` es opcional y su uso actual no es consistente.

### `agent_memories`

- su RLS reportada permite `ALL` a `public` con `qual: true`; actualmente no
  ofrece aislamiento suficiente si ese inventario sigue vigente;
- sus tres tipos son insuficientes para separar candidato, oficial, observado,
  corregido y revocado;
- no registra autor, aprobador, estado de confianza ni fecha de vigencia;
- no enlaza mensajes, registros o archivos fuente;
- no permite versionar, sustituir o revocar una memoria;
- no diferencia hechos recuperados, análisis de agente y preferencias;
- no tiene flujo activo de recuperación ni uso trazable en prompts.

### `workspace_state`

- también requiere auditoría específica de RLS, aunque el hallazgo más crítico
  reportado corresponde a `agent_conversations` y `agent_memories`;
- es un snapshot JSON amplio, no un registro normalizado de mensajes;
- una sola fila compartida dificulta control granular y auditoría;
- puede sufrir conflictos por escrituras concurrentes;
- mezcla estado de UI con datos conversacionales;
- sus políticas actuales deben revisarse antes de usarlo como memoria sensible;
- no es adecuado como fuente canónica de largo plazo.

### `datasetMemory` y `queryFeedback`

- viven solo en memoria del proceso del navegador;
- no sobreviven recarga, nueva pestaña o cambio de dispositivo;
- no tienen auditoría ni control de acceso;
- no están vinculados a mensajes persistidos;
- las correcciones de `queryFeedback` no se recuperan aún para influir el
  comportamiento posterior.

## 7. Modelo de confianza

Cada memoria estructurada debe tener un estado explícito:

| Estado | Significado | Uso permitido |
| --- | --- | --- |
| `registrado` | Evento o contenido capturado automáticamente sin interpretación oficial | Historial y trazabilidad |
| `candidato` | Resumen, aprendizaje, decisión o criterio propuesto por una regla o agente | Antecedente con advertencia |
| `oficial` | Memoria aprobada mediante acción o flujo formal autorizado | Criterio institucional vigente |
| `observado` | Memoria cuestionada, incompleta o pendiente de revisión | No usar como verdad |
| `corregido` | Contenido reemplazado por una corrección trazable | Conservar para aprendizaje; usar la versión sustituta |
| `revocado` | Decisión o criterio retirado explícitamente | No aplicar; conservar para auditoría |

Los estados no deben inferirse únicamente del texto. Requieren eventos
estructurados y actor identificado.

## 8. Regla crítica de validación

- **Guardar no es validar.** Toda conversación relevante puede persistirse sin
  convertirse en memoria oficial.
- **Leer no es aprobar.** Abrir, mostrar o recuperar una respuesta no modifica
  su estado.
- **Silencio no es aprobar.** La falta de objeción no equivale a conformidad.
- **“Ok” no es aprobación formal.** Expresiones informales como “ok”,
  “correcto”, “listo” o “gracias” no oficializan una memoria por sí solas.
- **Una respuesta de agente no es autoridad.** Nace como análisis o propuesta.
- **La aprobación requiere intención inequívoca.** Debe existir una acción
  estructurada, permiso válido, objeto aprobado y registro de auditoría.

## 9. Capas de memoria

### Historial bruto

Mensajes originales, actor, canal, orden, tiempo, modelo, adjuntos y estado de
entrega. Es inmutable salvo redacción controlada por privacidad.

### Resumen automático

Compresión versionada de un rango de mensajes. Debe conservar:

- rango de mensajes fuente;
- modelo o proceso que resumió;
- fecha y versión;
- asuntos, entidades y pendientes;
- advertencia de que el resumen no es una decisión oficial.

### Memoria candidata

Unidad estructurada propuesta a partir del historial o de una corrección:

- decisión potencial;
- aprendizaje;
- preferencia;
- riesgo;
- antecedente técnico;
- pendiente;
- corrección.

Debe enlazar evidencia y comenzar como `candidato` u `observado`.

### Memoria observada

Memoria cuestionada, incompleta, contradictoria o pendiente de revisión. No es
un simple flag: debe conservar fuente, motivo de observación, fecha, actor,
estado previo, evidencia relacionada y alcance de visibilidad. Puede mostrarse
solo con una advertencia explícita y nunca como verdad vigente.

### Criterio oficial

Memoria candidata aprobada formalmente. Debe registrar:

- actor aprobador y permiso;
- fecha de vigencia;
- alcance, proyecto y agentes;
- fuentes;
- versión;
- posible fecha de expiración o revisión;
- relación con criterios sustituidos.

### Memoria revocada

Decisión o criterio retirado mediante una acción formal. Debe mantener el
contenido histórico, fuentes, motivo de revocación, fecha, actor autorizado,
memoria sustituta cuando exista y visibilidad con advertencia. No debe
recuperarse como instrucción vigente, pero permanece disponible para auditoría.

### Corrección y aprendizaje

Registro que conserva:

- afirmación o interpretación anterior;
- corrección del usuario o fuente;
- mensajes implicados;
- efecto sobre memorias derivadas;
- estado final;
- regla aprendida reutilizable, si corresponde.

## 10. Flujo recomendado

1. **Capturar conversación.**
   Persistir cada mensaje automáticamente con ID idempotente, actor, hilo,
   workspace, canal y tiempo.
2. **Resumir.**
   Crear resúmenes incrementales por ventanas, sin reemplazar mensajes.
3. **Clasificar.**
   Detectar temas, entidades, decisiones potenciales, riesgos, correcciones y
   sensibilidad.
4. **Vincular a proyecto.**
   Asociar solo cuando exista código explícito, chip seleccionado o resolución
   verificada.
5. **Vincular a agente.**
   Registrar autor, destinatario y agentes participantes sin duplicar el
   mensaje humano.
6. **Vincular a registros Supabase.**
   Usar referencias tipadas a cotizaciones, requerimientos, recursos u otras
   entidades; no copiar datos operativos como verdad permanente.
7. **Vincular a archivos Drive futuros.**
   Guardar metadatos y permisos en Supabase; el binario permanece en Drive.
8. **Registrar errores corregidos.**
   Crear una relación entre contenido anterior, corrección y versión vigente.
9. **Proponer memoria candidata.**
   Generar una unidad estructurada con evidencia y nivel de confianza.
10. **Aplicar aprobación formal cuando corresponda.**
    Solo un evento explícito cambia el estado a `oficial`.
11. **Consultar memoria futura.**
    Recuperar por permisos, conversación, proyecto, agente, entidad, vigencia,
    estado de confianza y relevancia.
12. **Revalidar hechos mutables.**
    Consultar nuevamente Supabase antes de responder estados, montos, fechas o
    relaciones operativas que puedan haber cambiado.

## 11. Relación con Supabase

Supabase debe conservar:

- conversaciones, participantes y mensajes;
- resúmenes y memoria estructurada;
- estados de confianza y aprobación;
- referencias a entidades y archivos;
- auditoría, retención y revocaciones;
- índices de recuperación y, si se aprueba, embeddings.

Supabase seguirá siendo la fuente de verdad de datos operativos. La memoria
sirve como antecedente y contexto, pero no reemplaza tablas operativas ni
autoriza a afirmar datos no revalidados.

Las futuras políticas RLS deben diseñarse antes de implementar:

- aislamiento por workspace;
- privacidad del Chat individual;
- acceso compartido controlado para Mesa;
- permisos de aprobación;
- acceso a proyectos y archivos;
- trazabilidad administrativa sin exposición indiscriminada.

## 12. Relación futura con Google Drive

Google Drive será el repositorio de archivos, no la base de memoria
conversacional.

Supabase debe conservar únicamente la referencia necesaria:

- `drive_file_id`;
- nombre, MIME, tamaño y hash;
- versión y fecha;
- propietario y permisos;
- proyecto y entidades relacionadas;
- estado de extracción;
- fragmentos o referencias derivadas autorizadas.

La memoria no debe almacenar archivos en base64 dentro de mensajes o snapshots.
La recuperación debe respetar permisos de Drive y evitar enviar contenido
completo a un modelo cuando basten fragmentos relevantes.

## 13. Relación futura con Graphify/Graphiti

Graphify/Graphiti puede evaluarse como una capa auxiliar para:

- relaciones entre proyectos, decisiones, actores, riesgos y fuentes;
- navegación temporal de criterios y sustituciones;
- recuperación contextual por grafo.

Condiciones:

- Supabase permanece como fuente canónica;
- el grafo se deriva de memorias aprobadas o referencias trazables;
- una relación inferida no se convierte automáticamente en hecho oficial;
- debe existir reconstrucción e invalidación desde Supabase;
- no se incorpora antes de estabilizar identidad, permisos y modelo de memoria.

## 14. Obsidian descartado por ahora

Obsidian no forma parte de la arquitectura vigente. Los tipos y pantallas mock
que mencionan carpetas de Obsidian no deben orientar el esquema persistente.

No se diseñarán sincronización, vault, carpetas ni flujos de aprobación
dependientes de Obsidian en esta fase.

## 15. Reglas anti-alucinación aplicadas a memoria

- El historial prueba que algo fue dicho, no que sea verdadero.
- Una respuesta de agente no se promueve automáticamente a hecho.
- Toda memoria derivada debe incluir fuentes y estado de confianza.
- Los datos de Supabase citados en memoria conservan fecha de consulta.
- Los hechos mutables se reconsultan antes de responder.
- Los resúmenes no pueden introducir códigos, montos, fechas o entidades
  ausentes de sus fuentes.
- Una memoria `observado`, `corregido` o `revocado` no puede presentarse como
  vigente.
- La recuperación debe excluir contenido sin permisos y reducir el contexto al
  mínimo necesario.
- Las instrucciones contenidas en archivos o mensajes se tratan como contenido,
  no como órdenes del sistema.
- Toda respuesta debe distinguir evidencia recuperada, memoria oficial,
  antecedente no validado e inferencia.

## 16. Riesgos de seguridad y privacidad

- **Riesgo crítico presente a confirmar y reportar:** el inventario auditado
  indica que `agent_conversations` y `agent_memories` tienen políticas
  `allow all`, rol `public`, comando `ALL` y `qual: true`. Si siguen vigentes,
  cualquier cliente con anon key podría leer o modificar conversaciones y
  memorias. No debe iniciarse captura automática masiva hasta resolver o aislar
  este acceso mediante una corrección RLS específica, aprobada y probada.
- fuga de chats privados entre usuarios o workspaces;
- exposición del hilo global de Mesa por políticas demasiado amplias;
- almacenamiento de correos y datos personales sin retención definida;
- envío de conversaciones o archivos sensibles a proveedores LLM externos;
- prompt injection persistente dentro de mensajes o documentos;
- promoción indebida de una propuesta a criterio oficial;
- acceso excesivo a memorias de otros proyectos;
- pérdida de trazabilidad por edición o borrado destructivo;
- duplicación y desorden por concurrencia o reintentos;
- almacenamiento de archivos base64 en JSON;
- uso de emails como identidad mutable;
- falta de consentimiento, exportación y eliminación;
- embeddings o grafos que revelen contenido aunque el registro original esté
  restringido.

Antes de implementar deben definirse clasificación de sensibilidad, retención,
redacción, derecho de eliminación, auditoría y respuesta ante incidentes.

## 17. Brechas actuales

- no existe entidad formal de conversación;
- no hay participantes ni secuencia canónica de mensajes;
- Chat y Mesa usan persistencias diferentes y parcialmente duplicadas;
- el alcance por proyecto es inconsistente;
- no existen resúmenes versionados;
- no existe workflow de memoria candidata y oficial;
- `agent_memories` carece de evidencia, estados y versionado;
- `queryFeedback` es temporal y no influye todavía en recuperación futura;
- `datasetMemory` no persiste;
- no hay relaciones tipadas con registros Supabase;
- no hay integración con Drive;
- no hay búsqueda semántica o por grafo aprobada;
- no hay política integral de RLS, retención, privacidad ni eliminación;
- la RLS abierta reportada en `agent_conversations` y `agent_memories` es un
  bloqueo de implementación hasta su confirmación y resolución aprobada;
- no hay observabilidad de fallos de persistencia;
- no hay pruebas automatizadas de memoria.

## 18. Tablas futuras conceptuales

No son nombres definitivos ni SQL ejecutable.

| Entidad conceptual | Responsabilidad |
| --- | --- |
| `ai_conversations` | Identidad del hilo, tipo, workspace, propietario, proyecto y estado |
| `ai_conversation_participants` | Usuarios y agentes participantes, roles y permisos |
| `ai_messages` | Mensajes originales, secuencia, actor, modelo, canal, estado y sensibilidad |
| `ai_message_attachments` | Referencias a archivos y extracción asociada |
| `ai_conversation_summaries` | Resúmenes versionados y rango de mensajes fuente |
| `ai_memory_items` | Memorias estructuradas con tipo, confianza, vigencia y estado |
| `ai_memory_sources` | Evidencia: mensajes, resúmenes, registros o archivos |
| `ai_memory_entity_links` | Vínculos tipados con proyectos y registros Supabase |
| `ai_memory_approvals` | Acciones formales de aprobación, rechazo, observación o revocación |
| `ai_memory_revisions` | Versiones, sustituciones y correcciones |
| `ai_query_feedback` | Correcciones conversacionales y efecto aplicado |
| `ai_file_references` | Metadatos y permisos de archivos Google Drive |
| `ai_memory_audit_log` | Accesos y cambios relevantes |
| `ai_memory_embeddings` | Índice semántico opcional, separado y reconstruible |

Campos transversales recomendados:

- `workspace_id`;
- `created_by`, `created_at`, `updated_at`;
- `source_kind`, `source_id`;
- `project_id`, `agent_id`;
- `trust_status`;
- `sensitivity`;
- `valid_from`, `valid_until`;
- `supersedes_id`;
- `deleted_at`;
- versión y clave idempotente.

## 19. Estrategia de migración

### Desde `agent_conversations`

1. Inventariar volumen, calidad, duplicados y permisos sin modificar datos.
2. Definir cómo agrupar mensajes en conversaciones.
3. Mapear identidad textual a usuarios estables sin perder procedencia.
4. Reconstruir orden y pares, marcando ambigüedades.
5. Migrar primero a historial bruto `registrado`.
6. Generar resúmenes y candidatos después, nunca durante la copia inicial.

### Desde `agent_memories`

1. Tratar todas las filas existentes como `candidato` u `observado`, salvo
   evidencia externa de aprobación formal.
2. Conservar tipo, importancia, agente, proyecto y fecha.
3. Solicitar revisión cuando no exista evidencia fuente.
4. No convertir `memory_type = decision` en `oficial` automáticamente.

### Desde `workspace_state`

1. Mantenerlo temporalmente como compatibilidad de UI.
2. Extraer mensajes de `roundtable` con IDs idempotentes.
3. Separar archivos base64 y metadatos antes de persistencia definitiva.
4. Cambiar gradualmente la lectura hacia conversaciones normalizadas.
5. Reducir `workspace_state` a preferencias y estado efímero cuando el nuevo
   historial sea estable.

### Reglas generales

- migración reversible y por lotes;
- copia antes de retirar lecturas antiguas;
- métricas de conteo y reconciliación;
- no borrar origen hasta verificar integridad y rollback;
- probar con datos mock o entorno autorizado;
- diseñar RLS antes de cualquier despliegue.

## 20. Fases recomendadas de implementación

### Fase 0: auditoría y contratos

- confirmar y escalar el inventario RLS reportado;
- aprobar y probar una corrección RLS específica como requisito bloqueante;
- validar inventario real, volumen y uso;
- aprobar este documento;
- definir identidad, workspace, privacidad y retención;
- crear matriz de pruebas y criterios de aceptación.

### Fase 1: historial canónico

- conversaciones, participantes, mensajes e idempotencia;
- persistencia consistente de Chat y Mesa;
- observabilidad de errores;
- lectura dual controlada durante transición.

### Fase 2: resúmenes y continuidad

- resúmenes incrementales versionados;
- recuperación por hilo, proyecto y agente;
- migración de `datasetMemory` a estado persistente seguro cuando sea necesario.

### Fase 3: memoria candidata y correcciones

- clasificación automática;
- evidencia y vínculos;
- `ai_query_feedback`;
- corrección, sustitución y revocación.

### Fase 4: aprobación y criterio oficial

- flujo formal de aprobación;
- permisos y auditoría;
- recuperación diferenciada por estado de confianza.

### Fase 5: Google Drive

- referencias, permisos, extracción y versionado;
- eliminación de archivos base64 de snapshots conversacionales.

### Fase 6: recuperación avanzada

- embeddings autorizados;
- evaluación opcional de Graphify/Graphiti;
- métricas de calidad, relevancia y contaminación.

Cada fase requiere auditoría, aprobación, pruebas y una tarea separada.

## 21. Qué no se debe tocar todavía

- Supabase real, datos o políticas;
- SQL existente o nuevas migraciones;
- `main`, merges, push o PR;
- código funcional de Chat, Mesa o memoria;
- Requerimientos, RQ, importación histórica o permisos globales;
- SISTEMA V2 / SGP-LITE;
- `rag_documentos_view`;
- integraciones Google Drive;
- Graphify/Graphiti;
- tipos mock de Obsidian, salvo una tarea documental específica;
- borrado o transformación de `agent_conversations`, `agent_memories` o
  `workspace_state`.
