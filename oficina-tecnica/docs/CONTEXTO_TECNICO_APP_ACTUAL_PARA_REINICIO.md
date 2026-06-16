# CONTEXTO TÉCNICO — APP ACTUAL PARA REINICIO
**Oficina Técnica IA / IA Gerencial**
*Documento generado el 2026-06-16 — Solo lectura, sin modificaciones al código*

---

## 1. Resumen Ejecutivo

### Qué es la aplicación actual
"Oficina Técnica IA" es una plataforma web de gestión interna para la empresa de ingeniería eléctrica **EKA Ingeniería**. Combina un sistema de gestión de proyectos y cotizaciones (SGP) con una capa de agentes IA que pueden consultar los datos reales de la empresa y responder preguntas sobre cotizaciones, requerimientos, costos y estado de proyectos.

### Para qué fue construida
- Centralizar la gestión de cotizaciones, requerimientos de compra y propuestas técnicas.
- Permitir que un equipo de ingeniería (IC, PM, IE, GG) consulte datos del negocio a través de agentes IA especializados.
- Reemplazar hojas de cálculo y procesos manuales dispersos.
- Proveer una "mesa de trabajo" colaborativa en tiempo real para el equipo.

### Qué problema intenta resolver
- Dispersión de información en Excel y correos.
- Falta de trazabilidad entre cotización → requerimiento → compra → entrega.
- Dificultad para que gerencia obtenga resúmenes rápidos sin depender de personas intermediarias.
- Necesidad de un asistente IA que acceda a datos reales sin inventar información.

### Por qué se recomienda reiniciar desde cero
El sistema acumuló deuda técnica significativa durante su construcción incremental:

1. **Base de datos sin diseño previo**: las tablas fueron creadas sobre la marcha con 36 migraciones acumuladas, con parches sobre parches, recursión en RLS, y columnas faltantes descubiertas al importar datos históricos.
2. **Mezcla de datos reales y demo**: `demoData.ts` se usa como fallback cuando Supabase falla, mezclando datos ficticios con reales en las mismas vistas.
3. **Estado global monolítico**: todo el estado de UI vive en un único JSON `workspace_state` en Supabase, lo que es insostenible a escala.
4. **RLS reactivo**: las policies de seguridad se agregaron una a una al detectar errores 403, sin un diseño previo de permisos.
5. **Realtime incompleto**: `workspace_state` tiene Realtime pero faltan GRANTs (migración 035), y el directorio de usuarios aprobados requiere una policy que no se aplicó (migración 036).
6. **Código de IA sobreingeniería prematura**: la capa de chat tiene 18+ módulos especializados (crossIntentRegistry, scopeResolver, contextGuardrails, etc.) construidos antes de que el modelo de datos estuviera estable.

---

## 2. Estado Técnico Actual

### Framework y lenguaje
- **Next.js 16.2.7** con **App Router** (`app/` directory)
- **TypeScript 5** — strict mode activado
- **React 19.2.4**
- **Tailwind CSS 3.4** (sin componentes de UI de terceros — todo CSS inline o Tailwind utilitario)

### Librerías principales

| Librería | Versión | Uso |
|---|---|---|
| `@supabase/supabase-js` | ^2.107.0 | Base de datos, Auth, Realtime, Storage |
| `next` | 16.2.7 | Framework SSR/SPA |
| `react` / `react-dom` | 19.2.4 | UI |
| `mammoth` | ^1.12.0 | Extracción de texto desde .docx |
| `pdfjs-dist` | ^6.0.227 | Extracción de texto desde PDF |
| `tesseract.js` | ^7.0.0 | OCR de imágenes |
| `xlsx` | ^0.18.5 | Lectura de archivos Excel |
| `tailwindcss` | ^3.4.19 | Estilos |

### Riesgos detectados
- **`xlsx` 0.18.5**: versión con vulnerabilidades conocidas (CVE). Considerar `exceljs` o similar.
- **`tesseract.js` en cliente**: carga WASM pesado (~10 MB), impacta tiempo de carga inicial.
- **`pdfjs-dist` 6.x en cliente**: similar problema de bundle size.
- **Sin gestor de estado externo** (Redux/Zustand/Jotai): todo el estado compartido va por Supabase JSON, frágil.
- **Sin test unitarios ni e2e**: no hay `jest`, `vitest`, `playwright`, ni `cypress`.
- **Sin Supabase CLI local** (`supabase/migrations/`): las migraciones están en `supabase/sql/` como scripts numerados, no en el flujo oficial de Supabase.

### Deuda técnica visible
- Dos clientes Supabase distintos: `lib/supabaseClient.ts` (para Auth/UI general) y `lib/sgp/supabaseClient.ts` (para SGP), duplicando la configuración.
- `lib/sgp/demoData.ts` mezcla tipos con datos de prueba. Las funciones de repositorio hacen fallback a demo si Supabase falla, sin distinción clara en UI.
- `lib/data.ts` contiene proyectos/aprobaciones/alertas ficticias que contaminan el contexto de los agentes IA (bug corregido en un commit pero el archivo persiste).
- El componente `DataTable` en SGP intenta ser genérico pero tiene decenas de props específicas de cotizaciones/requerimientos — acoplado.
- `CotizacionesContent.tsx` tiene ~1400 líneas, manejando cotizaciones, requerimientos, ítems y propuestas técnicas en un solo componente.

---

## 3. Mapa de Carpetas y Archivos Importantes

