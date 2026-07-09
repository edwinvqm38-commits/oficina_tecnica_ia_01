# PROJECT_CONTEXT

## Proyecto

**TRABAJO-MODELO02 | Oficina Tecnica IA**

## Carpeta principal

La aplicacion principal esta en:

```text
oficina-tecnica/
```

## Stack tecnico detectado

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth, Database, RLS y RPC SQL
- Vercel para despliegue
- Google Drive y Gmail mediante OAuth
- Proveedores LLM configurables por variables de entorno
- Librerias de apoyo: KaTeX, Mermaid, PDF.js, Mammoth, Tesseract, XLSX y expr-eval

## Modulos principales

- Autenticacion, aprobacion de usuarios y permisos por modulo
- Dashboard y bandeja gerencial
- Mesa de trabajo con agentes IA
- Chat privado
- Cotizaciones
- Requerimientos
- Recursos
- Datos y catalogos
- Gestion documental con Google Drive
- Envio de correos con Gmail
- Propuestas tecnicas
- Skills, conocimiento y desempeno de agentes

## Carpetas productivas

Dentro de `oficina-tecnica/`:

- `app/`: rutas y pantallas Next.js
- `components/`: componentes de interfaz
- `lib/`: utilidades e integraciones compartidas
- `services/`: servicios de dominio
- `supabase/sql/`: scripts SQL y migraciones manuales
- `docs/`: documentacion tecnica del proyecto
- `public/`: recursos publicos
- `types/`: tipos TypeScript compartidos

## Carpetas legacy o historicas

- `project/`: prototipo o material historico.
- `chats/`: historial de diseno y conversaciones de referencia.
- `project/uploads/ops-ia-v2-demo-main/`: version o exportacion antigua de referencia.

Estas carpetas no deben borrarse ni moverse hasta que exista una auditoria y aprobacion explicita.

## Reglas de trabajo con IA

- Tomar `oficina-tecnica/` como fuente principal de verdad.
- No leer, copiar ni imprimir valores reales de `.env.local`.
- No modificar logica funcional cuando la tarea sea solo documental.
- No borrar ni mover carpetas legacy sin aprobacion explicita.
- Preferir cambios pequenos, revisables y documentados.
- Mantener Supabase como fuente de datos y Google Drive como fuente fisica de archivos.
- Para cambios funcionales, validar con `npm run build` antes de publicar.
- No commitear `node_modules/`, `.next/`, `.vercel/`, logs, ZIPs ni archivos de entorno reales.
