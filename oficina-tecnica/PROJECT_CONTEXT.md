# PROJECT CONTEXT


## 2026-07-09 | Módulo Recursos | Visualización de recursos inactivos

### Proyecto
TRABAJO-MODELO02 | Oficina Técnica IA

### Módulo
Recursos

### Decisión funcional
La tabla de Recursos muestra por defecto solo recursos activos o no inactivos. Se agregó un checkbox/toggle "Mostrar inactivos" para incluir recursos con estado = "Inactivo" cuando el usuario lo active.

### Lógica implementada
- Se agregó estado local showInactive, por defecto false.
- Si showInactive está desactivado, se excluyen recursos con estado === "Inactivo".
- Si showInactive está activado, se muestran activos e inactivos.
- Estados vacíos, null, undefined u otros valores no se consideran inactivos.

### Archivos modificados
- components/sgp/pages/RecursosContent.tsx
- lib/sgp/recursosRepository.ts

### Restricciones respetadas
- No se modificó Supabase SQL.
- No se usó deleted_at.
- No se borraron recursos físicamente.
- No se modificaron APIs.
- No se tocó Google Drive.
- No se tocó .env.local.
- No se instalaron paquetes.
- No se tocaron Requerimientos ni Cotizaciones.

### Validación reportada
- npm run lint: pasa sin errores bloqueantes, con warnings conocidos.
- npm run build: pasa correctamente después de limpiar .next.
- Commit aplicado: f4b235b - Mejora: controlar visualización de recursos inactivos.