```
oficina-tecnica/
├── app/                    # Next.js App Router — páginas y API routes
│   ├── (app)/              # Grupo de rutas autenticadas (layout compartido)
│   │   ├── cotizaciones/   # Módulo SGP cotizaciones
│   │   ├── requerimientos/ # Módulo SGP requerimientos
│   │   ├── recursos/       # Catálogo de recursos/materiales
│   │   ├── operaciones/    # Vista de operaciones (Pendiente de confirmar estado)
│   │   ├── mesa-trabajo/   # Mesa de trabajo colaborativa con agentes (Roundtable)
│   │   ├── chat/           # Chat privado por agente
│   │   ├── oficina/        # Vista Oficina Virtual IA (organigrama de agentes)
│   │   ├── agentes/        # Wiki de agentes IA
│   │   ├── skills/         # Registry de skills de agentes
│   │   ├── aprobaciones/   # Flujo de aprobaciones
│   │   ├── bandeja/        # Bandeja de entrada gerencial
│   │   ├── conocimiento/   # Base de conocimiento IA
│   │   ├── datos/          # Vista de datos/tablas
│   │   ├── administrador/  # Panel de administración
│   │   ├── admin-usuarios/ # Gestión de usuarios
│   │   ├── conexiones/     # Gestión de conexiones a modelos LLM
│   │   ├── linea-tiempo/   # Timeline de actividades
│   │   ├── organigrama/    # Organigrama de la empresa
│   │   └── wiki-ia/        # Wiki de la IA
│   ├── api/
│   │   └── llm/
│   │       ├── chat/       # API route proxy para LLMs (evita exponer API keys al browser)
│   │       └── status/     # Endpoint de health check de proveedores LLM
│   ├── auth/callback/      # Callback de OAuth (Google Sign-In)
│   ├── login/              # Página de login (email/password + Google OAuth)
│   └── pendiente/          # Página de acceso pendiente (usuarios sin aprobar)
│
├── components/
│   ├── shell/              # Layout: Sidebar, Topbar, PresenceBar, ErrorBoundary
│   ├── views/              # Vistas principales: Dashboard, ChatView, RoundtableView, etc.
│   ├── sgp/                # Sistema SGP: DataTable, modales, forms, catálogos, repos
│   │   ├── pages/          # Contenido de páginas SGP (CotizacionesContent, etc.)
│   │   ├── quotations/     # Componentes de cotizaciones (workspace modal, cashflow)
│   │   ├── requirements/   # Componentes de requerimientos
│   │   ├── resources/      # Catálogo de recursos
│   │   ├── technical-proposal/ # Propuesta Técnica workspace
│   │   ├── catalogs/       # CRUD genérico de catálogos
│   │   ├── auth/           # AuthContext (hook de sesión + perfil)
│   │   └── ui/             # Primitivos de UI SGP (DateInput, FieldLock, etc.)
│   ├── chat/               # Componentes de chat: MdText, HelpPanel, AgentsWiki
│   └── ai-office/          # Componentes visuales de la Oficina IA (canvas, org chart, etc.)
│
├── lib/
│   ├── sgp/                # Lógica de negocio SGP: repositorios, caché, utilidades
│   ├── chat/               # Capa IA: router, tools, anti-alucinación, agentes, feedback
│   ├── llm/                # Proveedores LLM: providers.ts, modelRouter.ts, agentModels.ts
│   ├── auth/               # Hooks de Auth: useSession, useAccessGate, useSectionAccess
│   ├── memory/             # Memoria conversacional: conversationMemory.ts
│   ├── presence/           # Presencia Supabase: usePresence, useRoomPresence, useApprovedUsers
│   ├── store/              # Estado global: StoreProvider, persistence, types
│   ├── ai-office/          # Tipos y mocks para la Oficina IA virtual
│   ├── supabase/           # Cliente Supabase general: client.ts
│   ├── supabaseClient.ts   # Cliente Supabase legacy (duplicado — ver deuda técnica)
│   ├── data.ts             # Datos mock/demo (proyectos, aprobaciones — contamina contexto IA)
│   ├── types.ts            # Tipos globales (Project, Skill, Approval, etc.)
│   └── routes.ts           # Definición de rutas de navegación
│
├── supabase/
│   ├── schema.sql          # Schema inicial (workspace_state, provider_credentials)
│   └── sql/                # 31 migraciones acumuladas (006 a 036)
│
└── docs/                   # Este documento (creado ahora)
```

---

## 4. Módulos Funcionales Existentes

### Dashboard
**Ruta:** `/` (dentro del grupo app)
**Archivo:** `components/views/DashboardView.tsx`
**Estado:** Parcialmente funcional. Muestra KPIs, alertas y timeline del store global. Los datos de proyectos son del mock `lib/data.ts`, no de Supabase.

### Cotizaciones
**Ruta:** `/cotizaciones`
**Archivos clave:** `components/sgp/pages/CotizacionesContent.tsx`, `lib/sgp/quotationsRepository.ts`, `lib/sgp/quotationEconomics.ts`, `lib/sgp/quotationCashflow.ts`
**Estado:** Funcional con datos reales de Supabase. El módulo más completo.
**Capacidades:** CRUD completo, filtros, paginación, cashflow, resumen económico, vinculación a requerimientos, propuesta técnica, módulo de permisos por usuario.

### Requerimientos
**Ruta:** `/requerimientos`
**Archivos clave:** `components/sgp/pages/RequerimientosContent.tsx`, `lib/sgp/requirementsRepository.ts`, `lib/sgp/requirementItemsRepository.ts`
**Estado:** Funcional con datos reales. Incluye importación histórica.
**Capacidades:** Listado, filtros, grid de ítems por RQ, estados, responsables, trazabilidad hacia cotización.

### Catálogo de Recursos (Materiales/Servicios)
**Ruta:** `/recursos`
**Archivos:** `components/sgp/pages/RecursosContent.tsx`, `lib/sgp/recursosRepository.ts`, `components/sgp/resources/`
**Estado:** Funcional. Incluye upload de archivos adjuntos al storage de Supabase.

### Propuesta Técnica
**Ruta:** Acceso desde modal dentro de Cotizaciones
**Archivos:** `components/sgp/technical-proposal/`, `lib/sgp/technicalProposalsRepository.ts`, `supabase/sql/020_technical_proposals_schema.sql`
**Estado:** Parcialmente implementado. Estructura jerárquica (grupo/subgrupo/actividad), recursos vinculados, logos de empresa/cliente, revisiones.

### Autenticación y Usuarios
**Archivos:** `app/login/page.tsx`, `app/auth/callback/page.tsx`, `app/pendiente/page.tsx`, `lib/auth/`, `components/sgp/auth/AuthContext.tsx`
**Estado:** Funcional. Email+password + Google OAuth. Sistema de aprobación manual por admin.
**Flujo:** Registro → pendiente → admin aprueba → acceso. Email admin hardcodeado: `edwin.qm@outlook.com`.

### Roles y Permisos
**Archivos:** `lib/sgp/modulePermissionsRepository.ts`, `lib/sgp/modulePermissionsCatalog.ts`, `lib/auth/useSectionAccess.ts`
**Estado:** Funcional. Sistema granular de permisos por módulo (`admin_module_permissions`). Cada usuario tiene permisos específicos para ver/editar/aprobar en cada sección.

### Chat IA (privado por agente)
**Ruta:** `/chat`
**Archivos:** `components/views/ChatView.tsx`, `lib/chat/contextRouter.ts`, `lib/llm/providers.ts`
**Estado:** Funcional. Chat privado por agente (IC, PM, IE, GG). Consulta datos reales de Supabase vía pipeline de contexto.

### Mesa de Trabajo (Roundtable)
**Ruta:** `/mesa-trabajo`
**Archivos:** `components/views/RoundtableView.tsx`, `lib/presence/useRoomPresence.ts`, `lib/store/persistence.ts`
**Estado:** Parcialmente funcional. Realtime requiere migración 035 (GRANTs) y 036 (directorio usuarios).

### Agentes IA
**Agentes definidos:** IC (Ingeniero de Costos), PM (Project Manager), IE (Ingeniera Eléctrica), GG (Gerente General — rol humano)
**Archivos:** `lib/chat/agentProfiles.ts`, `components/views/RoundtableView.tsx` (prompts por agente)

### Oficina Virtual IA
**Ruta:** `/oficina`
**Archivos:** `components/ai-office/`, `lib/ai-office/`
**Estado:** Visual/mock. Organigrama de agentes IA con canvas animado. No conectado a datos reales — usa mocks.

### Memoria IA
**Archivos:** `lib/memory/conversationMemory.ts`, tablas `agent_conversations`, `agent_memories`
**Estado:** Implementado. Guarda conversaciones por agente y usuario en Supabase.

### Skills IA
**Ruta:** `/skills`
**Archivos:** `components/views/SkillsView.tsx`, `lib/ai-office/skillWorkflowTypes.ts`
**Estado:** Visual. Skills versionadas con trigger, pasos y reglas de seguridad. Se inyectan en el system prompt de agentes cuando están activas.

