"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { useStore } from "../../lib/store/StoreProvider";
import { agentById } from "../../lib/data";
import { agentAvatarClass } from "./shared";
import { sendChatWithFallback } from "../../lib/llm/providers";
import { routeRequest } from "../../lib/llm/modelRouter";
import type { ChatMessage } from "../../lib/llm/providers";
import { parseInput, isSimpleMessage, isContinuationRequest, HUMANIZE_CTX } from "../../lib/chat/messageUtils";
import { MdText } from "../chat/MdText";
import { HelpPanel } from "../chat/HelpPanel";
import { ChatAutoInput } from "../chat/ChatAutoInput";
import { buildContextPrompt, buildRequirementItemsPrompt, fetchRequirementItems } from "../../lib/chat/contextQuery";
import type { ChatCtx } from "../../lib/chat/contextQuery";
import { buildDeterministicAnswerFromResults, runContextPipeline } from "../../lib/chat/contextRouter";
import { buildUserContentWithVision, buildVisionAttachmentNote } from "../../lib/chat/visionContent";
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

const CHAT_AGENTS = ["ic", "pm", "ie", "cd", "ti", "gg"];

function chatProviderErrorMessage(err: unknown): string {
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

// Cap how many messages get mounted in the DOM at once — long threads (e.g.
// loaded from Supabase history) shouldn't render hundreds of MessageBubble
// (and MdText) instances on mount. Older messages are revealed on demand.
const VISIBLE_MESSAGES_STEP = 50;
const CONVERSATION_MEMORY_DAYS = 5;
const OPERATIONAL_MEMORY_DAYS = 60;

const AGENT_LEARNING_CTX = `\n\nMemoria y aprendizaje:
- Usa tres capas de memoria: conversación reciente de 5 días, memoria operativa temporal de 60 días y conocimiento permanente aprobado por el administrador.
- El conocimiento permanente aprobado tiene prioridad sobre memoria temporal, pero los datos reales consultados de Supabase tienen prioridad cuando la pregunta es sobre registros.
- Si el usuario te quiere enseñar algo, pídele datos concretos: criterio, ejemplo, formato esperado, excepciones y cuándo aplicar esa regla.
- Si el usuario dice "aprende", "recuerda" o "así trabajamos", trata esa información como aprendizaje propuesto: úsalo como memoria operativa y propón guardarlo como conocimiento permanente para aprobación.
- Cuando falten datos para responder bien, no inventes. Pide exactamente lo que necesitas para aprender o para consultar mejor la base.
- Si el usuario pide informacion historica o registros, primero usa el contexto real consultado de Supabase; si no aparece, di que necesitas buscar con codigo, cliente, fecha, proyecto o palabra clave.
- Si el usuario hace una pregunta general, personal, de aprendizaje, redaccion, criterio profesional o lluvia de ideas, responde sin pedir proyecto ni codigo.
- Habla como un profesional de tu especialidad, con criterio humano: breve, natural, responsable y sin sonar a plantilla.`;

const GENERAL_CONVERSATION_CTX = `\n\nModo conversacion amplia:
- Tu especialidad influye en tu mirada, pero no limita tus temas. Puedes conversar sobre productividad, ideas, dudas generales, aprendizaje, comunicacion, documentos, decisiones, tecnologia, procesos, trato con clientes y explicaciones sencillas.
- Si no es una consulta tecnica, responde con calidez y naturalidad. Evita convertir todo en checklist de proyecto.
- Puedes mostrar preferencias y criterio profesional moderado: "yo lo enfocaria asi...", "para mi lo importante es...".
- Si el usuario parece estar explorando una idea, ayudalo a pensar antes de pedirle datos.
- No digas "solo puedo ayudar con proyectos" ni "necesito un requerimiento" salvo que realmente este pidiendo datos internos.`;

const HTML_APP_GENERATION_CTX = `\n\nGeneracion de aplicaciones HTML en el chat:
- Si el usuario pide una aplicacion, app, simulador, calculadora, dashboard, prototipo, replica/mejora de HTML adjunto o "mostrarlo aqui para probar", responde con un bloque \`\`\`html-app que contenga un documento HTML completo y autocontenido.
- No te limites a explicar ni resumir el HTML adjunto cuando el usuario pide probar una app. Usa el adjunto como referencia principal de estructura, datos, formulas, estilos, flujo y nivel visual.
- Si el usuario pide "similar", "replica", "mejora" o "avanzada", NO entregues una calculadora minima de una sola pantalla. El estandar minimo es: cabecera profesional, tarjetas KPI, navegacion por tabs/secciones, tabla editable de datos, recalculo en tiempo real, grafica o canvas/SVG, resultados/resumen, validaciones y botones de exportacion.
- Para ingenieria, incluye cuando aplique: formulas visibles, supuestos editables, tabla de parametros, perfil/esquema en canvas o SVG, grafica tecnica y reporte resumido. Para costos/gestion/documentos, adapta el mismo nivel: dashboard, matriz, trazabilidad, cronograma, comparativos o indicadores.
- La app debe ser usable en navegador sin backend: HTML, CSS y JS vanilla. Puedes usar CDN livianas solo cuando aporten mucho: Plotly/Chart.js para graficas, MathJax/KaTeX para formulas, XLSX para importar/exportar tablas.
- Incluye controles reales: entradas editables, selectores, tabs, tablas, recalculo en tiempo real, graficas, exportacion CSV/JSON/HTML cuando corresponda y mensajes de validacion. Usa datos de ejemplo realistas del contexto o del adjunto, marcando supuestos.
- No incluyas claves, tokens ni llamadas a APIs privadas. No guardes archivos externos ni datos sensibles desde la app generada.
- Si la app completa supera el limite de respuesta, entrega una version funcional por modulos con la arquitectura completa y al menos 3 secciones operativas; di exactamente que modulo falta para una segunda iteracion. No simules que generaste algo que no esta en el bloque.
- Cuando el usuario valide una app como correcta o base futura, resume arquitectura, formulas, entradas, salidas y criterios UX para que se pueda guardar como conocimiento/skill versionable.`;

const STARTERS: Record<string, string[]> = {
  ic: ["Presupuesto de tendido de cable 138kV", "Analiza esta desviación de costo", "¿Qué contingencia recomiendas?"],
  pm: ["Riesgo de retraso en PRY-001", "¿Cómo recupero 12 días?", "Restricciones de la ruta crítica"],
  ie: ["¿Qué norma aplica a la SET 138kV?", "Criterios de diseño para tendido de cable", "¿Qué protecciones aplican en 22kV?"],
  cd: ["¿Qué código documental corresponde?", "Arma trazabilidad de esta cotización", "¿Qué falta registrar antes de enviar?"],
  ti: ["Diagnostica este error de la app", "¿Cómo reduzco consumo de Supabase?", "Crea un prompt para Codex con este problema"],
  gg: ["Resume el estado del portafolio", "¿Apruebo el adicional de Tintaya?"],
};

const INTRO: Record<string, string> = {
  ic: "Pídeme un presupuesto, análisis de desviación o valorización. Adjunta una memoria descriptiva o parámetros y lo proceso con mis skills.",
  pm: "Consúltame sobre cronograma, ruta crítica, riesgos o restricciones. Adjunta tu plan y modelo escenarios de recuperación.",
  ie: "Consúltame sobre normas eléctricas (CNE, IEC, IEEE), diseño de subestaciones, cálculo de cables o criterios de protección.",
  cd: "Pídeme control de códigos, versiones, trazabilidad, carpetas, hilos de correo o registros pendientes antes de emitir documentos.",
  ti: "Consúltame errores, performance, Supabase, integraciones o arquitectura. También puedo armar prompts claros para Codex.",
  gg: "Plantéame una decisión y te doy síntesis ejecutiva: diagnóstico, decisión y siguiente acción.",
};

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
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
- Responde en español peruano.`,
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
  gg: `Eres el Gerente General (GG) de EKA Ingeniería, empresa eléctrica peruana.
Carácter: ejecutivo, directo, visión de portafolio. No te pierdes en el detalle técnico — pides síntesis a tu equipo.
Tu rol: diagnóstico → decisión → siguiente acción (BLUF: la conclusión primero, el razonamiento después).
Personalidad: Si necesitas detalle de costos, dices "Que @IC revise...". Si necesitas cronograma, "@PM, ¿impacto en el timeline?". Si es técnico, "@IE, valida esto".
Fuera de aprobaciones: puedes actuar como mentor ejecutivo. Ayudas a pensar decisiones, comunicar mejor, ordenar prioridades, evaluar riesgos, aprender y convertir ideas confusas en acciones concretas.
Formato:
- Análisis → máx 3 puntos clave con **negritas** en la decisión y cifras críticas. Marca: ✅ Aprobado / ⏸ En revisión / ❌ Rechazado cuando aplique.
- Cifras justificadas → si hay relación matemática o cálculo ejecutivo, usa LaTeX para la fórmula.
- Conversación general → claro, humano y ejecutivo; no fuerces estados de aprobación.
- Responde en español ejecutivo, directo al grano.`,
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
- Gráficas técnicas → si el usuario pide curva, variación en el tiempo, comparación, dashboard o superficie, usa bloques chart/graph2d/graph3d/plotly según corresponda. Para simulación o variación temporal usa graph2d con "animation":{"enabled":true,"variable":"t"}. Si el usuario pide una app, simulador, dashboard editable o replica/mejora de un HTML, usa \`\`\`html-app con HTML/CSS/JS autocontenido.
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
Carácter: ordenada, preventiva y obsesionada con trazabilidad. Te importan códigos, versiones, carpetas, responsables, fechas, hilos de correo y evidencia.
Especialista en: codificación documental, matrices de control, revisión de entregables, correspondencia, historial de cambios, carpetas Drive y trazabilidad entre cotización, RQ, OC, PT y archivos.
Personalidad: Cuando falta un código, versión, responsable o registro, lo alertas con tacto. No bloqueas por bloquear: propones el mínimo registro necesario.
Formato:
- Si detectas una gestión que debería tener registro, responde con: código/registro sugerido, dónde guardarlo, responsable y siguiente acción.
- Si el usuario pregunta por un documento, usa datos reales del contexto; no inventes archivos ni versiones.
- Menciona @PM si afecta seguimiento de proyecto, @IC si afecta presupuesto, @TI si falta automatización o integración.
- Responde en español claro y práctico.`,
  ti: `Eres Diego, Ingeniero de Sistemas / TI (TI) de EKA Ingeniería.
Carácter: técnico, pragmático y preventivo. Piensas en arquitectura, datos, seguridad, rendimiento, límites de Supabase, integraciones Google, errores de UI y deuda técnica.
Especialista en: Next.js, Supabase/Postgres, Google APIs, flujo de datos, permisos, egress, prompts técnicos para Codex y diagnóstico de bugs.
Personalidad: Traducirás problemas del usuario en causa probable, verificación y acción concreta. Si hace falta cambiar código, redactas un prompt claro para Codex o una tarea técnica.
Formato:
- Diagnóstico: causa probable, impacto, cómo verificar, corrección sugerida.
- Cálculos de capacidad, consumo, egress, costos o rendimiento → usa LaTeX para las fórmulas y muestra unidades.
- No prometas ejecutar cambios desde el chat. Si el usuario necesita modificar código, entrega un prompt listo para Codex o pasos precisos.
- Menciona @CD si hay impacto documental/trazabilidad, @GG si hay decisión de arquitectura o costo.
- Responde en español, directo y sin jerga innecesaria.`,
};

