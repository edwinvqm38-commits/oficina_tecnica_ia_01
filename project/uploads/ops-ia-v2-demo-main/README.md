# OPS-IA V2 — Sistema de Gestión Operativa de Cotizaciones y Requerimientos

## Descripción
OPS-IA V2 es una aplicación web para la gestión operativa de cotizaciones y requerimientos, enfocada en seguimiento comercial, control económico y trazabilidad de recursos en un flujo unificado.

## Estado actual
Demo funcional (entorno local) para validación operativa interna y presentación comercial.

## Alcance actual
- Log de cotizaciones.
- Workspace/modal de cotización.
- Resumen económico.
- Requerimientos asociados.
- Creación controlada de RQ desde cotización adjudicada/ganada.
- Datos demo/locales.

## Tecnologías
- Next.js 15.3.2
- TypeScript
- React
- Tailwind CSS / CSS del proyecto

## Scripts
```bash
npm install
npm run lint
npm run build
npm run dev
```

## Modo demo
La aplicación funciona con datos locales/demo.
La integración con Supabase está preparada para una fase futura, pero no es obligatoria para la demo actual.

## Seguridad
- No subir archivos `.env` al repositorio.
- Las variables de entorno deben configurarse fuera del código fuente.
- Verificar `.gitignore` antes de cada publicación.

## Deuda técnica conocida
- Warning de `<img>` en `components/ui/FilePreviewModal.tsx` (`@next/next/no-img-element`).

## Autor / propósito
Demo interna para validar flujo operativo y presentación comercial.