### Aprobaciones
**Ruta:** `/aprobaciones`
**Archivos:** `components/views/ApprovalsView.tsx`
**Estado:** Visual/mock. Flujo de aprobaciones gerenciales usando datos del store.

### Importación Histórica
**Archivos:** `lib/sgp/historicalImportQuality.ts`, `supabase/sql/012_`, `013_`, `014_`, `015_`, `016_`, `017_`
**Estado:** Implementado como proceso batch. Importa datos históricos de cotizaciones/requerimientos con trazabilidad de calidad.

---

## 5. Flujo de Negocio Actual

```
CLIENTE/INVITACIÓN
      ↓
COTIZACIÓN (COT-EKA-XXXX)
  - Estado: Borrador → Elaboración → VB Gerencia → Enviada → Ganada/Perdida
  - Responsable técnico + responsable económico
  - Moneda: PEN o USD
  - Resumen económico por tipo de recurso
  - Cashflow mensual
      ↓ (si Ganada/Adjudicada)
REQUERIMIENTO (RQ-XXXX-YYYY-ZZZ)
  - Vinculado a cotización por cotizacion_id + cotizacion_codigo
  - Estado: Pendiente → En proceso → Atendido
  - Ítems del requerimiento (requerimiento_items):
      - Recurso vinculado del catálogo
      - Cantidad, precio unitario, subtotal
      - Proveedor, condición de pago, tiempo de entrega
      - Estado logístico: EQ, LL, HB (campos de aprobación)
      - logistica_compra, fecha_compra, OC/OS del recurso
      ↓
SEGUIMIENTO LOGÍSTICO
  - Estados por ítem: por_cotizar → cotizado → aprobado → compra → recibido
  - Aprobaciones: EQ (Equipo), LL (Licitación/Lote), HB (Pendiente de confirmar)
  - OC/OS por recurso
      ↓
PROPUESTA TÉCNICA (PT-XXXX-YYYY)
  - Documento formal vinculado a cotización
  - Estructura jerárquica: grupo → subgrupo → actividad
  - Recursos asignados por actividad
  - Revisiones (REV00, REV01…)
      ↓
ENTREGABLE / CIERRE
```

**Actores del sistema:**
- **Admin** (`edwin.qm@outlook.com`): gestión de usuarios, permisos globales
- **IC** (Ingeniero de Costos): costos, presupuestos, resúmenes económicos
- **PM** (Project Manager): cronograma, avance, riesgos
- **IE** (Ingeniera Eléctrica): diseño técnico, normas, clasificación de recursos
- **GG** (Gerente General): aprobaciones, visión ejecutiva

---

## 6. Sistema de Cotizaciones

### Archivos principales
| Archivo | Rol |
|---|---|
| `lib/sgp/quotationsRepository.ts` | CRUD Supabase: `createCotizacion`, `updateCotizacion`, `listCotizaciones` |
| `lib/sgp/quotationEconomics.ts` | Cálculo de margen, resumen económico por tipo de recurso |
| `lib/sgp/quotationCashflow.ts` | Cashflow mensual proyectado |
| `components/sgp/pages/CotizacionesContent.tsx` | Componente maestro (~1400 líneas) |
| `components/sgp/quotations/QuotationWorkspaceModal.tsx` | Modal de edición completa |
| `components/sgp/quotations/QuotationCashflowDashboardView.tsx` | Vista de cashflow |
| `lib/sgp/demoData.ts` | Tipos + fallback demo: `Cotizacion`, `EstadoCotizacion` |

### Campos clave de la tabla `cotizaciones` (inferidos)
`id`, `codigo`, `oc`, `cliente_id`, `cliente_nombre`, `proyecto`, `unidad_trabajo_id`, `unidad_trabajo_nombre`, `moneda_codigo`, `estado`, `estado_propuesta`, `solicitante`, `responsable_tecnico`, `responsable_economico`, `fecha_registro`, `fecha_presentacion`, `fecha_invitacion`, `fecha_confirmacion`, `fecha_visita_tecnica`, `fecha_consultas`, `fecha_abs_consultas`, `fecha_entrega`, `fecha_entregada`, `fecha_oc`, `tipo_servicio`, `prioridad`, `avance`, `observaciones`, `resumen_economico (jsonb)`, `monto`, `flat_mensual`, `metadata (jsonb)`

### Estados de cotización
`Borrador` → `En revisión` → `Elaboración de cotización` → `VB Gerencia` → `Aprobada para envío` → `Enviada` → `Ganada` / `Perdida / No adjudicada` / `Cancelado` / `No adjudicado` / `Adjudicado`

### Qué rescatar
- Tipos TypeScript (`Cotizacion`, `EstadoCotizacion`, `CotizacionEconomicRow`)
- Lógica de `quotationEconomics.ts` (cálculo de márgenes)
- Lógica de `quotationCashflow.ts` (cashflow mensual)
- Validaciones de campos obligatorios en `createCotizacion`

### Qué rehacer
- Separar `CotizacionesContent.tsx` (monolito de 1400 líneas) en componentes pequeños
- Eliminar dependencia de `demoData.ts` como fallback silencioso
- Rediseñar los campos de moneda (actualmente mezcla PEN/USD sin conversión forzada)
- Tablas de clientes y unidades de trabajo como entidades propias, no como campos de texto libre

---

## 7. Sistema de Requerimientos

### Archivos principales
| Archivo | Rol |
|---|---|
| `lib/sgp/requirementsRepository.ts` | CRUD: crear/listar/buscar requerimientos |
| `lib/sgp/requirementItemsRepository.ts` | CRUD de ítems por RQ |
| `lib/sgp/historicalImportQuality.ts` | Trazabilidad de datos importados históricamente |
| `components/sgp/pages/RequerimientosContent.tsx` | Vista principal |
| `components/sgp/RequirementWorkspaceModal.tsx` | Modal de edición con ítems |
| `components/sgp/RequirementItemsGrid.tsx` | Grid de ítems editable |
| `components/sgp/requirements/NewRequirementModal.tsx` | Crear RQ desde cotización ganada |

### Funciones críticas (NO romper)
- `createRequirementFromWonQuotationSupabase`: crea un RQ a partir de una cotización ganada
- `deleteNewRequirementIfEmpty`: elimina RQ recién creado si está vacío (rollback seguro)
- `saveRequirementItemsForRequirement`: guarda ítems en batch
- Generación de código RQ (`RQ-{CLIENTE}-{UNIDAD}-{AÑO}-{SEQ}`)

### Estructura de código RQ
El código RQ se construye a partir de:
- `codigo_cliente` (código de la empresa cliente)
- `codigo_unidad` (unidad de trabajo/planta)
- `anio` (año del requerimiento)
- Secuencial numérico

Los metadatos de código se almacenan en `metadata jsonb` del registro de cotización vinculada.

### Tabla `requerimientos` (campos inferidos)
`id`, `codigo`, `cotizacion_id`, `cotizacion_codigo`, `codigo_cliente`, `codigo_unidad`, `proyecto_servicio`, `oc`, `anio`, `solicitante_rq`, `tipo_servicio_nombre`, `area_nombre`, `estado`, `fecha_solicitud`, `fecha_requerida`, `responsable`, `avance`, `total_rq`, `observaciones`, `metadata (jsonb)`, `created_at`, `updated_at`

