# Plan de remediación RLS para memoria IA

Estado: propuesta técnica, sin SQL ejecutado ni cambios en Supabase.

Fecha: 2026-06-15.

## 1. Resumen ejecutivo

La persistencia actual de Chat, Mesa de Trabajo y estado compartido no tiene un
modelo de autorización suficientemente fuerte para activar memoria automática.
La evidencia local muestra políticas amplias para la Mesa y
`workspace_state`; el inventario remoto reportado indica además políticas
`allow all` sobre `agent_conversations` y `agent_memories`.

Una política permisiva con condición verdadera puede hacer ineficaces las
políticas más restrictivas porque PostgreSQL combina normalmente las políticas
permisivas aplicables mediante `OR`. Por tanto, agregar una política segura sin
retirar primero las abiertas no resuelve la exposición.

La remediación propuesta tiene dos horizontes:

1. **Contención temporal:** confirmar el inventario real, retirar acceso
   indiscriminado y conservar solo el mínimo compatible con usuarios
   autenticados y aprobados.
2. **Arquitectura definitiva:** crear tablas `ai_*` con identidad UUID,
   workspaces, participantes, proyectos, mensajes inmutables, memorias
   versionadas y aprobación formal.

No se debe activar captura automática masiva, ejecutar migraciones ni cambiar
Supabase real hasta aprobar el inventario, el plan, las pruebas y el rollback.

## 2. Alcance y exclusiones

Este plan cubre:

- `agent_conversations`;
- `agent_memories`;
- `workspace_state`;
- Chat privado;
- Mesa de Trabajo compartida;
- memoria por proyecto y memoria oficial;
- identidad, RLS, grants, Realtime y compatibilidad transitoria.

Quedan fuera:

- ejecución de SQL;
- modificación de datos o políticas reales;
- SISTEMA V2 / SGP-LITE;
- Requerimientos, RQ e importación histórica;
- conexión de modelos LLM;
- activación de memoria automática;
- implementación de un backend completo;
- almacenamiento futuro de archivos en Google Drive.

## 3. Evidencia revisada

La aplicación productiva está en `oficina-tecnica/`. Se revisaron:

- `supabase/sql/030_agent_conversations_memories.sql`;
- `supabase/sql/034_roundtable_shared_chat.sql`;
- `supabase/sql/035_workspace_state_grants.sql`;
- `supabase/schema.sql`;
- `lib/memory/conversationMemory.ts`;
- `lib/store/persistence.ts`;
- `lib/store/StoreProvider.tsx`;
- `components/views/ChatView.tsx`;
- `components/views/RoundtableView.tsx`.

Los archivos locales describen intención y evolución histórica, pero no prueban
por sí solos qué policies y grants siguen activos en Supabase. El estado real
debe confirmarse mediante el checklist de inventario autorizado.

## 4. Diagnóstico RLS

### `agent_conversations`

La migración `030`:

- almacena la identidad en `user_id text`;
- usa el email del JWT mediante `auth.email() = user_id`;
- permite a administración y gerencia leer conversaciones;
- habilita RLS.

La migración `034` agrega una policy `FOR ALL` para toda fila cuyo
`user_id = 'roundtable-shared'`. La migración `035` concede
`SELECT`, `INSERT`, `UPDATE` y `DELETE` al rol `authenticated`.

El inventario remoto reportado añade una policy `allow all`, rol `public`,
comando `ALL` y condición verdadera. Esa policy no aparece declarada con ese
nombre en los archivos revisados, por lo que puede provenir de una intervención
manual o de SQL no versionado. Si continúa vigente, domina en la práctica el
modelo de privacidad esperado.

### `agent_memories`

La migración `030` permite:

- lectura a cualquier usuario autenticado;
- inserción a roles `admin`, `gerencia` y `responsable`;
- ningún aislamiento por workspace, usuario o membresía de proyecto.

El inventario remoto reportado indica también `allow all / public / ALL /
true`. Si sigue vigente, cualquier cliente con privilegio de tabla suficiente
podría leer, insertar, modificar o borrar memoria.

### `workspace_state`

`schema.sql` y la migración `034` crean policies de lectura, inserción y
actualización con condiciones verdaderas. `035` concede esas operaciones a
`authenticated`.

El código usa una sola fila `id = 'default'`. Aunque el comentario habla de un
workspace compartido, el JSON sincronizado puede contener:

- Mesa de Trabajo;
- decisiones de aprobación;
- estados y skills;
- conocimiento;
- timeline;
- proyectos personalizados;
- notificaciones;
- asignaciones de modelos y configuración redactada.

La fila no tiene propietario, membresía, versión de concurrencia ni separación
por sensibilidad.

## 5. Tablas heredadas afectadas

| Tabla | Uso actual | Debilidad principal | Tratamiento |
| --- | --- | --- | --- |
| `agent_conversations` | Historial por agente y proyecto | Email mutable y pseudo-usuario compartido | Contener y migrar |
| `agent_memories` | Destino parcial de memoria | Sin propietario, evidencia, confianza ni aprobación | Congelar y sustituir |
| `workspace_state` | Snapshot y Mesa compartida | Una fila global editable | Reducir y sustituir |

Estas tablas pueden mantenerse temporalmente por compatibilidad, pero no deben
ser el modelo canónico de memoria futura.

## 6. Policies y grants sospechosos

### Confirmados en archivos locales

- `workspace_state_read`: `SELECT` con `USING (true)`.
- `workspace_state_write`: `INSERT` con `WITH CHECK (true)`.
- `workspace_state_update`: `UPDATE` con `USING (true)`.
- `roundtable_shared_memory`: `ALL` sobre
  `user_id = 'roundtable-shared'`.
- grant de `SELECT`, `INSERT`, `UPDATE` sobre `workspace_state` a
  `authenticated`.
- grant de `SELECT`, `INSERT`, `UPDATE`, `DELETE` sobre
  `agent_conversations` a `authenticated`.
- lectura de todas las memorias por cualquier rol autenticado.

### Reportados, pendientes de confirmar

- `agent_conversations`: `allow all / public / ALL / qual true`.
- `agent_memories`: `allow all / public / ALL / qual true`.
- grants efectivos para `anon` y herencia mediante `public`.

No debe proponerse un cambio remoto definitivo hasta distinguir policies
versionadas, policies manuales, grants directos y privilegios heredados.

## 7. Riesgo de cerrar RLS de golpe

Un cierre inmediato puede romper:

- guardado y lectura del Chat privado;
- historial por proyecto;
- memoria compartida `roundtable-shared`;
- carga, upsert, polling y Realtime de `workspace_state/default`;
- hidratación del store al abrir login o durante la resolución de sesión;
- mensajes de agentes insertados directamente desde el navegador;
- comportamiento de fallback, porque varias llamadas descartan errores con
  `.catch(() => {})` o retornan historial vacío.

`StoreProvider` se monta en el layout raíz y puede intentar acceso remoto antes
de que `AppShell` complete autenticación y aprobación. Una policy que exija
usuario aprobado necesita una adaptación coordinada del ciclo de hidratación.

## 8. Estrategia de contención temporal

La contención debe diseñarse y probarse primero en un entorno autorizado.

### Fase A: congelamiento

- mantener desactivada la memoria automática;
- no ampliar escrituras a `agent_memories`;
- impedir nuevas features dependientes de `workspace_state`;
- conservar evidencia del inventario previo;
- definir responsables, ventana y criterio de rollback.

### Fase B: adaptación mínima de aplicación

Antes de cerrar policies:

- esperar una sesión autenticada y perfil aprobado antes de sincronizar;
- dejar `localStorage` como fallback explícito si RLS rechaza acceso;
- retornar y registrar errores de persistencia sin contenido sensible;
- usar `session.user.id` como identidad futura;
- impedir que el navegador atribuya libremente mensajes a otro usuario;
- distinguir mensaje humano de respuesta de agente;
- limitar `workspace_state` al estado compartido estrictamente necesario.

### Fase C: contención RLS heredada

Conceptualmente:

- retirar policies genéricas con condición verdadera;
- retirar grants no requeridos, especialmente para `anon`;
- separar policies por `SELECT`, `INSERT`, `UPDATE` y `DELETE`;
- exigir autenticación y perfil `approved`;
- conservar acceso privado solo al propietario;
- permitir Mesa solo a miembros aprobados del workspace;
- prohibir modificación y borrado directo de mensajes;
- restringir memoria oficial a gerencia o administración;
- dejar cualquier operación privilegiada futura detrás de backend controlado.

En una migración futura aprobada, la eliminación de cada policy permisiva y la
creación de su reemplazo restrictivo deben ejecutarse dentro de una misma
transacción `BEGIN`/`COMMIT`. La migración debe abortar completamente ante
cualquier error para no dejar una ventana intermedia de exposición ni un estado
de bloqueo total por policies retiradas sin reemplazo.

