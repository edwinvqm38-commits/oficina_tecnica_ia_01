"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { useStore, useSkillsWithOverrides } from "../../lib/store/StoreProvider";
import { agentById, AGENTS, PROJECTS } from "../../lib/data";
import type { Skill } from "../../lib/types";
import { agentAvatarClass } from "./shared";
import { sendChatWithFallback } from "../../lib/llm/providers";
import { routeRequest } from "../../lib/llm/modelRouter";
import type { ChatMessage } from "../../lib/llm/providers";
import { parseInput, isSimpleMessage, isTeamMessage, hasClearIntent, isContinuationRequest, slugForUser, HUMANIZE_CTX } from "../../lib/chat/messageUtils";
import type { UserDirectory } from "../../lib/chat/messageUtils";
import { buildContextPrompt, buildRequirementItemsPrompt, fetchRequirementItems } from "../../lib/chat/contextQuery";
import type { ChatCtx } from "../../lib/chat/contextQuery";
import { buildDeterministicAnswerFromResults, runContextPipeline } from "../../lib/chat/contextRouter";
import { buildUserContentWithVision, buildVisionAttachmentNote } from "../../lib/chat/visionContent";
import { MdText } from "../chat/MdText";
import { HelpPanel } from "../chat/HelpPanel";
import { ChatAutoInput } from "../chat/ChatAutoInput";
import { useSession } from "../../lib/auth/useSession";
import {
  saveConversation,
  loadConversationHistory,
  loadAgentMemories,
  loadApprovedAgentKnowledge,
  buildAgentMemoryPrompt,
  saveAgentMemory,
  proposeAgentKnowledge,
  buildMemoryCandidate,
} from "../../lib/memory/conversationMemory";
import { recordAgentAnswerPerformance } from "../../lib/memory/agentPerformance";
import { colorForEmail, initialsFor } from "../../lib/presence/avatar";
import { useApprovedUsers, type ApprovedUser } from "../../lib/presence/useApprovedUsers";
import { useRoomPresence, presenceStatus, type RoomPresenceEntry } from "../../lib/presence/useRoomPresence";

// Commands that explicitly request an AI response in Mesa de trabajo, even
// when "IA: por mención" is active.
const AI_COMMAND_RE = /^\/(ia|resumen|pendientes|consulta|rfi|revisar|costos|cronograma|coordinar|coordinacion|coordinación)\b/i;
const AGENT_MENU_RE = /(?:^|\s)\/menu\b/i;
const AGENT_MENU_SENTINEL = "__AGENT_MENU__:";
const AGENT_MENU_USAGE_KEY = "ot:rt:agent-menu-usage";
const LLM_USAGE_KEY = "ot:rt:llm-usage";
const LLM_WINDOW_MS = 60_000;
const LLM_WINDOW_LIMIT = 40;
const AGENT_TO_AGENT_MENTION_RE = /@(IC|PM|IE|CD|TI)\b/gi;
const MAX_AGENT_FOLLOWUPS = 2;
const NO_RESPONDER_RE = /\[(?:no\s+responder|sin\s+ia|solo\s+humanos?)\]/i;
const SOCIAL_GREETING_RE = /^(hola|buenos\s+d[ií]as|buen\s+d[ií]a|buenas\s+tardes|buenas\s+noches|saludos)\b/i;
const COORDINATION_RE = /\b(coordina|coordine|coordinar|coordinaci[oó]n|gestiona|gestione|gestionar|organiza|organice|organizar|lidera|lidere|liderar|asigna|asigne|asignar|delega|delegue|delegar|objetivo|plan\s+de\s+acci[oó]n|haz\s+seguimiento|seguimiento\s+con\s+el\s+equipo|equipo\s+ia)\b/i;
const APP_DELIVERY_RE = /\b(p[aá]same|env[ií]ame|m[aá]ndame|comp[aá]rteme|dame)\b.*\b(aplicaci[oó]n|app|html|archivo)\b.*\b(probar|probarlo|aqu[ií]|mesa)\b/i;

type LlmUsageSnapshot = {
  count: number;
  resetAt: number;
  lastLabel: string;
};

function loadLlmUsage(): LlmUsageSnapshot {
  const now = Date.now();
  if (typeof window === "undefined") return { count: 0, resetAt: now + LLM_WINDOW_MS, lastLabel: "sin uso" };
  try {
    const raw = localStorage.getItem(LLM_USAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<LlmUsageSnapshot> : {};
    const resetAt = typeof parsed.resetAt === "number" ? parsed.resetAt : now + LLM_WINDOW_MS;
    if (resetAt <= now) return { count: 0, resetAt: now + LLM_WINDOW_MS, lastLabel: parsed.lastLabel || "sin uso" };
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      resetAt,
      lastLabel: parsed.lastLabel || "sin uso",
    };
  } catch {
    return { count: 0, resetAt: now + LLM_WINDOW_MS, lastLabel: "sin uso" };
  }
}

function saveLlmUsage(snapshot: LlmUsageSnapshot) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LLM_USAGE_KEY, JSON.stringify(snapshot));
}

function contextPipelineWithTimeout(query: string) {
  return Promise.race([
    runContextPipeline(query),
    new Promise<Awaited<ReturnType<typeof runContextPipeline>>>((resolve) => {
      window.setTimeout(() => resolve({
        block: "\n\n(No pude completar la consulta de contexto en el tiempo esperado. Responde sin inventar datos y pide reintentar o acotar la consulta.)",
        decision: {
          intent: "timeout_contexto",
          toolsToCall: [],
          confidence: 0,
          reason: "La consulta de contexto tardó demasiado.",
        },
        results: [],
        hasData: false,
      }), 12_000);
    }),
  ]);
}

// Whether the AI team should jump into every message (vs. only when
// explicitly @mentioned or asked via a /command). Off by default so
// human-to-human conversation in Mesa de trabajo isn't interrupted.
function useAiAssist() {
  const [enabled, setEnabled] = useState(() => typeof window !== "undefined" && localStorage.getItem("ot:rt:ai-assist") === "true");
  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("ot:rt:ai-assist", next ? "true" : "false");
  }
  return { enabled, toggle };
}

const ROUNDTABLE_THREAD = "roundtable";

// Cap how many messages get mounted in the DOM at once — long shared threads
// shouldn't render hundreds of RTMessage (and MdText) instances on mount.
const VISIBLE_MESSAGES_STEP = 30;
const CLEAR_VIEW_KEEP_MESSAGES = 18;
const CONVERSATION_MEMORY_DAYS = 5;
const OPERATIONAL_MEMORY_DAYS = 60;
const AGENT_LEARNING_CTX = `\n\nMemoria y aprendizaje:
- Usa tres capas de memoria: conversación reciente de 5 días, memoria operativa temporal de 60 días y conocimiento permanente aprobado por el administrador.
- El conocimiento permanente aprobado tiene prioridad sobre memoria temporal, pero los datos reales consultados de Supabase tienen prioridad cuando la pregunta es sobre registros.
- Si necesitas aprender una regla, formato o criterio interno de la empresa, pide al usuario la informacion concreta que falta.
- Si el usuario te enseña una regla o criterio ("aprende", "recuerda", "así trabajamos"), trátalo como aprendizaje propuesto: úsalo como memoria operativa y deja claro cuando requiera validación del administrador para volverse permanente.
- No inventes historicos ni codigos. Si el usuario pide registros, solicita codigo, cliente, proyecto, fecha o palabra clave cuando no haya contexto suficiente.
- Si el usuario hace una pregunta general, personal, de aprendizaje, redaccion, criterio profesional o lluvia de ideas, responde sin pedir proyecto ni codigo.
- Responde como profesional humano de tu especialidad: natural, tecnico cuando corresponde, breve y con criterio.`;

const GENERAL_CONVERSATION_CTX = `\n\nModo conversacion amplia:
- Tu especialidad influye en tu mirada, pero no limita tus temas. Puedes conversar sobre productividad, ideas, dudas generales, aprendizaje, comunicacion, documentos, decisiones, tecnologia, procesos, trato con clientes y explicaciones sencillas.
- Si no es una consulta tecnica, responde con calidez y naturalidad. Evita convertir todo en checklist de proyecto.
- Puedes mostrar preferencias y criterio profesional moderado: "yo lo enfocaria asi...", "para mi lo importante es...".
- Si el usuario parece estar explorando una idea, ayudalo a pensar antes de pedirle datos.
- No digas "solo puedo ayudar con proyectos" ni "necesito un requerimiento" salvo que realmente este pidiendo datos internos.`;

const HTML_APP_GENERATION_CTX = `\n\nGeneracion de aplicaciones HTML en la Mesa:
- Si el usuario pide una aplicacion, app, simulador, calculadora, dashboard, prototipo, replica/mejora de HTML adjunto o "mostrarlo aqui para probar", responde con un bloque \`\`\`html-app que contenga un documento HTML completo y autocontenido.
- Si el usuario dice "hazlo en HTML", "por aqui", "en una app", "para probarlo en la mesa" o "descargable", NO cierres con promesas ni texto explicativo solamente: entrega el bloque \`\`\`html-app en ese mismo turno.
- No te limites a explicar ni resumir el HTML adjunto cuando el usuario pide probar una app. Usa el adjunto como referencia principal de estructura, datos, formulas, estilos, flujo y nivel visual.
- Si el usuario pide "similar", "replica", "mejora" o "avanzada", NO entregues una calculadora minima de una sola pantalla. El estandar minimo es: cabecera profesional, tarjetas KPI, navegacion por tabs/secciones, tabla editable de datos, recalculo en tiempo real, grafica o canvas/SVG, resultados/resumen, validaciones y botones de exportacion.
- Para ingenieria, incluye cuando aplique: formulas visibles, supuestos editables, tabla de parametros, perfil/esquema en canvas o SVG, grafica tecnica y reporte resumido. Para costos/gestion/documentos, adapta el mismo nivel: dashboard, matriz, trazabilidad, cronograma, comparativos o indicadores.
- La app debe ser usable en navegador sin backend: HTML, CSS y JS vanilla. Puedes usar CDN livianas solo cuando aporten mucho: Plotly/Chart.js para graficas, MathJax/KaTeX para formulas, XLSX para importar/exportar tablas.
- Incluye controles reales: entradas editables, selectores, tabs, tablas, recalculo en tiempo real, graficas, exportacion CSV/JSON/HTML cuando corresponda y mensajes de validacion. Usa datos de ejemplo realistas del contexto o del adjunto, marcando supuestos.
- No incluyas claves, tokens ni llamadas a APIs privadas. No guardes archivos externos ni datos sensibles desde la app generada.
- Si la app completa supera el limite de respuesta, entrega una version funcional por modulos con la arquitectura completa y al menos 3 secciones operativas; di exactamente que modulo falta para una segunda iteracion. No simules que generaste algo que no esta en el bloque.
- Cuando el usuario valide una app como correcta o base futura, resume arquitectura, formulas, entradas, salidas y criterios UX para que se pueda guardar como conocimiento/skill versionable.`;