### Tabla `requerimiento_items` (campos inferidos)
`id`, `requerimiento_id`, `recurso_id`, `cantidad`, `precio_unitario`, `subtotal`, `ajuste`, `atencion_real`, `cant_stock`, `compra`, `costo_unitario`, `moneda_codigo`, `tc`, `factor_eq_herr`, `costo_total_presupuestado`, `fecha_coti`, `estado`, `informacion_adicional`, `observaciones_item`, `recurso_a_suministrar`, `proveedor_id`, `proveedor_nombre`, `condicion_pago`, `tiempo_entrega`, `eq`, `eq_fecha_aprob`, `ll`, `ll_fecha_aprob`, `hb`, `hb_fecha_aprob`, `logistica_compra`, `fecha_compra`, `oc_os_recurso`

### Riesgos
- El campo `metadata (jsonb)` en cotizaciones guarda los códigos de cliente/unidad para la generación del código RQ — frágil, depende de que exista ese JSON con esa estructura exacta.
- La importación histórica dejó datos con inconsistencias detectadas por `historicalImportQuality.ts` que se muestran como warnings.
- Múltiples migraciones de parche (016 rollback, 017 repair policy) indican datos corruptos en producción en el pasado.

### Qué NO debe romperse
- El código RQ ya generado (`codigo` en `requerimientos`) — es la llave de negocio.
- La relación `cotizacion_id` / `cotizacion_codigo` en requerimientos.
- Los ítems ya cargados con sus campos logísticos (EQ/LL/HB/OC).

### Qué rediseñar
- Separar `cliente` y `unidad_trabajo` como tablas propias con UUID, no como texto libre.
- Definir estados logísticos de ítem como enum controlado, no como texto libre.
- Auditoría de cambios en ítems (quién modificó qué y cuándo).

---

## 8. Logística y Seguimiento

### Cómo se gestionan estados
Los estados logísticos viven en cada fila de `requerimiento_items`. No hay una tabla de historial de transiciones. Los cambios se hacen directamente sobre el registro.

**Columnas de seguimiento logístico por ítem:**
- `eq` / `eq_fecha_aprob`: Aprobación EQ (Equipo)
- `ll` / `ll_fecha_aprob`: Aprobación LL (pendiente de confirmar significado exacto)
- `hb` / `hb_fecha_aprob`: Aprobación HB (pendiente de confirmar significado exacto)
- `logistica_compra`: Estado de compra
- `fecha_compra`: Fecha efectiva de compra
- `oc_os_recurso`: Número de OC/OS para este recurso

### Responsables
- El RQ tiene un `responsable` general.
- Los ítems tienen `proveedor_nombre` pero no un responsable individual.

### Proveedores
- `proveedor_id` (UUID) + `proveedor_nombre` (texto) en cada ítem.
- No existe tabla `proveedores` inferida — los proveedores son texto libre por ítem, sin catálogo centralizado.

### Compras
- `compra` (cantidad a comprar), `fecha_compra`, `oc_os_recurso` por ítem.
- No hay tabla de órdenes de compra independiente.

### Limitaciones detectadas
- Sin historial de transiciones de estado.
- Sin alertas automáticas por fecha límite.
- Sin módulo de seguimiento de entregas físicas.
- Los proveedores son texto libre, sin catálogo normalizado.
- Sin cálculo de lead time ni alertas por retraso.

---

## 9. IA / Agentes / Chat

### Arquitectura actual de IA

La capa de IA fue construida en múltiples capas evolutivas. El flujo para una consulta es:

```
Usuario escribe mensaje
        ↓
  stripAgentLabelsForRouting()   — limpia prefijos de agente
        ↓
  detectCorrection()             — ¿"eso no era recursos, era requerimientos"?
        ↓
  resolveClarificationChoice()   — ¿eligió una de las 3 opciones de aclaración?
        ↓
  shouldAskClarification()       — ¿mensaje ambiguo sin scope?
        ↓
  detectContextIntent()          — router: ¿qué herramientas llamar?
        ↓
  [Si intención de datos]
  resolveScope()                 — ¿"este proyecto" = qué código?
  matchCrossIntent()             — ¿150+ patrones de lenguaje natural → herramienta genérica?
  executeCrossIntent()           — ejecuta herramienta → datos reales
        ↓
  buildContextPack()             — arma bloque "CONTEXTO REAL CONSULTADO"
  decideAnswerStrategy()         — ¿respuesta determinística o vía LLM?
        ↓
  [Si determinístico] → responde sin LLM
  [Si LLM] → system prompt + contexto → proveedor LLM → respuesta
```

### Agentes definidos

| ID | Nombre | Especialidad |
|---|---|---|
| `ic` | Arturo — Ingeniero de Costos | Presupuestos, S/., USD, márgenes, análisis de cotizaciones |
| `pm` | Carlos — Project Manager | Cronogramas, avance, riesgos, bloqueos |
| `ie` | María — Ingeniera Eléctrica | CNE-U, IEC 60364, diseño SET, cables, protecciones |
| `gg` | Gerente General | Visión ejecutiva, aprobaciones, resumen de riesgos |

### Herramientas de contexto implementadas
(tabla: `lib/chat/contextSchemas.ts` + `lib/chat/contextTools.ts`)

| Herramienta | Tabla Supabase | Estado |
|---|---|---|
| `buscarCotizaciones` | `cotizaciones` | Implementada |
| `buscarCotizacionPorCodigo` | `cotizaciones` | Implementada |
| `buscarRequerimientos` | `requerimientos` | Implementada |
| `buscarRequerimientoPorCodigo` | `requerimientos` | Implementada |
| `buscarItemsDeRequerimiento` | `requerimiento_items` | Implementada |
| `buscarRecursos` | `recursos` | Implementada |
| `clasificarRecursosElectricos` | `recursos` | Implementada |
| `buscarPropuestaTecnicaPorCodigo` | `technical_proposals` | Implementada |
| `buscarRequerimientosPorProyecto` | `requerimientos` | Implementada |
| Clientes | — | Pendiente (no hay tabla clientes) |
| Proveedores | — | Pendiente (texto libre en ítems) |
| Documentos | — | Pendiente |

### CrossIntentRegistry (150+ patrones)
`lib/chat/crossIntentRegistry.ts` — mapea frases naturales a herramientas genéricas:

| Familia | Ejemplos de frases | Herramienta |
|---|---|---|
| A: project_requirements | "qué RQs tiene este proyecto", "lista los requerimientos de la OC" | `queryProjectRequirements` |
| B: requirement_items | "ítems del RQ", "qué materiales tiene este requerimiento" | `queryRequirementItems` |
| C: global_log | "todos los RQ del año", "análisis global de requerimientos" | `queryGlobalRequirementLog` |
| D: client_summary | "resumen del cliente NEXA", "proyectos adjudicados de este cliente" | `queryClientProjects` |
| E: catalog_resources | "recursos eléctricos del catálogo", "materiales disponibles" | `queryCatalogResources` |