No se incluye SQL de cambio en este documento.

## 9. Esquema futuro `ai_*`

### Entidades principales

| Entidad | Responsabilidad |
| --- | --- |
| `ai_workspaces` | Tenant o espacio organizacional |
| `ai_workspace_members` | Membresía, estado y rol dentro del workspace |
| `ai_conversations` | Hilo, tipo privado/mesa, proyecto y propietario |
| `ai_conversation_participants` | Usuarios y agentes con acceso al hilo |
| `ai_messages` | Mensajes inmutables, autor, secuencia y procedencia |
| `ai_project_members` | Acceso explícito a memoria por proyecto |
| `ai_memory_items` | Candidatos, criterios oficiales, observaciones y revocaciones |
| `ai_memory_sources` | Mensajes, registros y archivos que sustentan una memoria |
| `ai_memory_approvals` | Aprobación, rechazo, observación y revocación formal |
| `ai_memory_audit_log` | Eventos de seguridad y cambios relevantes |

### Campos transversales

- UUID de usuario enlazado a `auth.users`;
- `workspace_id`;
- `project_id` cuando aplique;
- `created_by`, `created_at`, `updated_at`;
- `visibility` y `sensitivity`;
- `trust_status`;
- `source_kind` y `source_id`;
- `valid_from`, `valid_until`;
- `supersedes_id`, `revoked_at`, `deleted_at`;
- clave idempotente y versión.

El email puede conservarse como dato de presentación o auditoría, pero no como
clave primaria de autorización.

## 10. Matriz de permisos

| Rol | Chat privado | Mesa compartida | Memoria candidata | Memoria oficial | Administración |
| --- | --- | --- | --- | --- | --- |
| `anon` | Ninguno | Ninguno | Ninguno | Ninguno | Ninguno |
| `pending` | Ninguno remoto | Ninguno | Ninguno | Ninguno | Ninguno |
| `approved_user` | Sus hilos | Workspaces donde es miembro | Leer/crear según proyecto | Lectura autorizada | Ninguno |
| `manager / gerencia` | Propios y acceso delegado auditable | Workspaces asignados | Revisar por proyecto | Aprobar, observar o revocar | Sin gestión técnica global |
| `admin` | Acceso excepcional auditable | Gestión de membresía | Gestión y soporte | Gestión según política institucional | Seguridad y configuración |
| `service/backend` | Solo operación requerida | Solo operación requerida | Procesamiento controlado | No autoaprobar | Service role solo servidor |

`manager` es el nombre conceptual del rol humano que deberá mapearse al rol
existente `gerencia` cuando se diseñe el esquema. No debe confundirse con el
agente IA `GG`.

## 11. Reglas de Chat privado

- conversación privada creada con `owner_user_id = auth.uid()`;
- participantes explícitos;
- lectura limitada al propietario y participantes autorizados;
- usuarios solo pueden insertar mensajes humanos con su propia identidad;
- mensajes de agentes deben registrar procedencia y ser creados por una ruta
  controlada;
- mensajes inmutables: sin `UPDATE` o `DELETE` ordinario;
- correcciones mediante nuevos eventos, no reescritura silenciosa;
- administración solo con causa, permiso y auditoría;
- no usar `"anonymous"` como identidad persistente.

## 12. Reglas de Mesa compartida

- la Mesa pertenece a un `workspace_id`;
- acceso solo para miembros `approved` y activos;
- no usar `roundtable-shared` como propietario;
- cada mensaje conserva autor humano real o agente real;
- todos los miembros autorizados pueden leer;
- cada humano solo inserta como sí mismo;
- edición o borrado requieren flujo explícito y auditoría;
- Realtime debe filtrar por las mismas reglas RLS;
- adjuntos se referencian, no se guardan como base64 en snapshots.

## 13. Reglas de memoria oficial

- toda memoria nace como `registrado` o `candidato`;
- persistencia no equivale a aprobación;
- solo `manager` o `admin` autorizado puede oficializar;
- toda aprobación registra actor, fecha, motivo, alcance y fuentes;
- memorias observadas o revocadas no se inyectan como verdad vigente;
- los datos operativos mutables se revalidan contra Supabase;
- agentes y procesos backend no pueden autoaprobar memoria;
- acceso por workspace y proyecto, con mínimo privilegio.

