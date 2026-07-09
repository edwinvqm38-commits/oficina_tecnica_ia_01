# TRABAJO-MODELO02 | Oficina Tecnica IA

Repositorio de trabajo para la aplicacion **Oficina Tecnica IA**.

## Aplicacion principal

La aplicacion productiva real esta en:

```text
oficina-tecnica/
```

Ese directorio contiene el proyecto Next.js, sus componentes, servicios, integraciones, documentacion tecnica y scripts SQL de Supabase.

## Estructura del repositorio

```text
oficina_tecnica_ia_01/
  oficina-tecnica/        # Aplicacion principal Next.js
  project/                # Prototipo / historico / referencias antiguas
  chats/                  # Historial de diseno y conversaciones de referencia
  PROJECT_CONTEXT.md      # Contexto operativo para humanos e IA
```

Las carpetas `project/`, `chats/` y `project/uploads/ops-ia-v2-demo-main/` se consideran material historico o prototipo. No deben eliminarse ni moverse sin una decision explicita.

## Trabajo local

Entrar a la aplicacion principal:

```bash
cd oficina-tecnica
npm install
npm run dev
```

Validacion recomendada antes de publicar cambios funcionales:

```bash
npm run build
```

## Archivos que no deben subirse

No subir al repositorio:

- `.env`, `.env.local`, `.env.*.local`
- `node_modules/`
- `.next/`
- `.vercel/`
- `tsconfig.tsbuildinfo`
- logs locales
- archivos ZIP o bundles exportados pesados

Usar `oficina-tecnica/.env.example` como plantilla sin secretos para configurar entornos locales o Vercel.

## Regla de seguridad

Nunca copiar valores reales de `.env.local` a documentacion, issues, commits, prompts o respuestas. Los secretos deben vivir solo en variables de entorno locales o del proveedor de despliegue.