// Mesa de trabajo is a shared room: all users see the same conversation, so
// the agents' long-term memory for it is stored under one shared id instead
// of being split per user — agents learn from everyone in the room.
const ROUNDTABLE_MEMORY_ID = "roundtable-shared";

// Dedicated presence channel for "Usuarios en la mesa" — separate from the
// global "presence:app" channel (PresenceBar) to avoid double-subscribing
// to the same channel topic.
const ROOM_PRESENCE_CHANNEL = "presence:roundtable";

// Below this width, the "Usuarios en la mesa" column collapses into a
// toggleable drawer (Req 5 — responsive layout).
const NARROW_BREAKPOINT = 1100;

// localStorage key for mention-notification dedup, so reloading the page
// doesn't re-notify for messages already seen.
const NOTIFIED_MENTIONS_KEY = "ot:rt:notifiedMentions";

function loadNotifiedMentions(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_MENTIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedMentions(ids: Set<string>) {
  try {
    localStorage.setItem(NOTIFIED_MENTIONS_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    // ignore (private browsing / quota)
  }
}

const RT_SYSTEM_PROMPTS: Record<string, string> = {
  ic: `Eres Arturo, el Ingeniero de Costos (IC) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: meticuloso, preciso con los números, ligeramente pesimista sobre presupuestos — siempre hay contingencias olvidadas.
Especialista en: presupuestos S/., metrados, valorizaciones, análisis de desviación de costo, adicionales de obra, análisis de propuestas.
Personalidad: Usas S/ naturalmente. Conviertes USD a S/ (TC ≈ 3.75). Preguntas por las partidas antes de opinar. Te incomoda cuando no hay desglose. Dices "Ojo:" para alertas.
Fuera de costos: sigues siendo Arturo. Puedes conversar de forma cercana sobre organización, decisiones, aprendizaje, Excel, redacción, hábitos de control, negociación con proveedores o dudas generales. Tu sesgo sano es aterrizar ideas a impacto, esfuerzo y riesgo.
Formato:
- Análisis → **negritas** para S/ importes, % desviaciones y conclusiones. Estructura con partidas cuando aplica.
- Cálculos justificativos → usa LaTeX para fórmulas, sustituciones y porcentajes relevantes; no escribas fórmulas complejas como texto plano.
- Conversación general → natural, breve, sin forzar importes ni pedir partidas.
- Menciona @PM si el retraso afecta costos, @IE si necesitas validar alcance técnico.
- Si la decisión supera tu nivel, menciona @GG.
- Responde en español peruano. Cuando detectes sobrecoste, puedes cerrar con "Ojo con las provisiones." (sin abusar de la frase).`,

  pm: `Eres Carlos, el Project Manager (PM) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: práctico, orientado a hitos, directo. Hablas en fechas, semanas y semáforos.
Especialista en: cronogramas, ruta crítica, riesgos, restricciones, recuperación de atrasos, look-ahead semanal.
Personalidad: Usas ● para listas. Referencias a semanas (S1, S2). Siempre tienes Plan B. Tu pregunta favorita: "¿y cuánto tiempo falta?". Semáforos: 🟢 en tiempo / 🟡 con riesgo / 🔴 retrasado.
Fuera de proyectos: sigues siendo Carlos. Puedes ayudar con priorización, hábitos de trabajo, decisiones, planificación personal, reuniones, comunicación, aprendizaje y preguntas generales. Tu sesgo sano es ordenar el caos y proponer el siguiente paso.
Formato:
- Análisis → **negritas** para fechas críticas, hitos y riesgos. Máx 3 párrafos. Si hay retraso: días de atraso, impacto en hito siguiente, 2 opciones de recuperación.
- Cálculos de plazo/rendimiento → usa LaTeX si hay fórmula o relación matemática.
- Conversación general → habla natural, directo y con humor seco ocasional; no conviertas todo en cronograma.
- Menciona @IC para impacto económico, @IE para validar alcance técnico.
- Cuando necesitas aprobación, menciona @GG.
- Responde en español. Directo, sin adornos.`,

  ie: `Eres María, la Ingeniera Eléctrica Especialista (IE) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: técnica, apasionada por las normas, cita estándares naturalmente. Te entusiasmas con problemas de alta tensión.
Especialista en: CNE-U, IEC 60364, IEEE Std 141/242/519, diseño de SET, cálculo de cables, coordinación de protecciones, estudios de cortocircuito.
Personalidad: Citas normativas (CNE-U Art. 020, IEC 60364-4-41) cuando aplica. Usas kV, MVA, A, Ω con precisión. Distingues instalaciones (CNE) de concesionarias (DGE/MINEM).
Fuera de electricidad: sigues siendo María. Puedes explicar conceptos, estudiar con el usuario, revisar textos, conversar sobre tecnologia, seguridad, aprendizaje y pensamiento técnico. Tu sesgo sano es distinguir supuesto, evidencia y criterio.
Formato:
- Análisis → **negritas** para valores técnicos, normas y conclusiones de diseño. Usa tablas de comparación cuando hay opciones.
- Fórmulas → usa LaTeX renderizable. Ejemplo en bloque:
$$
I = \\frac{P}{\\sqrt{3}\\,V\\,FP}
$$
- Variables → explícalas con guiones y símbolo LaTeX, ejemplo: '- $V$: tensión [V]'. Evita viñetas con asterisco junto a símbolos '$'.
- Gráficas técnicas → si el usuario pide curva, variación en el tiempo, comparación, dashboard o superficie, usa bloques chart/graph2d/graph3d/plotly según corresponda. En graph2d, la variable usada en "expression" debe coincidir con "variable"; para Ley de Ohm con R=5 Ω usa {"expression":"5*I","variable":"I","x":{"min":0,"max":5,"points":80},"animation":{"enabled":true,"variable":"I"}}. Para simulación temporal usa "t" solo si la expresión usa t. Si el usuario pide una app, simulador, dashboard editable o replica/mejora de un HTML, usa \`\`\`html-app con HTML/CSS/JS autocontenido.
- Diagramas básicos/unifilares → si el usuario pide esquema o imagen conceptual, usa bloque Mermaid tipo 'flowchart LR' con barras, interruptores, transformadores, cargas y protecciones. No inventes conexiones no visibles; marca supuestos.
- Planos PDF/imagen, unifilares, tableros y cuadros de carga → protocolo obligatorio:
  1. Primero lee la leyenda visible y arma una tabla "Leyenda identificada" con Símbolo, Descripción y Texto visible. Si la leyenda muestra, por ejemplo, MCB 2x16A, MCCB 160AF/160AT, punto a tierra, seccionador portafusible o portalámpara, úsalo solo como referencia de esa hoja.
  2. Luego enumera el "Metrado observado" contando únicamente símbolos, etiquetas, ramales o textos legibles en el plano actual. No inventes componentes típicos ni etiquetas como I1, C1, R1, M1 o T1 salvo que estén visibles.
  3. La tabla debe tener Item, Equipo/material, Símbolo/etiqueta visible, Cantidad, Ubicación/plano/zona, Confianza y Observación.
  4. Crea una sección "Elementos inferidos/no verificables" para lo dudoso. Si no se puede leer, escribe "No verificable"; no rellenes por experiencia.
  5. Declara el alcance: página completa, recorte visible, hoja parcial o imagen borrosa. Si falta resolución o PDF vectorial, pídelo.
- Conversación general → cercana, didáctica y clara; no cites normas si no aportan.
- Menciona @IC para presupuesto de materiales, @PM para integración en cronograma.
- Escala a @GG cuando requiere decisión de inversión mayor.
- Responde en español. Técnica pero comprensible.`,

  cd: `Eres Valeria, responsable de Control Documentario (CD) de EKA Ingeniería.
Carácter: ordenada, preventiva y muy atenta a trazabilidad. Tu foco es que nada operativo quede sin código, versión, carpeta, hilo, responsable o evidencia.
Especialista en: codificación documental, control de versiones, matrices de registro, hilos de correo, carpetas Drive, trazabilidad entre cotización, RQ, OC, propuesta técnica y archivos.
Comportamiento proactivo: si en la conversación detectas una gestión que debería registrarse o codificarse, avisa de forma breve aunque no te lo pidan explícitamente.
Formato:
- Alerta documental → **qué falta**, **por qué importa**, **acción mínima recomendada**.
- Si hay un código COT/RQ/REC en contexto, úsalo como ancla y no inventes otro.
- Menciona @PM si impacta seguimiento, @IC si impacta presupuesto, @TI si requiere automatización.
- Responde en español claro, práctico y sin burocracia innecesaria.`,

  ti: `Eres Diego, Ingeniero de Sistemas / TI (TI) de EKA Ingeniería.
Carácter: técnico, directo y preventivo. Tu foco es que la app no se rompa ni consuma recursos de más.
Especialista en: Next.js, Supabase/Postgres, permisos, egress, Google APIs, integraciones, performance, errores de UI, arquitectura y prompts técnicos para Codex.
Comportamiento proactivo: si detectas una gestión que puede causar deuda técnica, egress excesivo, datos inconsistentes o errores futuros, avisa brevemente y propone una corrección.
Formato:
- Diagnóstico → causa probable, impacto, verificación y corrección.
- Cálculos de capacidad, consumo, egress, costos o rendimiento → usa LaTeX para las fórmulas y muestra unidades.
- Si el usuario necesita tocar código, entrega un prompt listo para Codex o una tarea técnica clara.
- Menciona @CD si afecta trazabilidad documental, @GG si requiere decisión de costo/arquitectura.
- Responde en español, concreto y sin alarmismo.`,
};

const RT_KEYWORDS: Record<string, string[]> = {
  ic: ["costo", "costos", "presupuesto", "precio", "valoriz", "adicional", "desviaci", "metrado", "contingencia", "soles", "s/", "económic", "rentab", "partida", "gasto", "oferta", "cotiz"],
  pm: ["cronograma", "plazo", "retraso", "riesgo", "restricci", "ruta crítica", "hito", "avance", "recuper", "planific", "fecha", "entrega", "atraso", "gestión"],
  ie: ["diseño", "eléctric", "norma", "normativ", "cálculo", "cne", "iec", "ieee", "protección", "tensión", "kv", "subestación", "cable", "tendido", "set ", "potencia"],
  cd: ["document", "codigo", "código", "codific", "version", "versión", "trazab", "registro", "carpeta", "drive", "archivo", "hilo", "correo", "entregable", "oc", "rq", "cotizacion", "cotización"],
  ti: ["sistema", "app", "web", "error", "bug", "supabase", "egress", "performance", "lento", "localhost", "vercel", "github", "codex", "api", "integracion", "integración", "login", "gmail", "drive"],
};

// Matriz de responsabilidades: a qué agente le corresponde cada tema.
// Usada para enrutar consultas y para que el coordinador (PM) derive
// al especialista correcto sin que todo el equipo responda a la vez.
export const AGENT_TOPICS: Record<string, string> = {
  ic: "presupuestos, costos, valorizaciones, metrados",
  pm: "cronograma, plazos, riesgos del proyecto",
  ie: "diseño eléctrico, normas técnicas, cálculos",
  cd: "control documentario, códigos, versiones, carpetas, registros y trazabilidad",
  ti: "soporte técnico, app web, Supabase, integraciones, performance y prompts para Codex",
};

// "Coordinador" único para mensajes generales (saludos / mensajes al equipo
// sin tema específico): solo este agente responde, derivando al resto por
// @mención según corresponda. Evita que se llene el chat con saludos repetidos.
const TEAM_COORDINATOR = "pm";

type AgentMenuOption = {
  label: string;
  prompt: string;
  description: string;
};

type AgentMenuScope = {
  label: string;
  fragment: string;
  hint: string;
};

const DEFAULT_MENU_SCOPES: AgentMenuScope[] = [
  { label: "Último contexto", fragment: "del último código o contexto mencionado", hint: "Usa el código, cotización, RQ o recurso más reciente del hilo." },
  { label: "Última cotización", fragment: "de la última cotización registrada o mencionada", hint: "Útil cuando solo quieres revisar la cotización más reciente." },
  { label: "Este mes", fragment: "de este mes", hint: "Aplica filtro mensual con datos reales de Supabase." },
  { label: "Mes pasado", fragment: "del mes pasado", hint: "Compara o revisa registros del periodo anterior." },
];

const AGENT_QUICK_MENUS: Record<string, AgentMenuOption[]> = {
  ic: [
    {
      label: "Resumen económico",
      prompt: "@IC dame un resumen económico del último código o contexto mencionado, usando solo datos registrados.",
      description: "Monto, margen, partidas relevantes y alertas de costo.",
    },
    {
      label: "Riesgos de costo",
      prompt: "@IC identifica riesgos de costo, provisiones y datos faltantes del último contexto mencionado.",
      description: "Compras, proveedor, alcance y contingencias.",
    },
    {
      label: "Validar oferta",
      prompt: "@IC valida el monto ofertado del último contexto mencionado y compáralo con el alcance registrado.",
      description: "Consistencia entre monto, alcance y registros.",
    },
    {
      label: "Partidas faltantes",
      prompt: "@IC revisa si faltan partidas o recursos típicos para el alcance del último contexto mencionado.",
      description: "Checklist rápido antes de cerrar presupuesto.",
    },
  ],
  pm: [
    {
      label: "Estado y avance",
      prompt: "@PM resume estado, avance, próximos hitos y restricciones del último contexto mencionado.",
      description: "Semáforo operativo y siguiente paso.",
    },
    {
      label: "Riesgos del plan",
      prompt: "@PM identifica riesgos de plazo y dependencias del último contexto mencionado.",
      description: "Lo que puede atrasar o bloquear la gestión.",
    },
    {
      label: "Plan 7 días",
      prompt: "@PM arma un plan de acción de 7 días para avanzar el último contexto mencionado.",
      description: "Acciones, responsable sugerido y evidencia esperada.",
    },
    {
      label: "Coordinar equipo",
      prompt: "@PM coordina al equipo IA para definir acciones concretas sobre el último contexto mencionado.",
      description: "Ronda breve con especialistas y cierre del PM.",
    },
  ],
  ie: [
    {
      label: "Prechequeo técnico",
      prompt: "@IE realiza un prechequeo técnico del último contexto mencionado, indicando supuestos y datos faltantes.",
      description: "Revisión ligera sin entrar a estudio pesado.",
    },
    {
      label: "Metrado de plano",
      prompt: "@IE metra e interpreta el plano adjunto usando solo elementos visibles. Primero identifica la leyenda, luego entrega metrado observado y elementos no verificables.",
      description: "Conteo con leyenda, evidencia visible y confianza por fila.",
    },
    {
      label: "Fórmula y cálculo",
      prompt: "@IE muestra la fórmula aplicable en LaTeX y un cálculo ejemplo con unidades para el último contexto mencionado.",
      description: "Cálculo justificativo básico y visual.",
    },
    {
      label: "Norma aplicable",
      prompt: "@IE indica qué norma o criterio técnico aplica al último contexto mencionado y por qué.",
      description: "CNE, IEC, IEEE u otro criterio, sin inventar datos.",
    },
    {
      label: "Esquema simple",
      prompt: "@IE genera un esquema Mermaid básico del último contexto mencionado, marcando supuestos.",
      description: "Unifilar conceptual o flujo simple.",
    },
  ],
  cd: [
    {
      label: "Checklist documental",
      prompt: "@CD revisa qué registro, código, carpeta, versión o hilo faltaría para el último contexto mencionado.",
      description: "Trazabilidad mínima antes de mover la gestión.",
    },
    {
      label: "Alerta de trazabilidad",
      prompt: "@CD emite una alerta documental breve del último contexto mencionado con acción mínima recomendada.",
      description: "Qué falta, por qué importa y cómo cerrarlo.",
    },
    {
      label: "Hilo de correo",
      prompt: "@CD propone asunto, destinatarios base y evidencia que debe quedar en el hilo para el último contexto mencionado.",
      description: "Evita hilos duplicados y pérdida de respaldo.",
    },
    {
      label: "Estructura Drive",
      prompt: "@CD sugiere la estructura de carpeta y archivos para el último contexto mencionado.",
      description: "Orden documental sin subir archivos a Supabase.",
    },
  ],
  ti: [
    {
      label: "Diagnóstico app",
      prompt: "@TI diagnostica el problema técnico mencionado en el hilo y propone verificación y corrección.",
      description: "Causa probable, impacto y siguiente prueba.",
    },
    {
      label: "Cuidar egress",
      prompt: "@TI revisa si la consulta o flujo mencionado puede generar egress excesivo y cómo optimizarlo.",
      description: "Paginación, RPC, cache y lecturas mínimas.",
    },
    {
      label: "Prompt para Codex",
      prompt: "@TI redacta un prompt claro para Codex que implemente la mejora técnica mencionada.",
      description: "Listo para pegar en VS Code/Codex.",
    },
    {
      label: "Riesgo futuro",
      prompt: "@TI analiza qué conflicto técnico podría aparecer a futuro con la gestión mencionada.",
      description: "Prevención antes de que el sistema crezca.",
    },
  ],
};

function agentsForMessage(text: string, targetIds: string[], hasAttachments = false): string[] {
  const allActive = AGENTS.filter((a) => a.type === "agent" && a.status === "active").map((a) => a.id);

  // If user directed to one or more specific (active AI) agents, those
  // respond — in the order mentioned. Falls through to the generic logic
  // below if none of the mentioned ids are active AI agents (e.g. @GG,
  // which is the human Gerente General and doesn't get an AI reply).
  if (targetIds.length > 0) {
    const targeted = targetIds.filter((id) => allActive.includes(id));
    if (targeted.length > 0) return targeted;
  }

  // "buenos días a todos" / team messages → only the coordinator responds
  // briefly and points to the right specialist via @mención.
  if (isTeamMessage(text)) return allActive.includes(TEAM_COORDINATOR) ? [TEAM_COORDINATOR] : allActive;

  const t = text.toLowerCase();
  const scored = allActive.map((id) => ({
    id, hits: (RT_KEYWORDS[id] || []).filter((k) => t.includes(k)).length,
  }));

  // Simple message: if it matches a specific agent's topic, only that agent responds;
  // otherwise (general greeting/intro) only the coordinator responds.
  // A short message with a file attached is NOT "simple" — there is real
  // content (the file) to analyze, so it goes through the technical path.
  if (isSimpleMessage(text) && !hasAttachments) {
    const best = scored.sort((a, b) => b.hits - a.hits)[0];
    if (best && best.hits > 0) return [best.id];
    return allActive.includes(TEAM_COORDINATOR) ? [TEAM_COORDINATOR] : allActive;
  }

  // Technical message → all agents with keyword hits; if none, IC+PM
  const relevant = scored.filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits);
  if (relevant.length > 0) return relevant.map((s) => s.id);
  return ["ic", "pm"];
}

function agentsForCoordination(text: string, targetIds: string[]): string[] {
  const allActive = AGENTS.filter((a) => a.type === "agent" && a.status === "active").map((a) => a.id);
  const explicitlyTargeted = targetIds.filter((id) => id !== "pm" && allActive.includes(id));
  if (explicitlyTargeted.length > 0) return explicitlyTargeted.slice(0, 3);

  const t = text.toLowerCase();
  const scored = allActive
    .filter((id) => id !== "pm")
    .map((id) => ({ id, hits: (RT_KEYWORDS[id] || []).filter((k) => t.includes(k)).length }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((item) => item.id);

  if (scored.length > 0) return scored.slice(0, 3);
  return ["cd", "ic"].filter((id) => allActive.includes(id));
}

function extractAgentFollowups(text: string, exclude: Set<string>): string[] {
  const active = new Set(AGENTS.filter((a) => a.type === "agent" && a.status === "active").map((a) => a.id));
  const found: string[] = [];
  for (const match of text.matchAll(AGENT_TO_AGENT_MENTION_RE)) {
    const id = match[1].toLowerCase();
    if (!active.has(id) || exclude.has(id) || found.includes(id)) continue;
    found.push(id);
    if (found.length >= MAX_AGENT_FOLLOWUPS) break;
  }
  return found;
}

function loadMenuUsage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AGENT_MENU_USAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function mesaProviderErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Error desconocido";
  if (/fetch failed|failed to fetch|fallo de red|network|timeout|aborted/i.test(raw)) {
    return "No pude conectar con los proveedores IA. Parece un corte de internet, DNS/firewall o proveedor no disponible. Revisa Conexiones/API keys y vuelve a intentar.";
  }
  if (/401|unauthorized|invalid api key|clave API/i.test(raw)) {
    return "No pude autenticar con el proveedor IA. Revisa que la API key esté vigente y corresponda al proveedor configurado en Conexiones.";
  }
  if (/429|quota|rate limit|l[ií]mite|cuota/i.test(raw)) {
    return "El proveedor IA rechazó la solicitud por límite o cuota. Prueba otro proveedor en Conexiones o espera a que se libere la cuota.";
  }
  return `No pude conectar con ningún proveedor IA. ${raw}`;
}

function buildAppDeliveryGuidance(agentId: string): string {
  const agentName = agentById(agentId)?.name ?? "el agente";
  return [
    `Entiendo lo que quieres probar con ${agentName}, pero la Mesa de trabajo no puede adjuntar ni ejecutar una app nueva por sí sola.`,
    "",
    "Para probarla aquí tienes tres caminos prácticos:",
    "- Si ya tienes un `.html`, súbelo como archivo adjunto y lo analizo como código.",
    "- Si quieres que Codex cree o modifique una app local, dime la ruta o la idea exacta y la implemento en el proyecto.",
    "- Si solo quieres una demo ligera dentro del chat, pide una gráfica, tabla o diagrama Mermaid y te lo muestro en la respuesta.",
    "",
    "Si es una simulación pesada de ingeniería, lo correcto será llevarla al futuro módulo **Ingeniería** para no volver lenta la Mesa.",
  ].join("\n");
}

function isHtmlAttachment(a: { name: string; type: string }): boolean {
  return /\.html?$/i.test(a.name) || a.type === "text/html";
}

function HtmlAttachmentPreview({ a }: { a: { name: string; size: number; type: string; dataUrl?: string } }) {
  const [expanded, setExpanded] = useState(true);
  if (!a.dataUrl || !isHtmlAttachment(a)) return null;
  return (
    <div style={{ marginTop: 8, background: "#fff", color: "var(--t1)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", minWidth: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
        <span style={{ fontWeight: 700, fontSize: 11.5 }}>Vista previa HTML</span>
        <span style={{ color: "var(--t3)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
        <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto", fontSize: 10 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Ocultar" : "Mostrar"}
        </button>
        <a className="btn btn--ghost btn--sm" style={{ fontSize: 10, textDecoration: "none" }} href={a.dataUrl} target="_blank" rel="noreferrer">
          Abrir
        </a>
        <a className="btn btn--ghost btn--sm" style={{ fontSize: 10, textDecoration: "none" }} href={a.dataUrl} download={a.name}>
          Descargar
        </a>
      </div>
      {expanded && (
        <iframe
          title={`Vista previa de ${a.name}`}
          src={a.dataUrl}
          sandbox="allow-scripts allow-forms allow-modals allow-downloads"
          style={{ display: "block", width: "100%", height: 420, border: 0, background: "#fff" }}
        />
      )}
    </div>
  );
}

function saveMenuUsage(usage: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AGENT_MENU_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore storage quota/private mode
  }
}

function bumpMenuUsage(key: string) {
  const usage = loadMenuUsage();
  usage[key] = (usage[key] ?? 0) + 1;
  saveMenuUsage(usage);
}

function menuUsageKey(agentId: string, optionLabel: string, scopeLabel = "") {
  return `${agentId}:${optionLabel}:${scopeLabel}`.toLowerCase();
}

function scopedMenuPrompt(basePrompt: string, scope: AgentMenuScope | null, customText?: string) {
  if (customText?.trim()) {
    return `${basePrompt}\n\nDetalle manual del usuario: ${customText.trim()}`;
  }
  if (!scope) return basePrompt;
  let prompt = basePrompt
    .replace(/del último código o contexto mencionado/gi, scope.fragment)
    .replace(/del último contexto mencionado/gi, scope.fragment)
    .replace(/de la última cotización registrada o mencionada/gi, scope.fragment);
  if (prompt === basePrompt) prompt = `${basePrompt}\n\nAlcance: ${scope.fragment}.`;
  return prompt;
}

// Maps a skill's free-text "agent" field (as written in lib/data.ts) to the
// roundtable agent id, so each agent only sees the skills assigned to it.
function agentIdForSkill(skillAgent: string): string | null {
  const a = skillAgent.toLowerCase();
  if (a.includes("costos")) return "ic";
  if (a.includes("project management")) return "pm";
  if (a.includes("eléctric") || a.includes("electric")) return "ie";
  return null;
}

// Active skills (status === "active", with user overrides applied) become
// concrete instructions in the agent's system prompt — the documented
// trigger/steps/safety rules are followed when relevant to the conversation.
function buildSkillsCtx(agId: string, skills: Skill[]): string {
  const active = skills.filter((s) => s.status === "active" && agentIdForSkill(s.agent) === agId);
  if (!active.length) return "";
  const blocks = active.map((s) =>
    `- "${s.name}" (${s.version}). Se aplica cuando: ${s.trigger}. Pasos a seguir: ${s.steps.join(" → ")}. Reglas: ${s.safety.join("; ")}.`
  );
  return `\n\nSkills activas que debes seguir cuando el tema lo amerite:\n${blocks.join("\n")}`;
}

// Always-on, short snapshot of office-level context so any agent can place
// a question in context even if the user doesn't mention a specific
// project/code. IMPORTANT: this must NEVER include the demo/mock portfolio
// from lib/data.ts (PROJECTS/APPROVALS/ALERTS) — those are fictional sample
// records and agents were conflating them with the real Supabase tables
// (cotizaciones/requerimientos), fabricating codes and project names that
// don't exist. Only real, user-created projects (state.customProjects) are
// summarized here.
function buildPlatformSummary(
  customProjects: { id: string; name: string; client: string; status: string; progress: number; nextMilestone: string; due: string }[]
): string {
  if (customProjects.length === 0) return "";

  const projectLines = customProjects.slice(0, 6).map((p) =>
    `- ${p.id} ${p.name} (${p.client}): ${p.status}, avance ${p.progress}%, próximo hito "${p.nextMilestone}" (${p.due})`
  );

  return `\n\nProyectos personalizados registrados por el usuario (referencia de contexto; no lo repitas a menos que el usuario lo pida):
${projectLines.join("\n")}`;
}

function fileIcon(type: string, name: string): string {
  const n = name.toLowerCase();
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf" || n.endsWith(".pdf")) return "📕";
  if (/\.(xlsx?|csv)$/.test(n)) return "📊";
  if (/\.(docx?)$/.test(n)) return "📝";
  return "📎";
}

function AttachmentChip({ a }: { a: { name: string; size: number; type: string; dataUrl?: string } }) {
  const sizeLabel = a.size > 1024 * 1024 ? `${(a.size / (1024 * 1024)).toFixed(1)}MB` : `${Math.round(a.size / 1024)}KB`;
  const content = (
    <>
      <span>{fileIcon(a.type, a.name)}</span>
      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
      <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.75 }}>{sizeLabel}</span>
    </>
  );
  const sharedStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.18)",
    border: "1px solid rgba(255,255,255,.35)", borderRadius: 6, padding: "3px 9px", fontSize: 11.5, fontWeight: 600,
  };
  if (a.dataUrl) {
    return (
      <a href={a.dataUrl} download={a.name} title="Descargar archivo" style={{ ...sharedStyle, color: "inherit", textDecoration: "none", cursor: "pointer" }}>
        {content}
        <span aria-hidden>⬇</span>
      </a>
    );
  }
  return <span style={sharedStyle}>{content}</span>;
}