### Anti-alucinación (sistema multi-capa)
1. **`contextDeterministic.ts`**: si hay datos reales, la app los formatea directamente sin pasar por el LLM. El LLM no puede inventar lo que no está en los registros.
2. **`contextGuardrails.ts`**: frases canónicas para responder cuando no hay datos, la fuente está pendiente, o faltan campos.
3. **`contextValidation.ts`**: valida que los registros recuperados tengan los campos mínimos antes de mostrarse.
4. **`datasetMemory.ts`**: guarda el último dataset mostrado para resolver referencias como "el anterior" o "ese requerimiento".
5. **`scopeResolver.ts`**: resuelve "este proyecto/ese RQ/la cotización anterior" usando solo memoria verificada, nunca texto libre del LLM.

### Feedback y aprendizaje
`lib/chat/queryFeedback.ts` — registro en memoria (NOT persistido en Supabase todavía):
- Detecta correcciones: "eso no era recursos, era requerimientos"
- Sesga opciones futuras según historial de elecciones exitosas
- **PENDIENTE**: migrar a tabla `ai_query_feedback` en Supabase cuando se tengan credenciales/solución

### Proveedores LLM disponibles
`gemini`, `groq`, `sambanova`, `openrouter`, `mistral`, `huggingface`, `openai`, `anthropic`, `cerebras`, `together`, `cloudflare`

### Estado en producción (verificado 2026-06-16)
`gemini: ✓`, `groq: ✓`, `sambanova: ✓`, `openrouter: ✓`, `mistral: ✓`, `huggingface: ✓`, `openai: ✓`
`cerebras: ✗`, `together: ✗`, `anthropic: ✗` (API keys vacías o faltantes)

---

## 10. Supabase Actual (solo análisis de archivos locales)

### Tablas identificadas

| Tabla | Origen | Propósito |
|---|---|---|
| `workspace_state` | schema.sql + 034 | Estado global compartido de la app (JSON monolítico) |
| `provider_credentials` | schema.sql | API keys de LLMs cifradas (pendiente de confirmar si se usa) |
| `cotizaciones` | (inferida de repositorios) | Cabeceras de cotizaciones/proyectos |
| `requerimientos` | (inferida) | Requerimientos de compra por cotización |
| `requerimiento_items` | (inferida) | Ítems/partidas de cada requerimiento |
| `recursos` | (inferida) | Catálogo de recursos/materiales |
| `user_profiles` | 032 | Perfiles de usuario (nombre, rol, estado aprobación) |
| `admin_module_permissions` | 010 | Permisos granulares por módulo y usuario |
| `historical_import_batches` | 012 | Metadata de lotes de importación histórica |
| `historical_import_issues` | 012 | Problemas detectados en cada importación |
| `entity_logos` | 020 | Logos de empresa/cliente/proveedor/unidad |
| `technical_proposals` | 020 | Cabeceras de propuestas técnicas |
| `technical_proposal_items` | 020 | Estructura jerárquica de propuesta técnica |
| `technical_proposal_resources` | 020 | Recursos asignados por ítem de PT |
| `technical_proposal_files` | 020 | Archivos adjuntos de propuesta técnica |
| `technical_proposal_events` | 020 | Historial de eventos de propuesta técnica |
| `agent_conversations` | 030 | Conversaciones guardadas por agente y usuario |
| `agent_memories` | 030 | Memorias de largo plazo de agentes |

### Migraciones acumuladas (31 archivos, 006 → 036)

| Rango | Contenido |
|---|---|
| 006-009 | Seeds de recursos demo, códigos por tipo |
| 010-011 | Permisos administrativos por módulo |
| 012-017 | Importación histórica: schema, RLS, parches, rollback |
| 018-019 | Permisos por módulo, INSERT de cotizaciones |
| 020-022 | Schema de Propuesta Técnica (5 tablas nuevas) + RPC |
| 023-026 | Policies de UPDATE para cotizaciones, requerimientos, recursos; storage |
| 028-029 | Parches para DELETE de nuevos RQ |
| 030 | Tablas de memoria IA (agent_conversations, agent_memories) |
| 031 | Fix encoding de estado_propuesta |
| 032-033 | user_profiles trigger signup + fix recursión infinita RLS |
| 034-035 | workspace_state Realtime + GRANTs (posiblemente no aplicados) |
| 036 | Policy directorio de usuarios aprobados (posiblemente no aplicado) |

### Problemas de diseño detectados (ver sección 11 para detalle)
- Múltiples migraciones de parche/rollback (016, 017, 028, 029, 031, 033) indican diseño reactivo.
- `workspace_state` como JSON monolítico escala mal.
- Sin tabla de `clientes`, `proveedores` ni `unidades_trabajo` normalizadas.
- Sin historial de cambios en ítems de requerimiento.
- RLS construido reactivamente, no por diseño.

### Riesgos de seguridad
- Policy `provider_credentials_rw`: `for all using (true) with check (true)` — cualquier usuario autenticado puede leer/escribir API keys cifradas.
- `workspace_state_write/update`: `with check (true)` — cualquier usuario puede escribir el estado compartido.
- Admin hardcodeado por email en código TypeScript (`useAccessGate.ts`, `AuthContext.tsx`) y en múltiples policies RLS — frágil ante cambio de email.

### Riesgos de escalabilidad
- `workspace_state` es un JSON que crece sin límite — se serializa/deserializa completo en cada sync.
- `requerimiento_items` sin paginación en algunos contextos — si un RQ tiene 500+ ítems, se cargan todos.
- Sin índices explícitos en `cotizaciones` o `requerimientos` (no definidos en las migraciones inferidas).

### Riesgos de costos/egress
- Supabase cobra por egress (transferencia de datos). El JSON monolítico de `workspace_state` se lee/escribe en cada interacción de chat.
- Las imágenes en Storage sin CDN pueden generar egress elevado.

---

## 11. Problemas Detectados en Diseño de Base de Datos

### Tablas demasiado rígidas
- `requerimiento_items` tiene ~40 columnas fijas para logística. Agregar un nuevo campo de seguimiento requiere migración SQL.
- `cotizaciones` mezcla datos de cabecera, fechas, responsables y configuración económica en una sola tabla.

### Columnas mal planteadas
- `moneda_codigo` como texto libre en lugar de enum (`PEN`/`USD`).
- `estado` como texto libre en cotizaciones y requerimientos — sin constraint en la tabla `cotizaciones` (solo en TypeScript).
- `proveedor_nombre` duplicado en `requerimiento_items` en lugar de FK a tabla `proveedores`.
- `cliente_nombre` en `cotizaciones` (texto libre) en lugar de FK a tabla `clientes`.

### Duplicidad de datos
- `cotizacion_codigo` se desnormaliza en `requerimientos` (FK + campo de texto).
- `cliente_nombre` se desnormaliza en `cotizaciones` en lugar de resolverse por `cliente_id`.
- Los datos de código RQ se guardan en `metadata (jsonb)` de cotizaciones en vez de en campos de la tabla cliente/unidad.

### Mala normalización
- No existen tablas para: `clientes`, `proveedores`, `unidades_trabajo`, `tipos_servicio`, `areas`.
- Toda la información de catálogos se repite como texto en cada registro.

### Mala trazabilidad
- Los ítems de requerimiento no tienen historial de quién los modificó ni cuándo cambió el estado.
- Las cotizaciones no tienen log de cambios de estado.
- Los campos `created_by`/`updated_by` existen en `technical_proposals` pero no se infieren en cotizaciones/requerimientos.

