# Contexto del proyecto

## Identidad

**Oficina Técnica IA**, también denominada **IA Gerencial**, es una aplicación
web orientada a asistencia técnica y gerencial para consultar, organizar y
analizar información de una oficina técnica mediante agentes especializados.

La aplicación productiva vive en `oficina-tecnica/`. La carpeta `project/`
contiene prototipos y material de diseño heredado; no debe confundirse
automáticamente con la implementación vigente.

## Objetivo

El sistema busca ofrecer una interfaz de trabajo donde personas y agentes de IA
puedan:

- consultar información técnica y comercial;
- revisar cotizaciones, requerimientos, recursos y propuestas técnicas;
- mantener conversaciones con contexto;
- producir respuestas trazables y honestas;
- apoyar decisiones sin convertir datos incompletos o inferencias en hechos.

## Relación con SISTEMA V2 / SGP-LITE

Existe una relación funcional futura prevista con **SISTEMA V2 / SGP-LITE**,
pero no forma parte del alcance actual de esta capa de gobierno. Ningún agente
debe modificar, integrar o asumir contratos con ese sistema sin una tarea y
aprobación explícitas.

## Roles de agentes

| Código | Rol | Enfoque |
| --- | --- | --- |
| GG | Gerente General | Síntesis ejecutiva, decisiones y riesgos principales. |
| IC | Ingeniero de Costos y Presupuestos | Costos, presupuestos, montos, monedas y desviaciones. |
| IE | Ingeniero Especialista / Ingeniería | Análisis y clasificación técnica por especialidad. |
| PM | Project Management | Estado, seguimiento, cronograma, riesgos y pendientes. |

Los roles cambian el enfoque de análisis, no la evidencia disponible. Ningún rol
puede crear datos ausentes.

## Fuentes y evidencia

Supabase es la fuente real para las entidades conectadas cuando la aplicación
ejecuta una consulta real y recupera registros. La presencia de una tabla en el
código no prueba que una consulta concreta haya ocurrido.

Orden de confianza:

1. Registros recuperados de una fuente real y autorizada.
2. Contenido legible de un archivo aportado explícitamente para la consulta.
3. Estado verificable del repositorio y documentación vigente.
4. Datos mock o prototipos, únicamente como ejemplos y siempre etiquetados.
5. Historial conversacional, útil como contexto pero no como evidencia factual.

## Hard anti-hallucination

El principio rector es que las garantías críticas deben vivir en la aplicación,
no depender únicamente de que un modelo siga instrucciones.

Para consultas de datos, el sistema debe:

- detectar la intención y el alcance;
- consultar una fuente implementada;
- responder únicamente con resultados recuperados;
- pedir aclaración si el alcance no está verificado;
- bloquear o reemplazar respuestas con datos no sustentados;
- evitar afirmar que se ejecutó una consulta cuando no ocurrió.

## Respuesta honesta

Cuando una capacidad, fuente, renderer o análisis todavía no existe, el sistema
debe decirlo explícitamente. Debe indicar qué no se ejecutó y, cuando sea útil,
ofrecer una consulta acotada que sí esté implementada. Nunca debe rellenar
resultados, estimar rankings ni fabricar visualizaciones para aparentar una
capacidad inexistente.

## Límites de fase

Se gestionan como fases separadas:

- persistencia de feedback en `ai_query_feedback`;
- visuales, dashboards y renderers de archivos;
- ampliación de la mesa multiagente;
- integración con SISTEMA V2 / SGP-LITE.