function AgentMenuPanel({ agentId, onPrompt }: { agentId: string; onPrompt?: (prompt: string) => void }) {
  const [selectedOption, setSelectedOption] = useState<AgentMenuOption | null>(null);
  const [customText, setCustomText] = useState("");
  const [usageVersion, setUsageVersion] = useState(0);
  const usage = useMemo(() => loadMenuUsage(), [usageVersion]);
  const availableAgentIds = Object.keys(AGENT_QUICK_MENUS).filter((id) => AGENTS.some((a) => a.id === id && a.status === "active"));
  if (agentId === "all") {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--t1)" }}>Menú rápido por agente</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Elige un especialista para ver consultas frecuentes de la Mesa de trabajo.</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {availableAgentIds.map((id) => {
            const agent = agentById(id);
            return (
              <button
                key={id}
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 11 }}
                onClick={() => onPrompt?.(`@${id.toUpperCase()} /menu`)}
              >
                @{id.toUpperCase()} {agent?.name ?? id.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const options = [...(AGENT_QUICK_MENUS[agentId] ?? [])].sort((a, b) => {
    const au = usage[menuUsageKey(agentId, a.label)] ?? 0;
    const bu = usage[menuUsageKey(agentId, b.label)] ?? 0;
    return bu - au;
  });
  const agent = agentById(agentId);
  if (!options.length) {
    return <MdText text="No hay menú configurado para este agente todavía." />;
  }
  const sortedScopes = [...DEFAULT_MENU_SCOPES].sort((a, b) => {
    if (!selectedOption) return 0;
    const au = usage[menuUsageKey(agentId, selectedOption.label, a.label)] ?? 0;
    const bu = usage[menuUsageKey(agentId, selectedOption.label, b.label)] ?? 0;
    return bu - au;
  });

  function runOption(option: AgentMenuOption, scope: AgentMenuScope | null, manual?: string) {
    bumpMenuUsage(menuUsageKey(agentId, option.label));
    if (scope) bumpMenuUsage(menuUsageKey(agentId, option.label, scope.label));
    if (manual?.trim()) bumpMenuUsage(menuUsageKey(agentId, option.label, "manual"));
    setUsageVersion((v) => v + 1);
    onPrompt?.(scopedMenuPrompt(option.prompt, scope, manual));
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--t1)" }}>
          Menú rápido: {agent?.name ?? agentId.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          Acciones ligeras para la Mesa. Para estudios pesados, se derivará al módulo Ingeniería.
        </div>
      </div>
      {!selectedOption && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 7 }}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setSelectedOption(option)}
            style={{
              textAlign: "left",
              background: "var(--bg-subtle)",
              color: "var(--t1)",
              border: "1px solid var(--border)",
              borderRadius: 7,
              padding: "8px 9px",
              cursor: "pointer",
              lineHeight: 1.35,
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>{option.label}</div>
            <div style={{ fontSize: 10.5, color: "var(--t3)" }}>{option.description}</div>
            {(usage[menuUsageKey(agentId, option.label)] ?? 0) > 0 && (
              <div style={{ fontSize: 9.5, color: "var(--green-text)", marginTop: 5 }}>Frecuente</div>
            )}
          </button>
        ))}
      </div>}
      {selectedOption && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--t1)" }}>{selectedOption.label}</div>
              <div style={{ fontSize: 10.5, color: "var(--t3)" }}>Elige el alcance de la consulta o escríbelo manualmente.</div>
            </div>
            <button className="btn btn--ghost btn--sm" style={{ fontSize: 10 }} onClick={() => { setSelectedOption(null); setCustomText(""); }}>
              Volver
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6 }}>
            {sortedScopes.map((scope) => (
              <button
                key={scope.label}
                type="button"
                onClick={() => runOption(selectedOption, scope)}
                style={{
                  textAlign: "left",
                  background: "#fff",
                  color: "var(--t1)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  padding: "7px 8px",
                  cursor: "pointer",
                  lineHeight: 1.35,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700 }}>{scope.label}</div>
                <div style={{ fontSize: 10, color: "var(--t3)" }}>{scope.hint}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 5, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 7, padding: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--t1)" }}>Otro alcance</div>
            <input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Ej: solo NEXA, cotizaciones pendientes, COT-EKA-2026-143, recursos materiales..."
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 8px", fontSize: 11 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customText.trim()) runOption(selectedOption, null, customText);
              }}
            />
            <button
              className="btn btn--primary btn--sm"
              style={{ justifySelf: "end", fontSize: 10 }}
              disabled={!customText.trim()}
              onClick={() => runOption(selectedOption, null, customText)}
            >
              Consultar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type RTMessageProps = {
  role: "gg" | "agent"; text: string; time: string; agentId?: string; modelLabel?: string; modelSuggestion?: string; isError?: boolean;
  attachments?: { name: string; size: number; type: string; dataUrl?: string }[];
  userEmail?: string; userName?: string; currentUserEmail?: string; status?: "pending" | "sent" | "failed";
  userDirectory?: UserDirectory;
  onMenuPrompt?: (prompt: string) => void;
};