### Problemas para permisos
- El admin se identifica por email hardcodeado, no por rol en la tabla.
- `admin_module_permissions` existe pero no hay un sistema claro de roles jerárquicos.
- Las policies RLS se acumularon reactivamente (33 migraciones).

### Problemas para estados
- Sin máquina de estados formal — las transiciones no tienen validación en base de datos.
- Sin tabla de historial de transiciones.

### Problemas para adjuntos
- Los archivos de recursos tienen tabla `resource_files` (inferida de migration 026) con Supabase Storage.
- Los adjuntos de propuesta técnica tienen su propia tabla (`technical_proposal_files`).
- No hay un sistema unificado de documentos/adjuntos para cualquier entidad.

### Problemas para auditoría
- Sin tabla de auditoría global (quién hizo qué y cuándo en el sistema).
- Trigger `set_updated_at()` solo en tablas de PT, no en cotizaciones/requerimientos.

### Problemas para IA
- No hay tabla `ai_query_feedback` — el feedback de aprendizaje es en memoria, se pierde al reiniciar.
- Los agentes IA no tienen "preferencias" persistidas por usuario.
- Sin tabla de `skills` en Supabase — las skills activas viven en el store JSON.

### Problemas para tablas tipo Notion/Airtable
- Cada columna visual requiere una migración SQL real.
- No hay modelo de columnas dinámicas/personalizadas.
- Sin vistas guardadas por usuario.
- Sin filtros persistidos.

---

## 12. Propuesta Conceptual para Nuevo Sistema

> Sin crear código todavía. Modelo conceptual limpio.

### Entidades base relacionales (lo crítico en SQL normalizado)

```
workspace
  └── users (FK workspace)
  └── roles (workspace-scoped)
  └── user_roles (users × roles)

clients (nombre, ruc, contacto, metadata)
  └── projects (nombre, estado, cliente_id, metadata)
      └── quotations (codigo, estado, moneda, responsables...)
          └── quotation_items (recurso_id, cantidad, precio...)
          └── requirements (codigo RQ, estado, fechas...)
              └── requirement_items (recurso_id, logistica...)
                  └── requirement_item_events (historial de cambios)

resources (catalogo: codigo, nombre, tipo, unidad)
  └── resource_files (adjuntos por recurso)

suppliers (nombre, ruc, contacto)
providers (tabla de cotizaciones de proveedores por ítem)

documents (entidad genérica de adjuntos: entity_type, entity_id, url, tipo)
comments (entidad genérica: entity_type, entity_id, texto, autor)
audit_log (entidad genérica: tabla, record_id, acción, before, after, usuario)

-- IA
agent_conversations (user_id, agent_id, messages jsonb, created_at)
agent_memories (user_id, agent_id, key, value, updated_at)
ai_query_feedback (query, intent, source_used, success, agent, created_at)
ai_skills (id, nombre, version, trigger, steps jsonb, safety jsonb, estado)

-- Configurables (tipo Notion)
custom_fields (entity_type, field_name, field_type, options jsonb)
custom_field_values (entity_type, entity_id, field_name, value text)
saved_views (user_id, entity_type, name, filters jsonb, columns jsonb, sort jsonb)
```

### Principios de diseño para el nuevo sistema
1. **Entidades normalizadas primero**: clientes, proveedores, unidades de trabajo como tablas propias.
2. **Roles en base de datos**: tabla `roles` con permisos definidos, no emails hardcodeados.
3. **Historial en base de datos**: `audit_log` genérico + `_events` por entidad crítica.
4. **Columnas personalizadas en metadata**: para campos variables sin migrar el schema.
5. **Sin JSON monolítico de estado**: cada entidad en su propia tabla.
6. **RLS por diseño**: diseñar los permisos antes de crear las tablas, no después.

---

## 13. Modelo tipo Notion/Airtable Recomendado

### Tablas base relacionales (para lo crítico)
Las entidades de negocio con campos conocidos y estables deben ser **columnas SQL reales**:
- `cotizaciones`: código, estado, moneda, fechas, responsables → columnas fijas.
- `requerimiento_items`: recurso, cantidad, precio, proveedor, logística → columnas fijas.
- `recursos`: código, nombre, tipo, unidad → columnas fijas.

### Columnas dinámicas/personalizadas (sin migrar schema)
Para campos que varían por cliente o proyecto:
```sql
custom_fields (entity_type text, field_name text, field_type text, options jsonb)
custom_field_values (entity_type text, entity_id uuid, field_name text, value text)
```
Regla: si > 80% de registros usan el campo → columna SQL. Si < 20% → `custom_field_values`.

### Vistas guardadas
```sql
saved_views (user_id, entity_type, name, filters jsonb, columns jsonb, sort jsonb, shared bool)
```
No requiere cambios de schema para guardar nuevas vistas.

### Filtros y ordenamiento
Procesados en el servidor (Supabase query builder), no en el cliente.
Los filtros se serializan como JSON y se re-ejecutan en cada carga.

### Permisos granulares
- Roles base: `admin`, `gerencia`, `responsable`, `consulta`
- Permisos de módulo: tabla `module_permissions (role, module, can_view, can_edit, can_delete, can_approve)`
- Override por usuario: `user_overrides (user_id, module, can_view, can_edit...)`
- Nunca hardcodear emails en código

### Auditoría integrada
Trigger genérico que escribe en `audit_log` antes de UPDATE/DELETE en tablas críticas.

### Cuándo sí conviene migración SQL
- Campo que se consulta con frecuencia (índice necesario)
- Campo con constraint de integridad (FK, NOT NULL, CHECK)
- Campo de negocio estable que todos los registros usan

### Cuándo NO conviene migración SQL
- Campo específico de un cliente o proyecto temporal
- Campo experimental (puede desaparecer en 2 semanas)
- Campo de configuración visual (ancho de columna, color de fila)

---

## 14. Qué Rescatar del Sistema Actual

### Componentes UI rescatables
- `components/sgp/DataTable.tsx` — tabla genérica con sort/filter/paginación (refactorizar props)
- `components/sgp/StatusBadge.tsx` — badge de estado reutilizable
- `components/sgp/RequirementItemsGrid.tsx` — grid editable de ítems (extraer la lógica de edición)
- `components/sgp/SearchableRelation.tsx` — autocomplete de relaciones
- `components/sgp/ui/DateTextInput.tsx`, `FieldLockButton.tsx` — primitivos de UI
- `components/shell/Sidebar.tsx` + `Topbar.tsx` — shell de navegación
- `components/chat/MdText.tsx` — renderizador de Markdown con soporte de @menciones y tablas GFM
- `lib/presence/avatar.ts` — utilidades de avatar (iniciales, colores por email)

### Funciones rescatables
- `lib/sgp/quotationEconomics.ts` — cálculo de márgenes y resumen económico
- `lib/sgp/quotationCashflow.ts` — cashflow mensual proyectado
- `lib/sgp/utils.ts` — formatCurrencyNumber, formatDate, normalizeDateForStorage
- `lib/sgp/uiStatePersistence.ts` — persistencia de estado de UI en URL/sessionStorage
- `lib/sgp/clientDataCache.ts` — patrón de caché de datos con invalidación
- `lib/sgp/dataSourceDiagnostics.ts` — diagnóstico de fuentes de datos