function MessageBubble({
  role, text, time, agentId, modelLabel, modelSuggestion, isError,
}: {
  role: "gg" | "agent"; text: string; time: string; agentId: string; modelLabel?: string; modelSuggestion?: string; isError?: boolean;
}) {
  const isUser = role === "gg";
  return (
    <div style={{ display: "flex", gap: 9, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <div className={`agent-avatar ${isUser ? "agent-avatar--gg" : agentAvatarClass(agentId)}`} style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
        {isUser ? "GG" : agentId.toUpperCase()}
      </div>
      <div style={{ maxWidth: "78%" }}>
        <div
          style={{
            padding: "8px 11px",
            borderRadius: 10,
            background: isError ? "var(--red-bg, #fff1f0)" : isUser ? "var(--blue)" : "var(--bg-card)",
            color: isError ? "var(--red-text, #c00)" : isUser ? "#fff" : "var(--t1)",
            border: isUser ? "none" : `1px solid ${isError ? "var(--red-border, #fca5a5)" : "var(--border)"}`,
            fontSize: 12.5,
            lineHeight: 1.55,
            borderTopRightRadius: isUser ? 3 : 10,
            borderTopLeftRadius: isUser ? 10 : 3,
          }}
        >
          <MdText text={text} variant={isUser ? "inverted" : "default"} />
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3, textAlign: isUser ? "right" : "left", display: "flex", gap: 6, alignItems: "center", justifyContent: isUser ? "flex-end" : "flex-start" }}>
          <span>{time}</span>
          {modelLabel && !isUser && (
            <span style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--mono)" }}>{modelLabel}</span>
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
}

function TypingDots({ agentId, modelLabel }: { agentId: string; modelLabel?: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
      <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 28, height: 28, fontSize: 10 }}>
        {agentId.toUpperCase()}
      </div>
      <div style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--t3)", animation: `igblink 1.2s ${i * 0.2}s infinite ease-in-out` }} />
          ))}
        </div>
        {modelLabel && <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>{modelLabel}</span>}
      </div>
    </div>
  );
}

