# Matriz manual de pruebas

Esta matriz define expectativas; no afirma que los casos estén automatizados.
Para usar Supabase real se requiere un entorno y autorización adecuados. En
tareas documentales se trabaja únicamente con casos mock o referencias
documentales.

La matriz es manual y no representa una suite automatizada existente. La
automatización continúa pendiente en `OPEN_ISSUES.md`, issue `OI-007`.

## Consultas comerciales

| ID | Caso | Entrada o condición | Resultado esperado |
| --- | --- | --- | --- |
| COM-01 | Cotizaciones ganadas | “Lista las cotizaciones ganadas” | Ejecuta consulta real; incluye estados normalizados `Ganada` y el histórico equivalente `Adjudicado`; no inventa filas. |
| COM-02 | Cotizaciones adjudicadas | “¿Qué cotizaciones fueron adjudicadas?” | Enruta a la misma intención comercial ganada y etiqueta los estados recuperados tal como existen. |
| COM-03 | Cotizaciones perdidas | “Lista las cotizaciones perdidas” | Consulta `Perdida / No adjudicada` y `No adjudicado`; no mezcla ganadas. |
| COM-04 | Sin coincidencias | Filtro comercial válido sin registros | Respuesta determinística indicando cero resultados, sin ejemplos ficticios. |
| COM-05 | Variante histórica | Estado con espacios, mayúsculas, acento o codificación inconsistente | Debe normalizarse o declararse no cubierto; nunca concluir que no existen datos sin distinguir un posible problema histórico. |
| COM-06 | Cliente y estado | “Ganadas del cliente X” con un valor mock | Aplica ambos filtros y devuelve solo registros recuperados. |

## Anti-alucinación y Supabase

| ID | Caso | Entrada o condición | Resultado esperado |
| --- | --- | --- | --- |
| AH-01 | Código inexistente | Código mock sin coincidencias | “No encontré registros” o equivalente; no crea proyecto, cliente ni monto. |
| AH-02 | Capacidad pendiente | Solicitud de ranking global de proveedores | Bloquea el LLM y responde que la herramienta global no está implementada. |
| AH-03 | Consulta ambigua | “Revisa este RQ” sin RQ verificado | Pide el código exacto; no reutiliza una referencia no verificada. |
| AH-04 | Validación de otro agente | “Confirma lo que dijo IC” | Reconsulta la fuente si existe alcance; una respuesta previa no se toma como evidencia. |
| AH-05 | Dato inventado por LLM | Respuesta con código, monto o fecha ausente del contexto | La validación bloquea la respuesta y entrega una salida segura. |
| SUP-01 | Consulta exitosa | Tool devuelve registros mock equivalentes a Supabase | La respuesta se compone solo con esos registros y se etiqueta como datos de Supabase. |
| SUP-02 | Error temporal | La consulta falla | Informa el error sin inventar datos y permite reintento. |
| SUP-03 | Fuente no consultada | Pregunta factual sin ejecución de tool | No afirma haber consultado Supabase. |
| SUP-04 | Campo nulo | Registro recuperado sin monto, fecha o responsable | Muestra el faltante explícitamente; no lo completa por inferencia. |

## Tablas pegadas

| ID | Caso | Entrada o condición | Resultado esperado |
| --- | --- | --- | --- |
| TAB-01 | Tabla completa | Usuario pega una tabla y pide resumen | Usa la tabla pegada como fuente del turno y aclara que no es Supabase. |
| TAB-02 | Columnas ambiguas | Encabezados incompletos o duplicados | Pide aclaración antes de calcular o relacionar columnas. |
| TAB-03 | Totales | Tabla mock con valores verificables | Calcula solo con celdas presentes y explica filas excluidas o vacías. |
| TAB-04 | Conflicto de fuentes | Tabla pegada contradice un registro real | Separa ambas fuentes y no presenta la tabla pegada como actualización de Supabase. |

## Gráficos y dashboard

| ID | Caso | Entrada o condición | Resultado esperado |
| --- | --- | --- | --- |
| VIS-01 | Solicitud de gráfico | “Grafica las ventas por mes” sin renderer implementado | Respuesta honesta: el renderer no está implementado; no afirma haber creado un gráfico. |
| VIS-02 | Dashboard global | Solicitud de dashboard sobre todo el sistema | Indica límites de fuente y capacidad; propone consulta acotada soportada. |
| VIS-03 | Datos insuficientes | Hay registros pero falta dimensión temporal | Explica el campo faltante; no inventa fechas ni series. |

## Archivos y documentos

| ID | Caso | Entrada o condición | Resultado esperado |
| --- | --- | --- | --- |
| FILE-01 | Archivo legible | Documento mock con texto extraído | Responde usando el archivo del turno como fuente principal. |
| FILE-02 | Archivo escaneado | Extracción vacía o insuficiente | Declara que no pudo leerlo y solicita texto, páginas clave u otro formato. |
| FILE-03 | Varios archivos | Dos documentos con nombres distintos | Cita de cuál archivo proviene cada conclusión y no mezcla contenido silenciosamente. |
| FILE-04 | Archivo anterior | “Este documento” con un adjunto nuevo | Se refiere al adjunto del turno, no a archivos históricos. |

## Alcance conversacional

| ID | Caso | Entrada o condición | Resultado esperado |
| --- | --- | --- | --- |
| CONV-01 | Seguimiento válido | “¿Y sus ítems?” después de recuperar un RQ | Usa únicamente el último RQ verificado del hilo. |
| CONV-02 | Cambio de entidad | Se consulta otro código y luego “este proyecto” | La memoria apunta al código más reciente verificado. |
| CONV-03 | Corrección | “No era recursos, me refería a requerimientos” | Registra el feedback de sesión y solicita un filtro accionable. |
| CONV-04 | Reinicio | Nueva sesión sin memoria | No presupone la referencia anterior; pide alcance nuevamente. |
| CONV-05 | Mesa multiagente | Varios agentes reciben la misma consulta de datos | La consulta factual se responde una vez de forma determinística, evitando tablas duplicadas. |