## 14. Reglas para `workspace_state`

Durante la transición:

- mantener una única finalidad compartida y documentada;
- no guardar chats privados, claves, archivos base64 ni datos sensibles;
- exigir usuario aprobado;
- limitar acceso a miembros del workspace;
- agregar control de versión o concurrencia antes de confiar en upserts;
- tratar errores de Realtime y polling de forma visible;
- separar gradualmente Mesa, decisiones, conocimiento y preferencias.

En el estado objetivo, `workspace_state` debe quedar reducido a preferencias o
estado efímero no sensible. Los mensajes y decisiones deben vivir en entidades
normalizadas.

## 15. Migración posterior

La migración se diseñará en una fase separada, después de confirmar el
inventario y probar la contención:

1. Crear el esquema `ai_*` en un entorno aislado.
2. Adaptar la aplicación para escritura dual controlada, sin activar captura
   automática masiva.
3. Migrar primero historial bruto como `registrado`, conservando procedencia.
4. Mapear emails heredados a UUID solo cuando exista correspondencia
   verificable.
5. Tratar `roundtable-shared` como origen legado, no como identidad.
6. Tratar memorias heredadas como `candidato` u `observado`, nunca como
   `oficial` por defecto.
7. Reconciliar conteos, orden, duplicados y permisos.
8. Cambiar lecturas al esquema nuevo por fases y con métricas.
9. Retirar escrituras heredadas solo después de verificar rollback.
10. Conservar las tablas anteriores durante la ventana aprobada de
    estabilización.

Cada paso requiere migración versionada, pruebas, revisión y autorización
explícita. Este documento no autoriza crear ni ejecutar esa migración.

## 16. Pruebas mínimas requeridas

Probar con identidades separadas:

- cliente sin sesión;
- usuario pendiente;
- dos usuarios aprobados;
- manager;
- admin;
- backend autorizado en entorno de prueba.

Casos mínimos:

1. `anon` no puede leer ni escribir ninguna tabla de memoria.
2. `pending` no puede acceder a memoria remota.
3. Usuario A no puede leer el Chat privado de B.
4. Usuario A no puede insertar mensajes atribuidos a B.
5. Miembros de Mesa leen y publican en su workspace.
6. No miembros no ven Mesa ni reciben eventos Realtime.
7. Un usuario no puede modificar o borrar mensajes ajenos.
8. Solo roles autorizados oficializan o revocan memoria.
9. El aislamiento por proyecto funciona en lectura y escritura.
10. Logout elimina acceso en consultas y suscripciones.
11. Fallos RLS no se silencian ni destruyen historial local.
12. Polling, Realtime y reintentos no duplican mensajes.
13. El cliente no contiene `service_role`.
14. Las policies abiertas dejan de aparecer en el inventario posterior.
15. Un miembro de `workspace_id = A` no puede leer, escribir ni recibir eventos
    Realtime de conversaciones o memorias de `workspace_id = B`.

Las pruebas deben incluir REST directo con anon key y JWT de cada rol, no solo
la interfaz.

## 17. Rollback conceptual

Antes de aplicar cualquier remediación:

- exportar definiciones de policies, grants y funciones, no datos productivos;
- registrar conteos y comportamiento base;
- versionar la migración y su reversa;
- mantener fallback local;
- definir métricas de error, ventana y responsable;
- aplicar primero en entorno de prueba;
- detener rollout ante fallos de login, persistencia o aislamiento.

El rollback debe restaurar temporalmente la última configuración conocida sin
reintroducir acceso `anon` o policies `allow all`. Si la compatibilidad exige
reabrir acceso indiscriminado, el despliegue debe abortarse y volver a modo
local, no degradar seguridad.

## 18. Pasos antes de SQL real

1. Aprobar este plan y el alcance de inventario.
2. Ejecutar, con autorización, el checklist de solo lectura.
3. Confirmar policies, grants, volumen, Realtime y dependencias.
4. Clasificar datos y definir retención.
5. Definir workspace membership y rol humano de aprobación.
6. Diseñar cambios mínimos de cliente para sesión y errores.
7. Preparar migración de contención y rollback en archivos nuevos.
8. Revisar SQL con un segundo auditor.
9. Probar con datos mock o entorno aislado.
10. Obtener aprobación explícita antes de ejecutar en Supabase real.

Hasta completar estos pasos, la memoria automática permanece bloqueada.