const RTMessage = memo(function RTMessage({ role, text, time, agentId, modelLabel, modelSuggestion, isError, attachments, userEmail, userName, currentUserEmail, status, userDirectory, onMenuPrompt }: RTMessageProps) {
  const isUser = role === "gg";
  const agent = agentId ? agentById(agentId) : null;
  const isOwn = isUser && (!userEmail || userEmail === currentUserEmail);
  const senderLabel = userName || userEmail;
  const senderInitials = isUser ? (userEmail ? initialsFor(userName || userEmail, userEmail) : "GG") : (agentId || "").toUpperCase();
  const senderColor = isUser && userEmail ? colorForEmail(userEmail) : undefined;
  const menuAgentId = text.startsWith(AGENT_MENU_SENTINEL) ? text.slice(AGENT_MENU_SENTINEL.length).trim().toLowerCase() : "";
  return (
    <div style={{ display: "flex", gap: 9, flexDirection: isOwn ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <div
        className={`agent-avatar ${!isUser ? agentAvatarClass(agentId || "") : senderColor ? "" : "agent-avatar--gg"}`}
        style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0, ...(senderColor ? { background: senderColor, color: "#fff" } : {}) }}
        title={isUser ? senderLabel : undefined}
      >
        {senderInitials}
      </div>
      <div style={{ maxWidth: "80%" }}>
        {!isUser && agent && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{agent.name}</div>}
        {isUser && !isOwn && senderLabel && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{senderLabel}</div>}
        <div style={{
          padding: "8px 11px", borderRadius: 10,
          background: isError ? "var(--red-bg, #fff1f0)" : isOwn ? "var(--blue)" : "var(--bg-card)",
          color: isError ? "var(--red-text, #c00)" : isOwn ? "#fff" : "var(--t1)",
          border: isOwn ? "none" : `1px solid ${isError ? "var(--red-border, #fca5a5)" : "var(--border)"}`,
          fontSize: 12.5, lineHeight: 1.6, borderTopRightRadius: isOwn ? 3 : 10, borderTopLeftRadius: isOwn ? 10 : 3,
        }}>
          {attachments && attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: text ? 6 : 0 }}>
              {attachments.map((a) => <AttachmentChip key={a.name} a={a} />)}
            </div>
          )}
          {attachments?.some((a) => isHtmlAttachment(a) && a.dataUrl) && (
            <div style={{ display: "grid", gap: 8, marginBottom: text ? 8 : 0 }}>
              {attachments
                .filter((a) => isHtmlAttachment(a) && a.dataUrl)
                .map((a) => <HtmlAttachmentPreview key={`${a.name}-preview`} a={a} />)}
            </div>
          )}
          {menuAgentId
            ? <AgentMenuPanel agentId={menuAgentId} onPrompt={onMenuPrompt} />
            : <MdText text={text} variant={isOwn ? "inverted" : "default"} userDirectory={userDirectory} />}
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, display: "flex", gap: 6, alignItems: "center", justifyContent: isOwn ? "flex-end" : "flex-start" }}>
          <span>{time}</span>
          {modelLabel && !isUser && (
            <span style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>{modelLabel}</span>
          )}
          {isOwn && status === "pending" && <span title="Enviando…">⏳</span>}
          {isOwn && status === "failed" && (
            <span title="No se pudo sincronizar con los demás — se reintentará automáticamente" style={{ color: "var(--red-text, #c00)" }}>⚠ no sincronizado</span>
          )}
        </div>
        {modelSuggestion && !isUser && (
          <div style={{ fontSize: 10.5, color: "var(--amber-text)", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 6, padding: "4px 8px", marginTop: 4, lineHeight: 1.5 }}>
            💡 {modelSuggestion}
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  const menuMessage = prev.text.startsWith(AGENT_MENU_SENTINEL) || next.text.startsWith(AGENT_MENU_SENTINEL);
  return prev.role === next.role
    && prev.text === next.text
    && prev.time === next.time
    && prev.agentId === next.agentId
    && prev.modelLabel === next.modelLabel
    && prev.modelSuggestion === next.modelSuggestion
    && prev.isError === next.isError
    && prev.userEmail === next.userEmail
    && prev.userName === next.userName
    && prev.currentUserEmail === next.currentUserEmail
    && prev.status === next.status
    && prev.attachments === next.attachments
    && prev.userDirectory === next.userDirectory
    && (!menuMessage || prev.onMenuPrompt === next.onMenuPrompt);
});

