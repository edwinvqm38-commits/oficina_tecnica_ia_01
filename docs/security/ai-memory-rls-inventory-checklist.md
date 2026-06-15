# Checklist de inventario RLS para memoria IA

Estado: consultas propuestas, no ejecutadas.

Fecha: 2026-06-15.

## 1. Condiciones de ejecución futura

- Obtener autorización explícita para consultar Supabase real.
- Usar un entorno y rol de auditoría de solo lectura cuando sea posible.
- No incluir contenidos de chats, memorias, archivos ni datos personales en el
  informe.
- Registrar proyecto, entorno, fecha, actor y hash del código auditado.
- No ejecutar `ALTER`, `CREATE`, `DROP`, `GRANT`, `REVOKE`, `INSERT`, `UPDATE`,
  `DELETE`, `TRUNCATE`, RPC mutantes ni migraciones.
- Revisar cada consulta antes de ejecutarla.
- Guardar solo metadatos, conteos y definiciones de seguridad necesarias.

Las consultas siguientes son propuestas para una fase posterior. Ninguna fue
ejecutada durante la creación de este documento.

## 2. Estado RLS de tablas objetivo

Objetivo: confirmar existencia, propietario y activación/forzado de RLS.

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  pg_get_userbyid(c.relowner) as owner_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'agent_conversations',
    'agent_memories',
    'workspace_state'
  )
order by c.relname;
```

Checklist:

- [ ] Las tres tablas existen.
- [ ] RLS está habilitado.
- [ ] Se documentó si `FORCE ROW LEVEL SECURITY` está activo.
- [ ] Se documentó el propietario sin divulgar credenciales.

## 3. Policies activas

Objetivo: obtener todas las policies reales, no solo las versionadas.

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'agent_conversations',
    'agent_memories',
    'workspace_state'
  )
order by tablename, policyname;
```

Checklist:

- [ ] Confirmar o descartar policies llamadas `allow all`.
- [ ] Detectar `roles` que incluyan `public`, `anon` o `authenticated`.
- [ ] Detectar `cmd = ALL`.
- [ ] Detectar `qual` o `with_check` verdaderos.
- [ ] Identificar policies permisivas que se combinen mediante `OR`.
- [ ] Comparar resultado con migraciones `030`, `034` y `035`.

## 4. Grants de tabla

Objetivo: identificar privilegios directos concedidos a roles API.

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'agent_conversations',
    'agent_memories',
    'workspace_state'
  )
order by table_name, grantee, privilege_type;
```

Verificación explícita de privilegios efectivos:

```sql
select
  role_name,
  table_name,
  has_table_privilege(role_name, format('public.%I', table_name), 'SELECT') as can_select,
  has_table_privilege(role_name, format('public.%I', table_name), 'INSERT') as can_insert,
  has_table_privilege(role_name, format('public.%I', table_name), 'UPDATE') as can_update,
  has_table_privilege(role_name, format('public.%I', table_name), 'DELETE') as can_delete
from
  (values ('anon'), ('authenticated')) as roles(role_name)
cross join
  (values
    ('agent_conversations'),
    ('agent_memories'),
    ('workspace_state')
  ) as tables(table_name)
order by table_name, role_name;
```

Checklist:

- [ ] Confirmar privilegios efectivos de `anon`.
- [ ] Confirmar privilegios efectivos de `authenticated`.
- [ ] Detectar grants heredados mediante `public`.
- [ ] Verificar que grants y policies se evalúan conjuntamente.

## 5. Exposición de tablas del esquema público

Objetivo: detectar otras tablas relacionadas expuestas a roles API.

```sql
select
  t.table_schema,
  t.table_name,
  array_agg(distinct g.grantee order by g.grantee) as grantees,
  array_agg(distinct g.privilege_type order by g.privilege_type) as privileges
from information_schema.tables t
join information_schema.role_table_grants g
  on g.table_schema = t.table_schema
 and g.table_name = t.table_name
where t.table_schema = 'public'
  and g.grantee in ('anon', 'authenticated', 'PUBLIC')
