# Continuidad - Oficina Tecnica IA

Fecha: 2026-06-26

## Estado actual

- La app Next.js usa Supabase nuevo mediante `.env.local`.
- El login esta activo nuevamente; no se debe trabajar con bypass salvo depuracion local.
- Los agentes activos reales en chat son:
  - `IC`: Ingeniero de Costos y Presupuestos.
  - `PM`: Project Management.
  - `IE`: Ingeniera Electrica.
- Las pantallas `/chat` y `/mesa-trabajo` llaman modelos reales si hay API keys.
- La pantalla `/conexiones` ya no asigna modelos por agente; ahora muestra enrutamiento automatico.

## Variables necesarias

Local: `oficina-tecnica/.env.local`

Vercel: Project Settings -> Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
CEREBRAS_API_KEY=
MISTRAL_API_KEY=
TOGETHER_API_KEY=
HUGGINGFACE_API_KEY=
SAMBANOVA_API_KEY=
ANTHROPIC_API_KEY=
```

No subir `.env.local` a GitHub. El archivo `.env*` esta ignorado.

## Enrutamiento automatico de modelos

Archivo principal: `lib/llm/modelRouter.ts`

- Pregunta simple: Gemini Flash.
- Pregunta tecnica: Cerebras 70B como primera opcion.
- Pregunta analitica, historicos o datos de Supabase: Gemini Pro.
- Generacion/redaccion: OpenAI GPT-4o.
- Si falla el proveedor principal, `lib/llm/providers.ts` prueba fallback con modelos fuertes primero.

## Memoria de agentes

Archivo principal: `lib/memory/conversationMemory.ts`

- El historial consultado por los agentes se limita a los ultimos 5 dias.
- Las memorias del agente tambien se consultan con ventana de 5 dias.
- Los agentes guardan contexto breve de consultas no simples en `agent_memories`.
- Si falta informacion, el prompt obliga al agente a pedir datos concretos para aprender.
- Para limpiar memoria antigua en Supabase, ejecutar:

```sql
select * from public.purge_old_agent_memory(5);
```

Si el proyecto Supabase ya estaba creado antes de estos cambios, ejecutar tambien:

```sql
-- supabase/sql/110_agent_memory_retention.sql
```

## SQL Supabase

- Schema base: `supabase/sql/100_clean_start_schema.sql`
- Retencion/memoria: `supabase/sql/110_agent_memory_retention.sql`

Para cuenta nueva: ejecutar primero `100`, luego `110`.

## Comandos utiles

```powershell
cd oficina-tecnica
npm run dev
npm run dev:webpack
npm run build
```

Si `next dev` va lento en Windows:

```powershell
Remove-Item -Recurse -Force .next\dev -ErrorAction SilentlyContinue
npm run dev:webpack
```

## Prueba rapida

1. Iniciar app.
2. Abrir `/conexiones` y verificar proveedores activos.
3. Abrir `/chat`.
4. Probar:
   - `@IC analiza esta desviacion de costos...`
   - `@PM que riesgos ves en este cronograma...`
   - `@IE que norma aplica para...`
5. Abrir `/mesa-trabajo` y probar una consulta tecnica sin mencionar agente; el sistema enruta por tema.

## Pendiente recomendado

- Ejecutar `110_agent_memory_retention.sql` en Supabase si la cuenta ya existe.
- Subir variables de IA a Vercel y hacer redeploy.
- Hacer commit sin incluir `.env.local`.