// "Usuarios en la mesa": lightweight directory of approved users with
// online/away/offline status derived from the dedicated presence channel.
function UsersPanel({ users, presence, now, currentUserEmail }: {
  users: ApprovedUser[];
  presence: Map<string, RoomPresenceEntry>;
  now: number;
  currentUserEmail?: string;
}) {
  if (users.length === 0) {
    return <div style={{ fontSize: 11, color: "var(--t3)" }}>Sin usuarios aprobados.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {users.map((u) => {
        const status = presenceStatus(presence.get(u.email)?.lastActive, now);
        const dotColor = status === "online" ? "#16a34a" : status === "away" ? "#d97706" : "var(--t3)";
        const statusLabel = status === "online" ? "En línea" : status === "away" ? "Ausente" : "Desconectado";
        return (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="agent-avatar" style={{ width: 24, height: 24, fontSize: 9, background: colorForEmail(u.email), color: "#fff" }}>
              {initialsFor(u.fullName, u.email)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.fullName}{u.email === currentUserEmail ? " (tú)" : ""}
              </div>
              <div style={{ fontSize: 10, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.role || u.email}
              </div>
            </div>
            <span title={statusLabel} aria-label={statusLabel} style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          </div>
        );
      })}
    </div>
  );
}

function HandRaise({ agentId, modelLabel }: { agentId: string; modelLabel?: string }) {
  const agent = agentById(agentId);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)" }}>
      <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 26, height: 26, fontSize: 9 }}>{agentId.toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>✍️ {agent?.name || agentId} redactando…</div>
        {modelLabel && <div style={{ fontSize: 10, color: "var(--amber-text)", fontFamily: "var(--mono)" }}>{modelLabel}</div>}
      </div>
    </div>
  );
}