group by t.table_schema, t.table_name
order by t.table_name;
```

Checklist:

- [ ] Identificar tablas de conversación, credenciales, perfiles o archivos.
- [ ] Revisar por separado cualquier tabla con secretos o tokens.
- [ ] No ampliar el alcance operativo sin nueva autorización.

## 6. Columnas y sensibilidad

Objetivo: inventariar estructura sin leer contenido.

```sql
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'agent_conversations',
    'agent_memories',
    'workspace_state'
  )
order by table_name, ordinal_position;
```

Checklist de clasificación:

- [ ] Identificadores personales: `user_id`, emails y UUID.
- [ ] Contenido sensible: mensajes y memoria.
- [ ] Datos de proyecto.
- [ ] Metadatos de modelos.
- [ ] JSON amplio en `workspace_state`.
- [ ] Adjuntos, URLs, base64 o secretos potenciales.
- [ ] Fechas necesarias para retención y auditoría.

No consultar muestras de `content` o `state` durante el inventario inicial.

## 7. Volúmenes y antigüedad

Objetivo: estimar impacto sin recuperar contenido.

```sql
select
  'agent_conversations' as table_name,
  count(*) as row_count,
  min(created_at) as oldest_record,
  max(created_at) as newest_record
from public.agent_conversations
union all
select
  'agent_memories',
  count(*),
  min(created_at),
  max(created_at)
from public.agent_memories;
```

```sql
select
  count(*) as row_count,
  min(updated_at) as oldest_update,
  max(updated_at) as newest_update
from public.workspace_state;
```

Distribuciones no sensibles:

```sql
select role, count(*) as row_count
from public.agent_conversations
group by role
order by role;
```

```sql
select memory_type, count(*) as row_count
from public.agent_memories
group by memory_type
order by memory_type;
```

Checklist:

- [ ] Registrar conteos, no contenidos.
- [ ] Estimar ventana de migración y rollback.
- [ ] Detectar valores fuera de catálogo sin listar texto sensible.

## 8. Usuarios y perfiles

Objetivo: conocer roles y estados sin exportar emails ni nombres.

```sql
select
  status,
  role,
  is_super_admin,
  count(*) as profile_count
from public.user_profiles
group by status, role, is_super_admin
order by status, role, is_super_admin;
```

```sql
select
  count(*) as auth_user_count
from auth.users;
```

```sql
select
  count(*) filter (where p.id is null) as users_without_profile,
  count(*) filter (where p.id is not null) as users_with_profile
from auth.users u
left join public.user_profiles p on p.id = u.id;
```

Checklist:

- [ ] Confirmar estados `pending`, `approved`, `disabled` o equivalentes.
- [ ] Confirmar roles reales disponibles.
- [ ] Identificar usuarios sin perfil mediante conteo.
- [ ] No exportar correos, nombres, tokens ni metadata de identidad.
- [ ] Definir qué rol humano podrá aprobar memoria oficial.

## 9. Uso de identidades heredadas

Objetivo: medir dependencia de email y `roundtable-shared` sin leer mensajes.

```sql
select
  count(*) filter (where user_id = 'roundtable-shared') as shared_rows,
  count(*) filter (where user_id = 'anonymous') as anonymous_rows,
  count(*) filter (
    where user_id <> 'roundtable-shared'
      and user_id <> 'anonymous'
  ) as other_identity_rows
from public.agent_conversations;
```

Validación agregada contra perfiles:

```sql
select
  count(*) filter (where p.id is not null) as rows_matching_profile_email,
  count(*) filter (
    where p.id is null
      and c.user_id not in ('roundtable-shared', 'anonymous')
  ) as rows_without_profile_match
from public.agent_conversations c
left join public.user_profiles p
  on lower(p.email) = lower(c.user_id);
```

Checklist:

- [ ] Cuantificar filas compartidas.
- [ ] Cuantificar filas anónimas.
- [ ] Cuantificar identidades sin perfil.
- [ ] No listar emails ni contenidos.

## 10. Realtime

Objetivo: confirmar tablas publicadas y su impacto.

```sql
select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where schemaname = 'public'
  and tablename in (
    'agent_conversations',
    'agent_memories',
    'workspace_state',
    'user_profiles'
  )