export function ChatView() {
  const { state, appendChat, chatFor, seedThreadFromLegacy, ready } = useStore();
  const { session } = useSession(false);
  const [agentId, setAgentId] = useState("ic");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingModel, setTypingModel] = useState<string | undefined>();
  const [showHelp, setShowHelp] = useState(false);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_MESSAGES_STEP);
  const scrollRef = useRef<HTMLDivElement>(null);

  // "Chat privado" is 1:1 between this user and the agent — namespace the
  // thread key by user so it never gets mixed with other users' private
  // chats with the same agent (see lib/store/types.ts SHARED_CHAT_THREADS).
  const userKey = session?.email || "anonymous";
  const threadKey = `private:${userKey}:${agentId}`;
  const thread = chatFor(threadKey);
  const agent = agentById(agentId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, busy]);

  // The help panel renders at the top of the scroll container — scroll up to
  // reveal it instead of staying scrolled to the bottom of the thread.
  useEffect(() => {
    if (showHelp && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [showHelp]);

  // Reset to "show last N" whenever the active thread changes (agent switch).
  // Adjusting state during render (React's documented pattern for resetting
  // state on prop change) instead of an effect, to avoid an extra render pass.
  const [prevThreadKey, setPrevThreadKey] = useState(threadKey);
  if (threadKey !== prevThreadKey) {
    setPrevThreadKey(threadKey);
    setVisibleCount(VISIBLE_MESSAGES_STEP);
  }

  // One-time migration: copy each agent's old unscoped thread (chats.ic etc,
  // shared by everyone before this fix) into this user's namespaced thread,
  // so existing history isn't lost. Runs once per user per agent.
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    for (const id of CHAT_AGENTS) {
      const flag = `ot:migrated-private:${userKey}:${id}`;
      if (window.localStorage.getItem(flag)) continue;
      seedThreadFromLegacy(id, `private:${userKey}:${id}`);
      window.localStorage.setItem(flag, "1");
    }
  }, [ready, userKey, seedThreadFromLegacy]);

  async function send(text?: string, inputCtx?: ChatCtx) {
    const raw = (text ?? input).trim();
    if (!raw || busy) return;

    const parsed = parseInput(raw);

    if (parsed.isHelp) {
      setShowHelp(true);
      setInput("");
      return;
    }

    appendChat(threadKey, { role: "gg", text: raw });
    setInput("");
    setBusy(true);

    const routing = routeRequest(parsed.cleanText);
    setTypingModel(routing.modelLabel);

    let ctxPrompt = inputCtx ? buildContextPrompt(inputCtx) : "";
    if (inputCtx?.requirement) {
      const items = await fetchRequirementItems(inputCtx.requirement.id).catch(() => []);
      ctxPrompt += buildRequirementItemsPrompt(items);
    }
    // A short message is only "simple" if there's no project/RQ context chip attached —
    // otherwise the user wants that context used even for a brief question.
    const hasAttachments = (inputCtx?.attachments?.length ?? 0) > 0;
    const userId = session?.email ?? "anonymous";
    const ctxProjectId = inputCtx?.project?.id;
    const continuation = isContinuationRequest(parsed.cleanText);
    const previousUserQuery = continuation
      ? chatFor(threadKey).slice().reverse().find((m) => m.role === "gg" && m.text && !isContinuationRequest(m.text))?.text
      : undefined;
    const contextQueryText = continuation && previousUserQuery
      ? `${previousUserQuery}\n${parsed.cleanText}`
      : parsed.cleanText;
    const llmUserText = continuation && previousUserQuery
      ? `${parsed.cleanText}\n\nContinuacion de la consulta anterior del usuario: ${previousUserQuery}`
      : parsed.cleanText;
    const simple = isSimpleMessage(parsed.cleanText) && !continuation && !inputCtx?.project && !inputCtx?.requirement && !hasAttachments;

    // Real-data context: detect intent → query Supabase → build the
    // "--- CONTEXTO REAL CONSULTADO ---" block. Centralized in
    // lib/chat/contextRouter (codes COT/RQ, historical codes, requerimiento/
    // cotización searches, recursos, propuestas técnicas). The pipeline never
    // throws — on a temporary error it returns a soft note instead of data.
    let autoCodeCtx = "";
    let deterministicAnswer: string | null = null;
    if (!simple) {
      const pipeline = await runContextPipeline(contextQueryText);
      autoCodeCtx = pipeline.block;
      deterministicAnswer = buildDeterministicAnswerFromResults(contextQueryText, pipeline.results);
    }

    if (deterministicAnswer && !hasAttachments) {
      const label = "supabase/direct";
      appendChat(threadKey, { role: "agent", text: deterministicAnswer, agentId, modelLabel: label });
      saveConversation(session?.email ?? "anonymous", agentId, parsed.cleanText, deterministicAnswer, label, routing.complexity).catch(() => {});
      recordAgentAnswerPerformance({
        agentId,
        projectId: ctxProjectId,
        conversationScope: "private",
        userMessage: contextQueryText,
        assistantResponse: deterministicAnswer,
        modelLabel: label,
        groundedInSupabase: true,
        proposedKnowledge: false,
        createdBy: session?.email ?? "anonymous",
      });
      setBusy(false);
      setTypingModel(undefined);
      return;
    }

    const fileCtx = (inputCtx?.attachments ?? []).map((f) =>
      `\n\n--- Archivo adjunto: ${f.name} (${Math.round(f.size / 1024)}KB) ---\n${f.content}\n---`
    ).join("");

    // Tell the agent how to read the "Archivo adjunto" block(s) appended to
    // the user's message, mirroring RoundtableView's attachmentCtx.
    const attachmentCtx = hasAttachments
      ? `\n\nEl usuario adjuntó ${(inputCtx?.attachments?.length ?? 0) === 1 ? "un archivo" : `${inputCtx?.attachments?.length} archivos`} a este mensaje. Su contenido (texto extraído) viene al final, en bloques "--- Archivo adjunto: <nombre> ---". Básate en ese contenido para responder a lo que pregunta el usuario sobre el/los archivo(s) — NO respondas con un saludo genérico ni ignores el adjunto. Si el contenido extraído está vacío, es muy corto o dice "sin texto extraíble" (típico de planos/imágenes escaneadas), usa las páginas PDF renderizadas o imágenes del turno si existen. Si aun así no puedes leer etiquetas/símbolos, dilo explícitamente, indica qué archivo es (nombre) y pide un PDF vectorial, mayor resolución, leyenda o recorte de zona crítica. Para planos PDF/imagen y metrados, entrega una tabla con Item, Equipo/material, Símbolo/etiqueta visible, Cantidad, Ubicación/plano, Confianza y Observación; separa "observado" de "inferido" y no inventes cantidades. Si el archivo es HTML/HTM, léelo como código y documento técnico: revisa estructura, fórmulas, tablas, scripts, estilos, variables, riesgos y oportunidades de reutilización; NO ejecutes scripts ni inventes resultados que el HTML no muestre. Si el usuario pide generar, replicar o mejorar una versión, entrégala como bloque \`\`\`html-app completo y funcional, manteniendo un nivel visual y funcional comparable al adjunto. Si el usuario quiere que aprendas teoría/criterios de ese HTML, resume reglas útiles y pregunta qué debe quedar como criterio operativo. El archivo adjunto de este mensaje es la fuente principal: ignora archivos o documentos mencionados en historial previo salvo que el usuario los nombre explícitamente.`
      : "";
    const visionCtx = buildVisionAttachmentNote(inputCtx?.attachments ?? []);

    const [agentMemories, approvedKnowledge] = simple
      ? [[], []]
      : await Promise.all([
          loadAgentMemories(agentId, ctxProjectId, 8, OPERATIONAL_MEMORY_DAYS).catch(() => []),
          loadApprovedAgentKnowledge(agentId, ctxProjectId, 8).catch(() => []),
        ]);
    const memoryCtx = buildAgentMemoryPrompt(agentMemories, approvedKnowledge);

    const systemPrompt = (AGENT_SYSTEM_PROMPTS[agentId] ?? AGENT_SYSTEM_PROMPTS.ic) + HUMANIZE_CTX + AGENT_LEARNING_CTX + GENERAL_CONVERSATION_CTX + HTML_APP_GENERATION_CTX + memoryCtx + ctxPrompt + autoCodeCtx + attachmentCtx + visionCtx;

    // Load Supabase memory (older conversations) only for non-trivial
    // messages, but always read this thread's local history — it's already
    // in memory and is what lets the agent follow up on "ok"/short replies
    // instead of repeating its opening question. Skipped when this message
    // has a new attachment so old projects/files don't leak into context.
    // Long-term memory from Supabase: only loaded when there's an active
    // project (chip), and scoped to it — otherwise it tends to surface old,
    // unrelated conversations right before the current message, confusing
    // the model into anchoring on stale context instead of the live thread.
    const [supabaseHistory, localHistory] = await Promise.all([
      simple || hasAttachments ? Promise.resolve([]) : loadConversationHistory(userId, agentId, ctxProjectId, 10, CONVERSATION_MEMORY_DAYS),
      Promise.resolve(chatFor(threadKey)),
    ]);

    const contextMessages: ChatMessage[] = [
      // Supabase long-term memory (older conversations)
      ...supabaseHistory.slice(0, 6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      // Recent local thread (current session)
      ...localHistory.slice(-6).map((m) => ({
        role: (m.role === "gg" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      })),
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...contextMessages,
      { role: "user", content: buildUserContentWithVision(llmUserText + fileCtx, inputCtx?.attachments ?? []) },
    ];

    try {
      const { response, actualConfig } = await sendChatWithFallback(messages, routing.config, routing.complexity);
      const label = `${actualConfig.provider}/${response.model}`;
      appendChat(threadKey, { role: "agent", text: response.content, agentId, modelLabel: label, modelSuggestion: routing.suggestion });
      saveConversation(session?.email ?? "anonymous", agentId, parsed.cleanText, response.content, label, routing.complexity).catch(() => {});
      let proposedKnowledge = false;
      if (!simple) {
        const memory = buildMemoryCandidate(agentId, parsed.cleanText, response.content, routing.complexity, "private");
        if (memory) {
          saveAgentMemory(agentId, memory.content, memory.memoryType, ctxProjectId, memory.importance).catch(() => {});
          if (memory.proposeKnowledge) {
            proposedKnowledge = true;
            proposeAgentKnowledge(agentId, memory.content, ctxProjectId, memory.importance, session?.email ?? "anonymous").catch(() => {});
          }
        }
      }
      recordAgentAnswerPerformance({
        agentId,
        projectId: ctxProjectId,
        conversationScope: "private",
        userMessage: parsed.cleanText,
        assistantResponse: response.content,
        modelLabel: label,
        groundedInSupabase: autoCodeCtx.includes("--- CONTEXTO REAL CONSULTADO ---"),
        proposedKnowledge,
        createdBy: session?.email ?? "anonymous",
      });
    } catch (err) {
      appendChat(threadKey, { role: "agent", text: chatProviderErrorMessage(err), agentId, isError: true });
    }

    setBusy(false);
    setTypingModel(undefined);
  }

  if (!agent) return null;

  return (
    <>
      <PageHeader
        eyebrow="Chat con agentes"
        title="Consulta directa a tu equipo IA"
        description="Conversa con cada agente. Respuestas reales vía Gemini, Groq, Sambanova u otros proveedores configurados."
        actions={<span className="badge badge--green badge--dot">IA activa</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 10, alignItems: "start" }}>
        <div className="space-y-2">
          <div className="card" style={{ padding: 8 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, color: "var(--t3)", padding: "4px 6px 6px" }}>Tu equipo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {CHAT_AGENTS.map((id) => {
                const a = agentById(id);
                if (!a) return null;
                const isActive = agentId === id;
                const future = a.type === "agent-future";
                return (
                  <button
                    key={id}
                    onClick={() => setAgentId(id)}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: "var(--r)", textAlign: "left", width: "100%", border: "1px solid " + (isActive ? "var(--blue-border)" : "transparent"), background: isActive ? "var(--blue-bg)" : "transparent", cursor: "pointer", transition: "all .12s", opacity: future ? 0.7 : 1 }}
                  >
                    <div className={`agent-avatar ${agentAvatarClass(id)}`} style={{ width: 30, height: 30, fontSize: 11 }}>{id.toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.role}</div>
                    </div>
                    {future && <span className="badge badge--slate" style={{ flexShrink: 0 }}>Futuro</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Contexto activo de {agent.name.split(" ").pop()}</div>
            <div className="info-row"><span className="info-row-label">Skills activas</span><span className="info-row-value">{agent.skillCount}</span></div>
            <div className="info-row"><span className="info-row-label">Mensajes</span><span className="info-row-value">{thread.length}</span></div>
            <div className="info-row"><span className="info-row-label">Tarea actual</span><span className="info-row-value">{agent.currentTask}</span></div>
            <p style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>{agent.focus}</p>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 190px)", minHeight: 420 }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className={`agent-avatar ${agentAvatarClass(agentId)}`}>{agentId.toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{agent.role}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="badge badge--green">IA activa</span>
              <button className="btn btn--ghost btn--sm" style={{ fontSize: 11 }} onClick={() => setShowHelp((v) => !v)}>/ayuda</button>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-muted)" }}>
            {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
            {thread.length === 0 && !showHelp && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 340 }}>
                <div className={`agent-avatar ${agentAvatarClass(agentId)}`} style={{ width: 48, height: 48, fontSize: 16, margin: "0 auto 12px" }}>{agentId.toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>Hola, soy {agent.name}</div>
                <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{INTRO[agentId]}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {(STARTERS[agentId] || []).map((s) => (
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
            {thread.slice(-visibleCount).map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} time={m.time} agentId={agentId} modelLabel={(m as { modelLabel?: string }).modelLabel} modelSuggestion={(m as { modelSuggestion?: string }).modelSuggestion} isError={(m as { isError?: boolean }).isError} />
            ))}
            {busy && <TypingDots agentId={agentId} modelLabel={typingModel} />}
          </div>

          <div style={{ flexShrink: 0, padding: 10, borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <ChatAutoInput
              value={input}
              onChange={setInput}
              onSubmit={(text, ctx) => send(text, ctx)}
              placeholder={`Escribe a ${agent.name}… /proyecto /rq /ayuda`}
              disabled={busy}
            />
          </div>
        </div>
      </div>
      {state.notifications.length === 0 && null}
    </>
  );
}