### Tipos TypeScript rescatables
- `Cotizacion`, `EstadoCotizacion`, `PrioridadCotizacion` (demoData.ts)
- `Requerimiento`, `EstadoRequerimiento` (demoData.ts)
- `DetalleRequerimientoItem` (demoData.ts)
- `Recurso`, `EstadoRecurso` (demoData.ts)
- `LLMProvider`, `ModelConfig`, `ChatMessage` (lib/llm/providers.ts)
- `AgentId`, `AgentProfile` (lib/chat/agentProfiles.ts)

### Lógica de negocio rescatable
- Generación de código RQ (patrón, no la implementación exacta)
- Validaciones de campos obligatorios en creación de cotización
- Flujo de estados de cotización (máquina de estados como referencia)
- Lógica de cashflow mensual

### Ideas de IA rescatables
- **Pipeline de contexto determinístico**: la idea de responder sin LLM cuando hay datos reales es excelente y debe preservarse.
- **Anti-alucinación multi-capa**: `contextGuardrails.ts` + `contextDeterministic.ts` son la pieza más valiosa.
- **CrossIntentRegistry**: mapear 150+ frases naturales a herramientas genéricas es un patrón correcto — simplificar la implementación.
- **ScopeResolver**: resolver "este proyecto" desde memoria verificada es crítico para la UX de IA.
- **Feedback de correcciones** (`detectCorrection`): el patrón de "eso no era X, era Y" es muy útil.
- **Por-agente specialization**: el patrón de adaptar respuestas por rol (IC/PM/IE/GG) es valioso.

### Validaciones rescatables
- Validación de código único al crear cotización
- Validación de campos obligatorios (código, proyecto, cliente) antes de guardar
- Detección de moneda mixta en análisis de costos (PEN vs USD sin TC)

### Estilos rescatables
- Sistema de variables CSS en `globals.css` (`--blue`, `--bg-card`, `--border`, `--t1`...)
- Paleta de colores semánticos para estados
- El layout de sidebar + topbar + content area

---

## 15. Qué Descartar o Rehacer

### Tablas problemáticas
- `workspace_state` como JSON monolítico — reemplazar por tablas específicas
- `provider_credentials` con RLS `using (true)` — rediseñar con permisos reales
- Las 31 migraciones acumuladas (006-036) — en el nuevo sistema usar `supabase/migrations/` con Supabase CLI desde el inicio

### Flujos confusos
- El fallback silencioso a `demoData.ts` cuando Supabase falla — debe ser explícito y visible
- La doble fuente de Supabase (`lib/supabaseClient.ts` vs `lib/sgp/supabaseClient.ts`)
- La detección de admin por email hardcodeado en múltiples lugares

### Componentes acoplados
- `CotizacionesContent.tsx` (~1400 líneas) — separar en 5-6 componentes
- `RoundtableView.tsx` (~800+ líneas) — separar lógica de UI de lógica de negocio
- `QuotationWorkspaceModal.tsx` — acoplado a cotizaciones Y requerimientos Y propuestas técnicas

### Lógica peligrosa
- `createRequirementFromWonQuotationSupabase` — función crítica sin test, con lógica de generación de código RQ compleja. Refactorizar con tests.
- El uso de `metadata (jsonb)` de cotizaciones para almacenar información de código RQ — frágil, debe ser tabla normalizada.
- Las policies de RLS con `using (true)` en tablas sensibles.

### Migraciones dudosas
- `016_rollback_failed_partial_import_2026_002.sql` — rollback de una importación fallida, potencialmente deja datos inconsistentes
- `031_fix_cotizaciones_estado_propuesta_encoding.sql` — fix de encoding de datos, indica datos corruptos previos
- `033_fix_user_profiles_rls_recursion.sql` — fix de recursión infinita en RLS, indica diseño inicial incorrecto

### Permisos inseguros
- `workspace_state`: `using (true)` en todas las policies
- `provider_credentials_rw`: acceso total a API keys para cualquier usuario autenticado
- Admin por email hardcodeado (falla si cambia el email)

### Integraciones prematuras
- La capa de IA compleja (18+ módulos de chat) fue construida antes de que el modelo de datos estuviera estable
- La Oficina Virtual IA (`components/ai-office/`) es mayoritariamente mock — no conectada a datos reales
- `lib/ai-office/mvpMockData.ts`, `aiAgentsMock.ts`, etc. — todo mock que puede descartarse

---

## 16. Nuevo Roadmap Recomendado

### FASE 0 — Diagnóstico y Congelamiento (1-2 días)
- [ ] Exportar schema actual de Supabase (SQL + datos si aplica)
- [ ] Documentar tablas críticas con datos reales (cotizaciones, RQs, recursos)
- [ ] Congelar rama `fix/hard-anti-hallucination` como último estado conocido-bueno
- [ ] Crear rama `main-frozen-YYYYMMDD` como backup del estado actual de producción
- [ ] Este documento como referencia

### FASE 1 — Diseño de Base de Datos Limpia (3-5 días)
- [ ] Definir todas las entidades en un diagrama ER antes de escribir SQL
- [ ] Decidir qué tablas son relacionales puras vs. qué usa `custom_fields`
- [ ] Definir roles y permisos en el diagrama (no en código)
- [ ] Diseñar las policies RLS para cada tabla antes de crearlas
- [ ] Revisar con el Gerente General antes de implementar
- [ ] Usar `supabase/migrations/` con Supabase CLI (no scripts numerados)

### FASE 2 — App Base Limpia (3-4 días)
- [ ] Nuevo proyecto Next.js (o rama `v2/main`) desde cero
- [ ] Auth con Supabase (reutilizar patrón actual: email + Google OAuth)
- [ ] Roles en base de datos (no hardcodeados)
- [ ] Shell básico: sidebar, topbar, layout
- [ ] Conexión a nueva base de datos (NO a la actual de producción)

### FASE 3 — UI tipo Notion/Airtable Base (5-7 días)
- [ ] DataTable genérico con columnas configurables
- [ ] Sistema de vistas guardadas
- [ ] Filtros y ordenamiento del lado del servidor
- [ ] Columnas personalizadas (`custom_fields` + `custom_field_values`)
- [ ] Sin datos reales todavía — con seeds de prueba

### FASE 4 — Cotizaciones y Requerimientos (5-7 días)
- [ ] Tablas `clients`, `projects`, `quotations`, `requirements`, `requirement_items`
- [ ] CRUD completo con validaciones
- [ ] Máquina de estados con historial
- [ ] Generación de código RQ con lógica explícita (no desde metadata JSON)
- [ ] Conectar a nueva base de datos Supabase (aún separada de producción)

### FASE 5 — Logística y Proyectos (4-5 días)
- [ ] Tabla `suppliers` normalizada
- [ ] Tabla `orders` para seguimiento de compras
- [ ] Historial de transiciones de estado por ítem
- [ ] Alertas básicas por fecha límite

### FASE 6 — IA Gerencial Mock (3-4 días)
- [ ] Chat con agentes usando datos del nuevo sistema
- [ ] Reutilizar `contextDeterministic.ts` y `contextGuardrails.ts` (anti-alucinación)
- [ ] Reutilizar patrones de `crossIntentRegistry` (simplificado)
- [ ] Sin persistencia de feedback todavía (en memoria)