order by pubname, tablename;
```

Checklist:

- [ ] Confirmar publicación de `workspace_state`.
- [ ] Confirmar si conversaciones o memorias emiten eventos.
- [ ] Verificar después que Realtime respete RLS por usuario y workspace.
- [ ] Documentar suscripciones frontend y filtros.

## 11. Funciones, RPC y triggers

Objetivo: detectar caminos que puedan saltar o modificar el modelo RLS.

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  r.rolname as owner_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
order by p.proname, arguments;
```

Funciones que referencian tablas objetivo:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and (
    pg_get_functiondef(p.oid) ilike '%agent_conversations%'
    or pg_get_functiondef(p.oid) ilike '%agent_memories%'
    or pg_get_functiondef(p.oid) ilike '%workspace_state%'
  )
order by p.proname;
```

Triggers:

```sql
select
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'agent_conversations',
    'agent_memories',
    'workspace_state'
  )
order by event_object_table, trigger_name, event_manipulation;
```

Checklist:

- [ ] Revisar funciones `SECURITY DEFINER`.
- [ ] Revisar `search_path` y propietario.
- [ ] Confirmar grants `EXECUTE`.
- [ ] Identificar RPC usados por frontend o automatizaciones.
- [ ] Confirmar que ningún trigger oficializa memoria automáticamente.

## 12. Vistas y dependencias

Objetivo: detectar vistas que expongan las tablas objetivo.

```sql
select
  view_schema,
  view_name,
  table_schema,
  table_name
from information_schema.view_table_usage
where table_schema = 'public'
  and table_name in (
    'agent_conversations',
    'agent_memories',
    'workspace_state'
  )
order by view_schema, view_name, table_name;
```

Checklist:

- [ ] Identificar vistas normales y materializadas relacionadas.
- [ ] Revisar privilegios de cada vista.
- [ ] Verificar si la vista respeta el invocador o privilegios del propietario.

## 13. Dependencias del frontend

Estas comprobaciones son locales y no consultan Supabase:

```powershell
rg -n "agent_conversations|agent_memories|workspace_state" oficina-tecnica
rg -n "roundtable-shared|anonymous|user_id|auth.uid|auth.email" oficina-tecnica
rg -n 'from\("(agent_|workspace_state)' oficina-tecnica
rg -n "channel\\(|postgres_changes|upsert\\(" oficina-tecnica
rg -n "service_role|SUPABASE_SERVICE_ROLE" oficina-tecnica
```

Checklist:

- [ ] Enumerar lecturas, inserciones, actualizaciones y borrados.
- [ ] Identificar llamadas que silencian errores.
- [ ] Identificar acceso antes de resolver sesión y aprobación.
- [ ] Confirmar que `service_role` no está en frontend ni variables públicas.
- [ ] Registrar rutas Realtime y polling.
- [ ] Identificar datos incluidos en `workspace_state`.

## 14. Evidencia a conservar

El informe autorizado debe contener:

- fecha, entorno y rol de auditoría;
- resultado resumido de RLS y grants;
- nombres de policies y comandos;
- conteos agregados;
- funciones o RPC relevantes;
- tablas publicadas en Realtime;
- diferencias frente a migraciones locales;
- riesgos y decisión de avanzar o bloquear.

No debe contener:

- mensajes;
- contenido de memorias;
- JSON de `workspace_state`;
- emails individuales;
- nombres de usuarios;
- tokens, claves o secretos;
- dumps de tablas.

## 15. Criterio de salida

El inventario se considera suficiente cuando:

- se conocen todas las policies y grants efectivos;
- se confirma la exposición de `anon` y `authenticated`;
- se conoce el volumen sin extraer contenido;
- se identifican Realtime, vistas, RPC y triggers;
- se conocen dependencias frontend;
- existe una matriz de usuarios de prueba;
- Gerencia aprueba la contención y el rollback.

Hasta entonces, no se debe ejecutar SQL de remediación ni activar memoria
automática.