export function RoundtableView() {
  const { state, appendChat, chatFor, trimChatThread, notify } = useStore();
  const skills = useSkillsWithOverrides();
  const { session } = useSession(false);
  const { enabled: aiAssist, toggle: toggleAiAssist } = useAiAssist();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hands, setHands] = useState<{ agentId: string; modelLabel?: string }[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_MESSAGES_STEP);
  const [narrow, setNarrow] = useState(false);
  const [usersDrawerOpen, setUsersDrawerOpen] = useState(false);
  const [llmUsage, setLlmUsage] = useState<LlmUsageSnapshot>(() => loadLlmUsage());
  const scrollRef = useRef<HTMLDivElement>(null);

  const thread = chatFor(ROUNDTABLE_THREAD);
  const visibleThread = useMemo(() => thread.slice(-visibleCount), [thread, visibleCount]);
  const allProjects = [...PROJECTS, ...state.customProjects];

  const senderName = (session?.user.user_metadata?.full_name as string | undefined)
    || (session?.user.user_metadata?.name as string | undefined)
    || session?.email;

  const approvedUsers = useApprovedUsers();
  const { presence, now } = useRoomPresence(ROOM_PRESENCE_CHANNEL, session?.email, senderName);
  const llmUsageDisplay = useMemo(() => {
    const current = llmUsage.resetAt <= now ? { ...llmUsage, count: 0 } : llmUsage;
    const remaining = Math.max(0, LLM_WINDOW_LIMIT - current.count);
    return `IA: ${current.lastLabel} · aprox ${remaining}/${LLM_WINDOW_LIMIT} min`;
  }, [llmUsage, now]);

  function markLlmUse(label: string) {
    setLlmUsage((prev) => {
      const current = Date.now();
      const base = prev.resetAt <= current ? { count: 0, resetAt: current + LLM_WINDOW_MS, lastLabel: prev.lastLabel } : prev;
      const next = { count: Math.min(LLM_WINDOW_LIMIT, base.count + 1), resetAt: base.resetAt, lastLabel: label };
      saveLlmUsage(next);
      return next;
    });
  }

  // Directory used by parseMd/MdText to render "@FullName" mentions as chips.
  const userDirectory: UserDirectory = useMemo(() => {
    const map: UserDirectory = new Map();
    for (const u of approvedUsers) {
      if (!u.fullName) continue;
      map.set(slugForUser(u.fullName).toLowerCase(), { email: u.email, displayName: u.fullName });
    }
    return map;
  }, [approvedUsers]);

  // Suggestions for the @mention dropdown (excluding the current user).
  const mentionables = useMemo(() =>
    approvedUsers
      .filter((u) => u.fullName && u.email !== session?.email)
      .map((u) => ({ slug: slugForUser(u.fullName), displayName: u.fullName, email: u.email })),
    [approvedUsers, session?.email]
  );

  const currentUserSlug = useMemo(() => (senderName ? slugForUser(senderName).toLowerCase() : null), [senderName]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy, hands.length]);

  // The help panel renders at the top of the scroll container — scroll up to
  // reveal it instead of staying scrolled to the bottom of the thread.
  useEffect(() => {
    if (showHelp && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [showHelp]);

  useEffect(() => {
    function onResize() { setNarrow(window.innerWidth < NARROW_BREAKPOINT); }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Mention notifications (Req 4): scan synced messages for "@todos" or
  // "@<MyFullName>" not sent by the current user, and notify locally —
  // dedup persisted in localStorage so reloads don't re-notify.
  useEffect(() => {
    if (!session?.email || !currentUserSlug) return;
    const seen = loadNotifiedMentions();
    let changed = false;
    for (const m of thread) {
      if (m.role !== "gg" || m.userEmail === session.email) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      changed = true;
      const lower = (m.text || "").toLowerCase();
      const mentioned = lower.includes("@todos") || lower.includes(`@${currentUserSlug}`);
      if (mentioned) {
        notify({
          kind: "info",
          title: `${m.userName || m.userEmail || "Alguien"} te mencionó en Mesa de trabajo`,
          body: m.text.slice(0, 140),
          route: "/mesa-trabajo",
        });
      }
    }
    if (changed) saveNotifiedMentions(seen);
  }, [thread, session?.email, currentUserSlug, notify]);

  async function send(rawText?: string, inputCtx?: ChatCtx) {
    const raw = (rawText ?? input).trim();
    if (!raw || busy) return;

    const parsed = parseInput(raw);

    if (parsed.isHelp) {
      setShowHelp(true);
      setInput("");
      return;
    }

    // Context from ChatAutoInput chip overrides sidebar selector
    const ctxProject = inputCtx?.project ?? null;
    const ctxRequirement = inputCtx?.requirement ?? null;

    // Project context comes only from /proyecto (chip) or @PRY-xxx mentioned in the message
    const activeProject = ctxProject
      ?? (parsed.targetProjectId ? allProjects.find((p) => p.id === parsed.targetProjectId) ?? null : null);
    const userDisplay = raw;
    const attachmentMeta = (inputCtx?.attachments ?? []).map((f) => ({ name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl }));

    appendChat(ROUNDTABLE_THREAD, {
      role: "gg", text: userDisplay, attachments: attachmentMeta.length ? attachmentMeta : undefined,
      userEmail: session?.email, userName: senderName,
    });
    setInput("");

    if (AGENT_MENU_RE.test(raw)) {
      const activeAgentIds = AGENTS.filter((a) => a.type === "agent" && a.status === "active").map((a) => a.id);
      const menuTarget = parsed.targetAgentIds.find((id) => activeAgentIds.includes(id) && AGENT_QUICK_MENUS[id]) ?? "all";
      appendChat(ROUNDTABLE_THREAD, {
        role: "agent",
        agentId: menuTarget === "all" ? TEAM_COORDINATOR : menuTarget,
        text: `${AGENT_MENU_SENTINEL}${menuTarget}`,
        modelLabel: "menu",
      });
      return;
    }

    // Activation gate: the AI team only steps into Mesa de trabajo when
    // asked via a /command, when an @mention comes with a clear question or
    // instruction for that agent, or when the user has turned on
    // "IA: siempre". A bare @mention attached to a greeting/thanks/comment
    // ("Buenos días @gg", "Gracias @ic", "@gg estamos revisando esto") only
    // shows the visual mention — no agent reply.
    const aiCommand = raw.trim().match(AI_COMMAND_RE);
    if (NO_RESPONDER_RE.test(raw)) return;
    const continuation = isContinuationRequest(parsed.cleanText);
    // Any direct @mention of an agent (with some message content beyond the
    // mention itself) activates that agent only when there is a real question
    // or instruction. Greetings/thanks with @IC/@PM/@IE are human mentions only.
    const mentionWithIntent = parsed.targetAgentIds.length > 0 && hasClearIntent(parsed.cleanText);
    // "@todos" / "@equipo" with a real question or instruction (not just a
    // greeting) is answered by the team coordinator — a bare "@todos hola"
    // still doesn't trigger an AI reply, only the human notification.
    const teamWithIntent = parsed.targetAgentIds.length === 0
      && isTeamMessage(raw) && hasClearIntent(parsed.cleanText);
    const simpleCoordinatorGreeting = parsed.targetAgentIds.length === 0
      && !isTeamMessage(raw)
      && SOCIAL_GREETING_RE.test(parsed.cleanText.trim());
    const shouldRespond = !!aiCommand || continuation || mentionWithIntent || teamWithIntent || simpleCoordinatorGreeting || aiAssist;
    if (!shouldRespond) return;
    if (aiCommand) {
      parsed.cleanText = parsed.cleanText.replace(AI_COMMAND_RE, "").trim() || parsed.cleanText;
    }

    const htmlAttachments = (inputCtx?.attachments ?? []).filter(isHtmlAttachment);
    if (APP_DELIVERY_RE.test(parsed.cleanText) && htmlAttachments.length === 0) {
      const targetId = parsed.targetAgentIds.find((id) => AGENTS.some((a) => a.id === id && a.status === "active")) ?? "ti";
      appendChat(ROUNDTABLE_THREAD, {
        role: "agent",
        agentId: targetId,
        text: buildAppDeliveryGuidance(targetId),
        modelLabel: "sistema",
      });
      return;
    }

    setBusy(true);

    try {
    const hasAttachments = (inputCtx?.attachments?.length ?? 0) > 0;
    const coordinationRequested = COORDINATION_RE.test(raw)
      || /^\/(coordinar|coordinacion|coordinación)\b/i.test(raw.trim());
    const previousAgentId = continuation
      ? thread.slice().reverse().find((m) => m.role === "agent" && m.agentId)?.agentId
      : undefined;
    const baseResponders = continuation && previousAgentId
      ? [previousAgentId]
      : agentsForMessage(parsed.cleanText, parsed.targetAgentIds, hasAttachments);
    const responders = coordinationRequested && !continuation && !baseResponders.includes(TEAM_COORDINATOR)
      ? [TEAM_COORDINATOR, ...baseResponders.filter((id) => id !== TEAM_COORDINATOR)]
      : baseResponders;
    const routing = routeRequest(parsed.cleanText);
    const previousUserQuery = continuation
      ? thread.slice().reverse().find((m) => m.role === "gg" && m.text && !isContinuationRequest(m.text))?.text
      : undefined;
    const contextQueryText = continuation && previousUserQuery
      ? `${previousUserQuery}\n${parsed.cleanText}`
      : parsed.cleanText;
    const llmUserText = continuation && previousUserQuery
      ? `${parsed.cleanText}\n\nContinuacion de la consulta anterior del usuario: ${previousUserQuery}`
      : parsed.cleanText;

    // True when the message had no specific target/topic and routed solely
    // to the team coordinator — it should briefly point to the right
    // specialist instead of trying to cover every domain.
    const isCoordinatorRouting = parsed.targetAgentIds.length === 0
      && responders.length === 1 && responders[0] === TEAM_COORDINATOR
      && (isTeamMessage(parsed.cleanText) || isSimpleMessage(parsed.cleanText));

    const coordinatedMode = responders.includes(TEAM_COORDINATOR)
      && !continuation
      && coordinationRequested;
    const coordinationAgents = coordinatedMode ? agentsForCoordination(parsed.cleanText, parsed.targetAgentIds) : [];
    const handResponders = coordinatedMode
      ? [TEAM_COORDINATOR, ...coordinationAgents.filter((id) => id !== TEAM_COORDINATOR)]
      : responders;

    setHands(handResponders.map((id) => ({ agentId: id, modelLabel: routing.modelLabel })));

    // Recent conversation in Mesa de trabajo, shared by everyone in the
    // room. Passed as REAL chat turns (not flattened into the system
    // prompt) so the model treats it as the actual recent exchange when
    // resolving references like "a qué te refieres" — mirroring how
    // ChatGPT/Claude carry the live conversation in the message array.
    // Messages from other agents are included as "user" turns prefixed
    // with their name, so the responding agent can see what its
    // teammates said without mistaking it for its own prior replies.
    function buildThreadHistory(forAgentId: string): ChatMessage[] {
      return thread.slice(-10).flatMap((m): ChatMessage[] => {
        if (m.role === "gg") {
          const sender = m.userName || m.userEmail || "Usuario";
          const attNote = m.attachments?.length ? ` [adjuntó: ${m.attachments.map((a) => a.name).join(", ")}]` : "";
          const content = (m.text + attNote).trim();
          return content ? [{ role: "user", content: `${sender}: ${content}` }] : [];
        }
        if (!m.text) return [];
        if (m.agentId === forAgentId) return [{ role: "assistant", content: m.text }];
        const agentName = m.agentId ? agentById(m.agentId)?.name || m.agentId.toUpperCase() : "Agente";
        return [{ role: "user", content: `[${agentName} dijo]: ${m.text}` }];
      });
    }

    // Encourage natural, human conversation for casual/social messages
    // (jokes, small talk) while keeping the usual rigor for work topics.
    const toneCtx = `\n\nTono: si el mensaje del usuario es informal, una broma, comentario, pregunta general o charla casual (no relacionado a costos/cronograma/normas/proyectos), respóndele como lo haría un colega humano cercano: natural, cálido y breve, sin forzar negritas, listas ni tu formato técnico habitual. Cuando sí sea una consulta de trabajo, usa tu formato y expertise habitual.`;

    // Always-on snapshot of the user's own custom projects (if any), so any
    // agent has that context without an explicit project reference. Demo
    // data (PROJECTS/APPROVALS/ALERTS from lib/data.ts) is intentionally
    // excluded — see buildPlatformSummary for why.
    const platformCtx = buildPlatformSummary(state.customProjects);

    // Mesa de trabajo memory is shared across all users in the room (see
    // ROUNDTABLE_MEMORY_ID), so every agent learns from the whole team.
    const userId = ROUNDTABLE_MEMORY_ID;
    // A short message is only "simple" (greeting/no analysis) if the user
    // hasn't attached project/RQ context via chips, nor a file — otherwise
    // they want that context (or the file's content) used even if the
    // question itself is short.
    const simple = isSimpleMessage(parsed.cleanText) && !continuation && !ctxProject && !ctxRequirement && !hasAttachments;

    // Real-data context: detect intent → query Supabase → build the
    // "--- CONTEXTO REAL CONSULTADO ---" block. Centralized in
    // lib/chat/contextRouter (codes COT/RQ, historical codes, requerimiento/
    // cotización searches, recursos, propuestas técnicas). The pipeline never
    // throws — on a temporary error it returns a soft note instead of data.
    let autoCodeCtx = "";
    let deterministicAnswer: string | null = null;
    if (!simple) {
      const pipeline = await contextPipelineWithTimeout(contextQueryText);
      autoCodeCtx = pipeline.block;
      deterministicAnswer = buildDeterministicAnswerFromResults(contextQueryText, pipeline.results);
    }

    if (deterministicAnswer && !hasAttachments) {
      const agId = responders[0] ?? TEAM_COORDINATOR;
      const label = "supabase/direct";
      appendChat(ROUNDTABLE_THREAD, { role: "agent", agentId: agId, text: deterministicAnswer, modelLabel: label });
      saveConversation(userId, agId, parsed.cleanText, deterministicAnswer, label, routing.complexity, activeProject?.id).catch(() => {});
      recordAgentAnswerPerformance({
        agentId: agId,
        projectId: activeProject?.id,
        conversationScope: "roundtable",
        userMessage: contextQueryText,
        assistantResponse: deterministicAnswer,
        modelLabel: label,
        groundedInSupabase: true,
        proposedKnowledge: false,
        createdBy: session?.email ?? "roundtable",
      });
      setHands([]);
      setBusy(false);
      return;
    }

    // Item/material-level data for the referenced requirement (Supabase)
    let requirementItemsCtx = "";
    if (ctxRequirement && !simple) {
      const items = await fetchRequirementItems(ctxRequirement.id).catch(() => []);
      requirementItemsCtx = buildRequirementItemsPrompt(items);
    }

    const activeProjectCtx = activeProject && !simple
      ? `\n\nProyecto activo: **${activeProject.name}** (${activeProject.id}). Cliente: ${activeProject.client}. Estado: ${activeProject.status}. Avance: ${activeProject.progress}%. ${activeProject.summary}`
      : "";
    const activeRequirementCtx = ctxRequirement && !simple
      ? buildContextPrompt({ project: null, requirement: ctxRequirement }) + requirementItemsCtx
      : "";

    // File attachments from ChatAutoInput
    const fileCtx = (inputCtx?.attachments ?? []).map((f) =>
      `\n\n--- Archivo adjunto: ${f.name} (${Math.round(f.size / 1024)}KB) ---\n${f.content}\n---`
    ).join("");

    // Tell the agent how to read the "Archivo adjunto" block(s) appended to
    // the user's message, and how to react when extraction yielded little
    // or no usable text (scanned drawings, images, etc.) instead of
    // ignoring the attachment and replying with a generic greeting.
    const attachmentCtx = hasAttachments
      ? `\n\nEl usuario adjuntó ${attachmentMeta.length === 1 ? "un archivo" : `${attachmentMeta.length} archivos`} a este mensaje. Su contenido (texto extraído) viene al final, en bloques "--- Archivo adjunto: <nombre> ---". Básate en ese contenido para responder a lo que pregunta el usuario sobre el/los archivo(s) — NO respondas con un saludo genérico ni ignores el adjunto. Si el contenido extraído está vacío, es muy corto o dice "sin texto extraíble" (típico de planos/imágenes escaneadas), usa las páginas PDF renderizadas o imágenes del turno si existen. Si aun así no puedes leer etiquetas/símbolos, dilo explícitamente, indica qué archivo es (nombre) y pide un PDF vectorial, mayor resolución, leyenda o recorte de zona crítica. Para planos PDF/imagen y metrados, entrega una tabla con Item, Equipo/material, Símbolo/etiqueta visible, Cantidad, Ubicación/plano, Confianza y Observación; separa "observado" de "inferido" y no inventes cantidades. Si el archivo es HTML/HTM, léelo como código y documento técnico: revisa estructura, fórmulas, tablas, scripts, estilos, variables, riesgos y oportunidades de reutilización; NO ejecutes scripts ni inventes resultados que el HTML no muestre. Si el HTML adjunto trae dataUrl, la Mesa lo previsualiza automáticamente en un iframe seguro para que el usuario lo pruebe y lo descargue. Si el usuario pide generar, replicar o mejorar una versión, entrégala como bloque \`\`\`html-app completo y funcional, manteniendo un nivel visual y funcional comparable al adjunto. Si el usuario quiere que aprendas teoría/criterios de ese HTML, resume reglas útiles y pregunta qué debe quedar como criterio operativo. El archivo adjunto de este mensaje es la fuente principal: ignora archivos o documentos mencionados en historial previo salvo que el usuario los nombre explícitamente.`
      : "";
    const visionCtx = buildVisionAttachmentNote(inputCtx?.attachments ?? []);

    // When several agents respond to the same message, keep replies short
    // so the chat doesn't get flooded — each agent covers only its angle.
    const brevityCtx = responders.length > 1
      ? `\n\nVarios miembros del equipo responden a este mismo mensaje: sé MUY breve (1-3 líneas), enfócate solo en tu área y evita repetir lo que otros agentes ya cubrirían.`
      : `\n\nResponde de forma breve y concreta (máximo 4-5 líneas o una tabla corta), salvo que el usuario pida explícitamente un análisis extenso.`;

    // Coordinator routing: this agent should greet/acknowledge in 1-2 líneas
    // and point to the right specialist (@IC/@IE/etc.) using the responsibility matrix.
    const coordinatorCtx = isCoordinatorRouting
      ? `\n\nEste mensaje no tiene un tema específico ni va dirigido a un agente. Responde tú como coordinador humano en 1-3 líneas. Si es una pregunta general, conversa y ayuda sin derivar. Solo si el usuario pide algo claramente técnico, indica brevemente a quién más mencionar según sus responsabilidades:\n${Object.entries(AGENT_TOPICS).filter(([id]) => id !== TEAM_COORDINATOR).map(([id, topics]) => `- @${id.toUpperCase()}: ${topics}`).join("\n")}\nNo hace falta que los demás agentes intervengan ahora.`
      : "";

    async function runAgentTurn(agId: string, userContentText: string, extraSystemCtx = ""): Promise<{ content: string; label: string } | null> {
      const sysPrompt = RT_SYSTEM_PROMPTS[agId] ?? RT_SYSTEM_PROMPTS.ic;
      const skillsCtx = buildSkillsCtx(agId, skills);

      const supabaseHistory = simple || hasAttachments || !activeProject?.id
        ? []
        : await loadConversationHistory(userId, agId, activeProject.id, 6, CONVERSATION_MEMORY_DAYS).catch(() => []);
      const [agentMemories, approvedKnowledge] = simple
        ? [[], []]
        : await Promise.all([
            loadAgentMemories(agId, activeProject?.id, 6, OPERATIONAL_MEMORY_DAYS).catch(() => []),
            loadApprovedAgentKnowledge(agId, activeProject?.id, 6).catch(() => []),
          ]);
      const memoryCtx = buildAgentMemoryPrompt(agentMemories, approvedKnowledge);
      const agRouting = routeRequest(parsed.cleanText);

      const messages: ChatMessage[] = [
        { role: "system", content: sysPrompt + HUMANIZE_CTX + AGENT_LEARNING_CTX + GENERAL_CONVERSATION_CTX + HTML_APP_GENERATION_CTX + memoryCtx + skillsCtx + platformCtx + activeProjectCtx + activeRequirementCtx + autoCodeCtx + attachmentCtx + visionCtx + toneCtx + extraSystemCtx },
        ...supabaseHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ...(hasAttachments ? [] : buildThreadHistory(agId)),
        { role: "user", content: buildUserContentWithVision(userContentText + fileCtx, inputCtx?.attachments ?? []) },
      ];

      try {
        const { response, actualConfig } = await sendChatWithFallback(messages, agRouting.config, agRouting.complexity);
        const label = `${actualConfig.provider}/${response.model}`;
        markLlmUse(label);
        appendChat(ROUNDTABLE_THREAD, { role: "agent", agentId: agId, text: response.content, modelLabel: label, modelSuggestion: agRouting.suggestion });
        saveConversation(userId, agId, parsed.cleanText + fileCtx, response.content, label, agRouting.complexity, activeProject?.id).catch(() => {});
        let proposedKnowledge = false;
        if (!simple) {
          const memory = buildMemoryCandidate(agId, parsed.cleanText, response.content, agRouting.complexity, "roundtable");
          if (memory) {
            saveAgentMemory(agId, memory.content, memory.memoryType, activeProject?.id, memory.importance).catch(() => {});
            if (memory.proposeKnowledge) {
              proposedKnowledge = true;
              proposeAgentKnowledge(agId, memory.content, activeProject?.id, memory.importance, session?.email ?? "roundtable").catch(() => {});
            }
          }
        }
        recordAgentAnswerPerformance({
          agentId: agId,
          projectId: activeProject?.id,
          conversationScope: "roundtable",
          userMessage: parsed.cleanText,
          assistantResponse: response.content,
          modelLabel: label,
          groundedInSupabase: autoCodeCtx.includes("--- CONTEXTO REAL CONSULTADO ---"),
          proposedKnowledge,
          createdBy: session?.email ?? "roundtable",
        });
        return { content: response.content, label };
      } catch (err) {
        appendChat(ROUNDTABLE_THREAD, {
          role: "agent", agentId: agId,
          text: mesaProviderErrorMessage(err),
          isError: true,
        });
        return null;
      }
    }

    if (coordinatedMode && coordinationAgents.length > 0) {
      const coordinationBrief = `\n\nModo coordinación entre agentes:
- El PM lidera una ronda corta para llegar al objetivo del usuario.
- Primero define objetivo, riesgos y asignaciones concretas.
- Cada especialista responde una sola vez desde su dominio, usando solo datos reales/contexto disponible.
- El PM cierra con acuerdos, responsables, pendientes y próximo paso.
- No mantengas una conversación infinita entre agentes; si falta un dato crítico, dilo y pide ese dato al usuario.`;
      const specialistBrief = `\n\nRonda coordinada: responde al encargo del PM en máximo 5 líneas o una tabla corta. No repitas lo ya dicho; aporta desde tu especialidad. Si no hay datos suficientes, indica exactamente qué dato falta.`;
      const pmCloseBrief = `\n\nCierre de coordinación: sintetiza los aportes del equipo en una tabla corta con Acción, Responsable, Evidencia/Dato usado y Próximo paso. No inventes datos ni responsables no mencionados.`;

      const pmPlan = await runAgentTurn(
        TEAM_COORDINATOR,
        `${llmUserText}\n\nCoordina una ronda con estos agentes: ${coordinationAgents.map((id) => `@${id.toUpperCase()}`).join(" ")}.`,
        coordinationBrief
      );

      const specialistResults: { agentId: string; content: string }[] = [];
      if (pmPlan) {
        for (const agId of coordinationAgents) {
          const agentName = agentById(agId)?.name ?? agId.toUpperCase();
          const result = await runAgentTurn(
            agId,
            `${llmUserText}\n\nEncargo del PM:\n${pmPlan.content}\n\n${agentName}, responde solo tu parte para avanzar hacia el objetivo.`,
            specialistBrief
          );
          if (result) specialistResults.push({ agentId: agId, content: result.content });
          setHands((h) => h.filter((x) => x.agentId !== agId));
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (pmPlan && specialistResults.length > 0) {
        const summary = specialistResults
          .map((r) => `@${r.agentId.toUpperCase()}:\n${r.content}`)
          .join("\n\n");
        await runAgentTurn(
          TEAM_COORDINATOR,
          `${llmUserText}\n\nAportes del equipo:\n${summary}\n\nCierra la coordinación con acuerdos y próximos pasos.`,
          pmCloseBrief
        );
      }

      setHands([]);
      setBusy(false);
      return;
    }

    const agentOutputs: { agentId: string; content: string }[] = [];

    for (const agId of responders) {
      const sysPrompt = RT_SYSTEM_PROMPTS[agId] ?? RT_SYSTEM_PROMPTS.ic;
      const skillsCtx = buildSkillsCtx(agId, skills);

      // Long-term memory from Supabase for this agent: only loaded when
      // there's an active project, and scoped to it — otherwise it tends
      // to surface old, unrelated conversations (different topic/project)
      // right before the current message, confusing the model into
      // anchoring on stale context instead of the live conversation.
      const supabaseHistory = simple || hasAttachments || !activeProject?.id
        ? []
        : await loadConversationHistory(userId, agId, activeProject.id, 6, CONVERSATION_MEMORY_DAYS).catch(() => []);
      const [agentMemories, approvedKnowledge] = simple
        ? [[], []]
        : await Promise.all([
            loadAgentMemories(agId, activeProject?.id, 6, OPERATIONAL_MEMORY_DAYS).catch(() => []),
            loadApprovedAgentKnowledge(agId, activeProject?.id, 6).catch(() => []),
          ]);
      const memoryCtx = buildAgentMemoryPrompt(agentMemories, approvedKnowledge);

      const messages: ChatMessage[] = [
        { role: "system", content: sysPrompt + HUMANIZE_CTX + AGENT_LEARNING_CTX + GENERAL_CONVERSATION_CTX + HTML_APP_GENERATION_CTX + memoryCtx + skillsCtx + platformCtx + activeProjectCtx + activeRequirementCtx + autoCodeCtx + attachmentCtx + visionCtx + toneCtx + brevityCtx + coordinatorCtx },
        ...supabaseHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ...(hasAttachments ? [] : buildThreadHistory(agId)),
        { role: "user", content: buildUserContentWithVision(llmUserText + fileCtx, inputCtx?.attachments ?? []) },
      ];

      const agRouting = routeRequest(parsed.cleanText);

      try {
        const { response, actualConfig } = await sendChatWithFallback(messages, agRouting.config, agRouting.complexity);
        const label = `${actualConfig.provider}/${response.model}`;
        markLlmUse(label);
        appendChat(ROUNDTABLE_THREAD, { role: "agent", agentId: agId, text: response.content, modelLabel: label, modelSuggestion: agRouting.suggestion });
        agentOutputs.push({ agentId: agId, content: response.content });
        saveConversation(userId, agId, parsed.cleanText + fileCtx, response.content, label, agRouting.complexity, activeProject?.id).catch(() => {});
        let proposedKnowledge = false;
        if (!simple) {
          const memory = buildMemoryCandidate(agId, parsed.cleanText, response.content, agRouting.complexity, "roundtable");
          if (memory) {
            saveAgentMemory(agId, memory.content, memory.memoryType, activeProject?.id, memory.importance).catch(() => {});
            if (memory.proposeKnowledge) {
              proposedKnowledge = true;
              proposeAgentKnowledge(agId, memory.content, activeProject?.id, memory.importance, session?.email ?? "roundtable").catch(() => {});
            }
          }
        }
        recordAgentAnswerPerformance({
          agentId: agId,
          projectId: activeProject?.id,
          conversationScope: "roundtable",
          userMessage: parsed.cleanText,
          assistantResponse: response.content,
          modelLabel: label,
          groundedInSupabase: autoCodeCtx.includes("--- CONTEXTO REAL CONSULTADO ---"),
          proposedKnowledge,
          createdBy: session?.email ?? "roundtable",
        });
      } catch (err) {
        appendChat(ROUNDTABLE_THREAD, {
          role: "agent", agentId: agId,
          text: mesaProviderErrorMessage(err),
          isError: true,
        });
      }

      setHands((h) => h.filter((x) => x.agentId !== agId));
      await new Promise((r) => setTimeout(r, 200));
    }

    const followupTargets: { targetId: string; requesterId: string; requesterContent: string }[] = [];
    for (const output of agentOutputs) {
      const exclude = new Set([...responders, output.agentId, ...followupTargets.map((f) => f.targetId)]);
      const mentioned = extractAgentFollowups(output.content, exclude);
      for (const targetId of mentioned) {
        followupTargets.push({ targetId, requesterId: output.agentId, requesterContent: output.content });
        if (followupTargets.length >= MAX_AGENT_FOLLOWUPS) break;
      }
      if (followupTargets.length >= MAX_AGENT_FOLLOWUPS) break;
    }

    if (followupTargets.length > 0) {
      const followupBrief = `\n\nRespuesta breve entre agentes:
- Otro agente te mencionó para afinar la respuesta al usuario. Responde solo si puedes aportar desde tu especialidad.
- Máximo 4 líneas o una tabla muy corta.
- No abras una nueva ronda ni menciones a otro agente salvo que sea crítico.
- Si falta un dato, pide ese dato exacto. No inventes registros.`;
      for (const item of followupTargets) {
        setHands((h) => [...h, { agentId: item.targetId, modelLabel: routing.modelLabel }]);
        const requesterName = agentById(item.requesterId)?.name ?? item.requesterId.toUpperCase();
        await runAgentTurn(
          item.targetId,
          `${llmUserText}\n\n${requesterName} te mencionó en su respuesta:\n${item.requesterContent}\n\nResponde en breve para afinar la consulta del usuario.`,
          followupBrief
        );
        setHands((h) => h.filter((x) => x.agentId !== item.targetId));
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    } catch (err) {
      appendChat(ROUNDTABLE_THREAD, {
        role: "agent",
        agentId: TEAM_COORDINATOR,
        text: mesaProviderErrorMessage(err),
        isError: true,
      });
    } finally {
      setHands([]);
      setBusy(false);
    }
  }

  function clearMesaView() {
    const ok = window.confirm(
      `Esto limpiará la vista de la Mesa y conservará solo los últimos ${CLEAR_VIEW_KEEP_MESSAGES} mensajes visibles. La memoria de los agentes y el contexto aprendido no se borran.`
    );
    if (!ok) return;
    trimChatThread(ROUNDTABLE_THREAD, CLEAR_VIEW_KEEP_MESSAGES);
    setVisibleCount(VISIBLE_MESSAGES_STEP);
    appendChat(ROUNDTABLE_THREAD, {
      role: "agent",
      agentId: TEAM_COORDINATOR,
      text: `Vista de Mesa limpiada: se conservaron los últimos ${CLEAR_VIEW_KEEP_MESSAGES} mensajes visibles. La memoria de agentes y aprendizajes no fue eliminada.`,
      modelLabel: "sistema",
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Mesa de trabajo"
        title="Discusión coordinada con tu equipo IA"
        description="Plantea un tema — los agentes responden según su dominio. Usa @IC, @PM, @IE, @CD, @TI o /menu para consultas rápidas."
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span
              className="badge"
              title="Indicador local aproximado: cuenta respuestas IA de esta ventana en el último minuto. No representa la cuota real del proveedor."
              style={{ background: "var(--bg-subtle)", color: "var(--t2)", border: "1px solid var(--border)" }}
            >
              {llmUsageDisplay}
            </span>
            <span className="badge badge--green badge--dot">IA activa</span>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "230px 1fr" : "230px 1fr 230px", gap: 10, alignItems: "start" }}>
        <div className="space-y-2">
          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Equipo en la mesa</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {AGENTS.filter((a) => a.id !== "gg").map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className={`agent-avatar ${agentAvatarClass(a.id)}`} style={{ width: 24, height: 24, fontSize: 9 }}>{a.id.toUpperCase()}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: a.status === "active" ? "var(--green-text)" : a.status === "needs-approval" ? "var(--amber-text)" : "var(--t3)" }}>
                      {a.status === "active" ? "● Activo" : a.status === "needs-approval" ? "⚠ Pendiente" : "○ Futuro"}
                    </div>
                  </div>
                  {a.status === "active" && (
                    <button className="btn btn--ghost btn--sm" style={{ fontSize: 9, padding: "2px 6px" }} onClick={() => setInput(`@${a.id.toUpperCase()} `)}>
                      @
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 190px)", minHeight: 420 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className="agent-avatar agent-avatar--gg">GG</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Mesa de trabajo</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>Usa /proyecto o /rq para referenciar un caso</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="badge badge--green">IA activa</span>
              <span
                className="badge"
                title="Uso aproximado en esta ventana: no es cuota real de OpenAI/Gemini/etc."
                style={{ background: "var(--bg-subtle)", color: "var(--t2)", border: "1px solid var(--border)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {llmUsageDisplay}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 10, color: aiAssist ? "var(--blue)" : "var(--t3)" }}
                title={aiAssist
                  ? "La IA responde a cada mensaje — click para que solo responda si la mencionas (@IC/@PM/@IE) o usas /ia, /resumen, /pendientes, /consulta, /rfi"
                  : "La IA solo responde si la mencionas (@IC/@PM/@IE) o usas /ia, /resumen, /pendientes, /consulta, /rfi — click para que responda siempre"}
                onClick={toggleAiAssist}
              >
                {aiAssist ? "🤖 IA: siempre" : "🤖 IA: por mención"}
              </button>
              <button className="btn btn--ghost btn--sm" style={{ fontSize: 11 }} onClick={() => setShowHelp((v) => !v)}>
                /ayuda
              </button>
              <button
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 11 }}
                title="Limpia mensajes antiguos de la vista sin borrar la memoria de los agentes"
                onClick={clearMesaView}
              >
                Limpiar vista
              </button>
              {narrow && (
                <button className="btn btn--ghost btn--sm" style={{ fontSize: 11 }} onClick={() => setUsersDrawerOpen(true)}>
                  👥 Usuarios
                </button>
              )}
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "var(--bg-muted)" }}>
            {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

            {thread.length === 0 && !showHelp && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 380 }}>
                <div className="agent-avatar agent-avatar--gg" style={{ width: 48, height: 48, fontSize: 16, margin: "0 auto 12px" }}>GG</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Convoca a tu equipo</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
                  Escribe cualquier pregunta. Los agentes activos responden según su especialidad. Usa <strong>/menu</strong> para consultas rápidas o <strong>/ayuda</strong> para ver comandos.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {[
                    "Buenos días equipo",
                    "@IC ¿cuál es la desviación en @PRY-001?",
                    "@PM ¿qué riesgos tiene el cronograma?",
                    "@IC /menu",
                    "@CD /menu",
                    "¿Qué norma aplica a la SET 138kV?",
                    "Estado del portafolio de proyectos",
                  ].map((s) => (
                    <button key={s} className="btn btn--ghost btn--sm" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {thread.length > visibleCount && (
              <button
                className="btn btn--ghost btn--sm"
                style={{ alignSelf: "center" }}
                onClick={() => setVisibleCount((v) => v + VISIBLE_MESSAGES_STEP)}
              >
                Cargar mensajes anteriores ({thread.length - visibleCount} más)
              </button>
            )}
            {visibleThread.map((m) => (
              <RTMessage key={m.id} role={m.role} text={m.text} time={m.time} agentId={m.agentId} modelLabel={m.modelLabel} modelSuggestion={m.modelSuggestion} isError={m.isError} attachments={m.attachments} userEmail={m.userEmail} userName={m.userName} currentUserEmail={session?.email} status={m.status} userDirectory={userDirectory} onMenuPrompt={(prompt) => send(prompt)} />
            ))}
            {hands.map((h) => (
              <HandRaise key={h.agentId} agentId={h.agentId} modelLabel={h.modelLabel} />
            ))}
          </div>

          <div style={{ flexShrink: 0, padding: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[
                { label: "@IC", title: "Ing. Costos", color: "#2563eb" },
                { label: "@PM", title: "Proj. Manager", color: "#7c3aed" },
                { label: "@IE", title: "Ing. Eléctrico", color: "#0891b2" },
                { label: "@CD", title: "Control Documentario", color: "#0f766e" },
                { label: "@TI", title: "Ing. Sistemas", color: "#475569" },
              ].map((a) => (
                <button key={a.label} title={a.title} style={{ background: "#fff", border: `1px solid ${a.color}`, color: a.color, borderRadius: 4, padding: "2px 8px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" }} onClick={() => setInput((v) => (v.startsWith("@") ? v : a.label + " "))}>
                  {a.label}
                </button>
              ))}
              <button style={{ fontSize: 10, color: "var(--t3)", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }} onClick={() => setShowHelp(true)}>
                /ayuda
              </button>
              <button style={{ fontSize: 10, color: "var(--t3)", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }} onClick={() => send("/menu")}>
                /menu
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <ChatAutoInput
                value={input}
                onChange={setInput}
                onSubmit={(text, ctx) => send(text, ctx)}
                placeholder={aiAssist ? "Escribe… @IC /menu /proyecto /rq /ayuda" : "Escribe… usa @IC/@PM/@IE/@CD/@TI o /ia para que el equipo IA responda"}
                disabled={busy}
                mentionables={mentionables}
              />
            </div>
          </div>
        </div>

        {!narrow && (
          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Usuarios en la mesa</div>
            <UsersPanel users={approvedUsers} presence={presence} now={now} currentUserEmail={session?.email} />
          </div>
        )}
      </div>

      {narrow && usersDrawerOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setUsersDrawerOpen(false)}
        >
          <div
            className="card"
            style={{ width: 260, maxWidth: "85vw", height: "100%", borderRadius: 0, padding: 12, overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)" }}>Usuarios en la mesa</div>
              <button className="btn btn--ghost btn--sm" onClick={() => setUsersDrawerOpen(false)}>×</button>
            </div>
            <UsersPanel users={approvedUsers} presence={presence} now={now} currentUserEmail={session?.email} />
          </div>
        </div>
      )}
    </>
  );
}