### FASE 7 — Supabase Real con RLS (2-3 días)
- [ ] Migrar datos de producción al nuevo schema (con backup previo)
- [ ] Validar todas las policies RLS con usuario de prueba
- [ ] Validar Realtime en `mesa-trabajo`
- [ ] Pruebas de regresión manuales de flujos críticos

### FASE 8 — IA Real + Feedback + Skills (3-4 días)
- [ ] Persistir `ai_query_feedback` en Supabase
- [ ] Skills versionadas en base de datos (no en store JSON)
- [ ] Memoria de largo plazo de agentes
- [ ] (Opcional/futuro) RAG sobre documentos internos

### FASE 9 — Integración futura con SISTEMA V2 / SGP-LITE
- [ ] **Pendiente de confirmar**: definir qué es SGP-LITE y cómo se integra
- [ ] **No tocar SGP-LITE durante las fases 0-8**
- [ ] Definir API de integración antes de construirla
- [ ] Aprobación del Gerente General antes de esta fase

---

## 17. Reglas de Seguridad para el Reinicio

1. **No tocar Supabase real sin aprobación explícita del Gerente General** para cada acción.
2. **No borrar tablas ni datos sin backup verificado** (export SQL + export CSV de datos críticos).
3. **No ejecutar SQL destructivo** (`DROP TABLE`, `DELETE`, `TRUNCATE`) sin revisión en este documento.
4. **No conectar IA real al inicio** de las fases 2-3 — usar mocks hasta que el modelo de datos sea estable.
5. **No usar datos reales en entornos de desarrollo** — seeds de prueba separados.
6. **No modificar SISTEMA V2 / SGP-LITE** bajo ninguna circunstancia en este proceso.
7. **Todo cambio crítico a base de datos requiere aprobación** antes de ejecutar.
8. **Toda migración SQL debe ser revisada** por al menos una persona antes de aplicar.
9. **No hardcodear emails ni IDs de usuario** en código de producción.
10. **Mantener `fix/hard-anti-hallucination` congelada** como referencia del último estado funcional.

---

## 18. Checklist para Iniciar Desde Cero

### Antes de crear nada nuevo
- [ ] **Backup Supabase**: exportar schema completo desde Dashboard → Settings → Database → Schema
- [ ] **Export de datos críticos**: cotizaciones, requerimientos, requerimiento_items, recursos (CSV o SQL dump)
- [ ] **Documentar datos sensibles**: cuántos registros hay en cada tabla crítica
- [ ] **Congelar rama actual**: crear tag `v1-freeze-YYYYMMDD` en git
- [ ] **Backup de variables de entorno**: copiar `.env.local` a lugar seguro (fuera del repo)
- [ ] **Confirmar con el Gerente General** que se puede proceder

### Para el nuevo proyecto
- [ ] Crear nuevo proyecto Supabase (SEPARADO del actual, no el mismo)
- [ ] Crear nueva rama git `v2/main` o nuevo repositorio
- [ ] Instalar Supabase CLI (`supabase init` + `supabase/migrations/` en lugar de `sql/`)
- [ ] Diseñar schema ER en diagrama antes de escribir SQL
- [ ] Validar schema con equipo antes de aplicar
- [ ] Crear seeds de prueba (datos ficticios) para desarrollo
- [ ] Configurar variables de entorno separadas para dev/staging/prod

### Para la migración eventual
- [ ] Escribir script de migración de datos (de schema viejo a nuevo)
- [ ] Probar migración con copia de datos de producción en entorno de staging
- [ ] Validar integridad referencial después de migración
- [ ] Plan de rollback definido antes de migrar producción
- [ ] Ventana de mantenimiento acordada con usuarios

---

## 19. Resumen Final para el Gerente General

### Qué existe
La aplicación "Oficina Técnica IA" es un sistema funcional de gestión de cotizaciones y requerimientos con una capa de agentes IA integrada. El módulo de cotizaciones y requerimientos opera con datos reales de Supabase. Los agentes IA pueden consultar esos datos y responder preguntas del equipo técnico sin inventar información.

### Qué sirve
- **El modelo de negocio documentado**: el flujo Cotización → Requerimiento → Ítems logísticos es correcto y debe preservarse.
- **Los datos históricos en Supabase**: cotizaciones, requerimientos y recursos importados son activos reales de la empresa.
- **La lógica de anti-alucinación de la IA**: el sistema de respuestas determinísticas y guardrails es la parte más valiosa y debe rescatarse.
- **Los tipos TypeScript**: definen bien las entidades de negocio actuales.
- **El shell visual (sidebar, topbar)**: funcional y estéticamente correcto.

### Qué no sirve
- **La base de datos**: fue diseñada sobre la marcha con 36 migraciones acumuladas, sin diseño previo. Tiene problemas de normalización, RLS reactivo, datos de catálogos como texto libre, y un JSON monolítico como estado de aplicación.
- **El componente maestro `CotizacionesContent.tsx`**: ~1400 líneas, difícil de mantener y extender.
- **El estado global en JSON** (`workspace_state`): insostenible a escala.
- **Los mocks mezclados con datos reales**: la línea entre datos de prueba y datos reales no está clara.

### Qué riesgos hay
1. **Riesgo de datos**: si se aplica SQL incorrecto en producción, se pueden corromper cotizaciones y requerimientos reales. Mitigación: backup antes de cualquier cambio.
2. **Riesgo de seguridad**: políticas RLS con `using (true)` permiten acceso total a datos sensibles. Mitigación: no agregar usuarios externos hasta rediseñar.
3. **Riesgo operacional**: la app de producción funciona pero el "Sin usuarios aprobados" y el "Realtime interrumpido" requieren aplicar 3 migraciones SQL (034, 035, 036) que ya están escritas y listas.
4. **Riesgo de deuda técnica**: cada nueva funcionalidad se vuelve más difícil de agregar sobre el schema actual.

### Cómo reiniciar bien
1. Hacer backup de los datos de Supabase antes de cualquier cambio.
2. Usar el nuevo sistema en **base de datos separada** hasta que esté maduro.
3. Seguir el roadmap de 9 fases — no saltarse el diseño de base de datos (Fase 1) por urgencia.
4. No conectar el nuevo sistema a datos de producción hasta la Fase 7.
5. Aprobar cada fase antes de continuar.

### Cuál es el siguiente paso recomendado
**Inmediato (sin riesgo):**
1. Aplicar las 3 migraciones pendientes (034, 035, 036) en el SQL Editor de Supabase para resolver los problemas actuales de producción.
2. Verificar en producción que "Usuarios en la mesa" y Realtime funcionan correctamente.

**Esta semana:**
3. Exportar backup del schema y datos de Supabase.
4. Definir el diagrama ER del nuevo sistema con el equipo.
5. Crear nuevo proyecto Supabase para desarrollo (separado del de producción).

**Este mes:**
6. Completar Fases 0-2 del roadmap.
7. Tener un prototipo funcional del nuevo schema con datos de prueba.

---

*Documento generado por auditoría automatizada del repositorio.*
*Rama auditada: `fix/hard-anti-hallucination` — commit HEAD: `a47223d`*
*Fecha: 2026-06-16*
*No se modificaron archivos de código durante la generación de este documento.*
