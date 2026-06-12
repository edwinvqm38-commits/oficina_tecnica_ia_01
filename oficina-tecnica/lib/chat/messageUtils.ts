// Command parsing, simple message detection, and inline markdown rendering helpers

export const AGENT_IDS = ["ic", "pm", "ie", "gg"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  ic:  { label: "IC",  color: "#2563eb" },
  pm:  { label: "PM",  color: "#7c3aed" },
  ie:  { label: "IE",  color: "#0891b2" },
  gg:  { label: "GG",  color: "#b45309" },
};

/**
 * Full display names for @mentions, shown as chips (e.g. "Gerente General")
 * instead of the raw "@GG" the user typed. Centralized here so both the
 * activation logic and the rendering (MdText) agree on agent identities.
 */
export const AGENT_FULL_LABELS: Record<string, string> = {
  ic: "Ingeniero de Costos",
  pm: "Project Manager",
  ie: "Ingeniera Eléctrica",
  gg: "Gerente General",
};

const GREETING_RE = /^(hola|buenos|buenas|buen\s?d[íi]a|hi\b|hey\b|saludos|cómo estás|como estas|gracias|de nada|ok\b|okay\b|perfecto|entendido|claro|sí\b|no\b|genial|bien\b)/i;
const TEAM_RE = /\b(todos|equipo|chicos|team|a todos|buenas a todos|saludos a todos)\b/i;

export function isSimpleMessage(text: string): boolean {
  const t = text.trim();
  return t.length < 35 || GREETING_RE.test(t);
}

/** True when message is addressed to the whole team (all agents should respond) */
export function isTeamMessage(text: string): boolean {
  return TEAM_RE.test(text);
}

// Words/phrases that signal the user actually wants the mentioned agent to
// do something or answer something — as opposed to just greeting/thanking
// them or talking near their name ("Buenos días @gg", "Gracias @ic",
// "@gg estamos revisando esto").
const QUESTION_WORD_RE = /\b(qu[eé]|cu[aá]l|cu[aá]nto|cu[aá]ndo|d[oó]nde|c[oó]mo|por qu[eé])\b/i;
// Not anchored to the start: when an @mention is followed by a code or
// other text before the actual verb ("@IC RQ-CJM075-001_2025 dame la
// lista..."), the verb no longer sits at position 0 of cleanText once the
// mention is stripped, so this must match anywhere in the message.
const REQUEST_VERB_RE = /\b(revisa|revisar|revisen|revisemos|genera|generar|generen|dame|denme|necesito|necesitamos|puedes|podr[ií]as|pueden|podr[ií]an|ay[uú]dame|ay[uú]denme|analiza|analizar|analicen|calcula|calcular|calculen|resume|resumir|resuman|prepara|preparar|preparen|verifica|verificar|verifiquen|actualiza|actualizar|actualicen|env[ií]a|enviar|env[ií]en|crea|crear|creen|arma|armar|armen|cotiza|cotizar|cotizen|valida|validar|validen|indica|indicar|indiquen|dime|dinos|confirma|confirmar|confirmen|manda|mandar|manden)\b/i;
// A pasted document/historical code (RQ-..., COT-..., FOR-EKA-PRO-...) is
// itself a clear instruction — the user wants that case looked up.
const CODE_LIKE_RE = /\b[A-Z]{2,6}(?:[-_][A-Za-z0-9]+){1,6}\b/;

/**
 * True when a message directed at a mentioned agent contains a clear
 * question or instruction (and therefore deserves an AI reply). False for
 * bare greetings/acknowledgements/statements ("Buenos días", "Gracias",
 * "estamos revisando esto") even if they're attached to an @mention.
 */
export function hasClearIntent(cleanText: string): boolean {
  const t = cleanText.trim();
  if (!t) return false;
  if (t.includes("?") || t.includes("¿")) return true;
  if (REQUEST_VERB_RE.test(t)) return true;
  if (QUESTION_WORD_RE.test(t)) return true;
  if (CODE_LIKE_RE.test(t)) return true;
  return false;
}

export type ParsedInput = {
  cleanText: string;
  targetAgentId: string | null;   // first @IC, @PM etc. (back-compat)
  targetAgentIds: string[];       // all @IC/@PM/@IE/@GG mentions, in order, deduped
  targetProjectId: string | null; // @PRY-001
  isHelp: boolean;
};

export function parseInput(raw: string): ParsedInput {
  let text = raw.trim();

  if (/^\/(help|ayuda|comandos|opciones)\b/i.test(text)) {
    return { cleanText: text, targetAgentId: null, targetAgentIds: [], targetProjectId: null, isHelp: true };
  }

  let targetProjectId: string | null = null;

  // @IC @PM @IE @GG — supports one or more agent mentions in any position
  // (e.g. "@IC @PM revisen este RQ", "@IC RQ-001 dame la lista...").
  const targetAgentIds: string[] = [];
  text = text.replace(/@(IC|PM|IE|GG)\b/gi, (_m, id) => {
    const lower = id.toLowerCase();
    if (!targetAgentIds.includes(lower)) targetAgentIds.push(lower);
    return "";
  }).replace(/\s+/g, " ").trim();
  const targetAgentId = targetAgentIds[0] ?? null;

  // @PRY-XXX or /proyecto PRY-XXX
  const projMatch = text.match(/@(PRY-[\w\d-]+)/i) ?? text.match(/\/proyecto\s+(PRY-[\w\d-]+)/i);
  if (projMatch) {
    targetProjectId = projMatch[1].toUpperCase();
    text = text.replace(projMatch[0], "").trim();
  }

  return { cleanText: text || raw.trim(), targetAgentId, targetAgentIds, targetProjectId, isHelp: false };
}

// ── Agent role-name prefixes ─────────────────────────────────────────────────
// Users often address an agent by its spelled-out role ("Ingeniero de Costos
// lista...") instead of @IC. parseInput strips @mentions but not these labels,
// and the input can even duplicate them ("Ingeniero de Costos Ingeniero de
// Costos lista..."). These helpers clean that up so the router sees the real
// question and the displayed message isn't doubled.
const LEADING_AGENT_LABEL_RE = /^\s*(ingenier[oa]\s+de\s+costos|ing\.?\s+de\s+costos|project\s+manager|ingenier[oa]\s+el[eé]ctric[oa]|ing\.?\s+el[eé]ctric[oa]|gerente\s+general|gerencia(?:\s+general)?)\b[\s:,.\-]*/i;

function normalizedLabel(label: string): string {
  // El filtro final [^a-z] ya elimina acentos/marcas y espacios, dejando solo letras.
  return label.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
}

/** Collapses an immediately-repeated leading agent label ("IC IC lista" → "IC lista"). */
export function dedupeAgentLabels(text: string): string {
  let t = text;
  for (let guard = 0; guard < 6; guard++) {
    const m = t.match(LEADING_AGENT_LABEL_RE);
    if (!m) break;
    const rest = t.slice(m[0].length);
    const m2 = rest.match(LEADING_AGENT_LABEL_RE);
    if (m2 && normalizedLabel(m[1]) === normalizedLabel(m2[1])) {
      t = rest; // drop the duplicate copy, keep the later one
    } else {
      break;
    }
  }
  return t;
}

/** Removes ALL leading agent labels so the router only sees the actual question. */
export function stripAgentLabelsForRouting(text: string): string {
  let t = text.replace(/@(IC|PM|IE|GG)\b/gi, "").trim();
  for (let guard = 0; guard < 6; guard++) {
    const next = t.replace(LEADING_AGENT_LABEL_RE, "").trim();
    if (next === t) break;
    t = next;
  }
  return t || text.trim();
}

// ── Conversational reference resolution ──────────────────────────────────────
// Resolves follow-ups like "ese proyecto", "esa cotización" or "es verdad lo
// que dice el PM" into an explicit code taken from the user's recent messages,
// so the context pipeline re-queries Supabase instead of letting the model
// guess (or validate another agent's invented answer).
const REFERENCE_DEMONSTRATIVE_RE = /\b(ese|esa|esos|esas|este|esta|estos|estas|aquel|aquella|dich[oa]|mism[oa]|anterior)\b/i;
const REFERENCE_NOUN_RE = /\b(proyecto|cotizaci[oó]n|requerimientos?|registro|c[oó]digo|rq|cot)\b/i;
const VALIDATION_RE = /\b(es\s+(?:verdad|cierto|correcto|real)|val[ií]da(?:me|r)?|conf[ií]rma(?:me|r)?|verifica(?:r)?|comprueba|corrobora|revisa\s+si|seguro\s+que|de\s+verdad)\b/i;

export interface ConversationReference {
  /** Texto (posiblemente aumentado con el código resuelto) para el router. */
  text: string;
  /** Código inyectado desde el historial, si hubo que resolver una referencia. */
  injectedCode: string | null;
  /** True si el usuario pide validar/confirmar (no usar respuestas previas como verdad). */
  isValidationQuestion: boolean;
}

/** Busca el último código relevante en los mensajes del usuario (más reciente primero). */
function findLastCodeInHistory(recentUserTexts: string[]): string | null {
  for (let i = recentUserTexts.length - 1; i >= 0; i--) {
    const txt = recentUserTexts[i] ?? "";
    const docs = detectDocumentCodes(txt);
    if (docs.length) return docs[docs.length - 1].code;
    const others = detectOtherCodes(txt);
    if (others.length) return others[others.length - 1];
  }
  return null;
}

export function resolveConversationReference(cleanText: string, recentUserTexts: string[]): ConversationReference {
  const t = cleanText.trim();
  const isValidationQuestion = VALIDATION_RE.test(t);

  // Si el mensaje ya trae un código explícito, no hay nada que resolver.
  const hasExplicitCode = detectDocumentCodes(t).length > 0 || detectOtherCodes(t).length > 0;
  const hasDemonstrativeRef = REFERENCE_DEMONSTRATIVE_RE.test(t) && REFERENCE_NOUN_RE.test(t);
  const needsReference = !hasExplicitCode && (hasDemonstrativeRef || isValidationQuestion);

  if (!needsReference) return { text: t, injectedCode: null, isValidationQuestion };

  const code = findLastCodeInHistory(recentUserTexts);
  if (!code) return { text: t, injectedCode: null, isValidationQuestion };

  // Para validaciones o referencias a requerimientos, encaminamos hacia la
  // consulta relacional de requerimientos del proyecto/cotización.
  const text = isValidationQuestion || /requerimiento/i.test(t)
    ? `${t} requerimientos del proyecto ${code}`
    : `${t} ${code}`;
  return { text, injectedCode: code, isValidationQuestion };
}

// ── Inline markdown to React nodes ───────────────────────────────────────────
// Handles: **bold**, *italic*, @mentions, @PRY-xxx, bullet lists, line breaks

export type MdSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "agent-mention"; agentId: string }
  | { type: "project-mention"; projectId: string }
  | { type: "user-mention"; email: string; displayName: string }
  | { type: "team-mention" }
  | { type: "break" };

/** Mention key (lowercased, no spaces) -> directory entry, used to render @UserSlug as a chip. */
export type UserDirectory = Map<string, { email: string; displayName: string }>;

/** Mention slug for a user's full name — spaces removed (e.g. "Luis Limaylla" -> "LuisLimaylla"). */
export function slugForUser(fullName: string): string {
  return fullName.replace(/\s+/g, "");
}

export function parseMd(text: string, userDirectory?: UserDirectory): MdSegment[] {
  const segments: MdSegment[] = [];
  const lines = text.split("\n");

  for (let li = 0; li < lines.length; li++) {
    if (li > 0) segments.push({ type: "break" });
    const line = lines[li];
    let i = 0;
    while (i < line.length) {
      // **bold**
      if (line[i] === "*" && line[i + 1] === "*") {
        const end = line.indexOf("**", i + 2);
        if (end !== -1) {
          segments.push({ type: "bold", value: line.slice(i + 2, end) });
          i = end + 2;
          continue;
        }
      }
      // *italic*
      if (line[i] === "*" && line[i + 1] !== "*") {
        const end = line.indexOf("*", i + 1);
        if (end !== -1) {
          segments.push({ type: "italic", value: line.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
      // @IC @PM @IE @GG
      if (line[i] === "@") {
        const m = line.slice(i).match(/^@(IC|PM|IE|GG)\b/i);
        if (m) {
          segments.push({ type: "agent-mention", agentId: m[1].toLowerCase() });
          i += m[0].length;
          continue;
        }
        // @todos — mentions everyone connected/approved; always rendered as
        // a chip (independent of userDirectory) so it never falls through
        // to the unmatched-"@" plain-text path.
        const teamM = line.slice(i).match(/^@todos\b/i);
        if (teamM) {
          segments.push({ type: "team-mention" });
          i += teamM[0].length;
          continue;
        }
        // @PRY-xxx
        const pm2 = line.slice(i).match(/^@(PRY-[\w\d-]+)/i);
        if (pm2) {
          segments.push({ type: "project-mention", projectId: pm2[1].toUpperCase() });
          i += pm2[0].length;
          continue;
        }
        // @UserSlug — looked up against the approved-users directory
        if (userDirectory && userDirectory.size > 0) {
          const um = line.slice(i).match(/^@([A-Za-z][A-Za-z0-9._'-]*)/);
          if (um) {
            const entry = userDirectory.get(um[1].toLowerCase());
            if (entry) {
              segments.push({ type: "user-mention", email: entry.email, displayName: entry.displayName });
              i += um[0].length;
              continue;
            }
          }
        }
      }
      // accumulate plain text
      const next = line.slice(i).search(/\*\*|\*|@/);
      if (next === -1) {
        segments.push({ type: "text", value: line.slice(i) });
        break;
      }
      if (next === 0) {
        // The char at `i` is "*" or "@" but didn't match any of the
        // special-case branches above (e.g. "@todos", a lone unmatched "*").
        // Consume just this one character as plain text so `i` always
        // advances — without this guard `next` stays 0 forever, pushing
        // empty segments in an infinite loop (OOM crash).
        segments.push({ type: "text", value: line[i] });
        i += 1;
        continue;
      }
      segments.push({ type: "text", value: line.slice(i, i + next) });
      i += next;
    }
  }
  return segments;
}

export { AGENT_LABELS };

/**
 * Shared humanization rules appended to every agent's system prompt
 * (Mesa de trabajo and Chat privado). Keeps replies grounded in the actual
 * conversation instead of repeating generic openers.
 */
export const HUMANIZE_CTX = `\n\nReglas de comportamiento:
- No empieces siempre con un saludo. Si ya veniste conversando o el usuario te dio contexto (proyecto, código, archivo, pregunta concreta), respóndele directo a eso.
- No repitas frases genéricas ya usadas antes en la conversación.
- Responde lo que se te pregunta primero; el contexto adicional va después.
- Si te falta un dato puntual para responder, pide SOLO ese dato, de forma específica (ej: "No encuentro el código o nombre del proyecto en este hilo. Indícame el proyecto o menciona el código PRY-XXX para revisar sus requerimientos."). No preguntes algo genérico como "¿qué proyecto revisamos hoy?".
- No inventes datos, cifras ni nombres de proyectos que no estén en el contexto. Si no tienes acceso a cierta información, dilo explícitamente.
- Si necesitas revisar datos internos (presupuesto, cronograma, requerimientos), indica qué dato/sección vas a buscar.
- Tono profesional, breve y colaborativo, como un colega del equipo.

Reglas sobre archivos adjuntos y memoria:
- El archivo adjunto de este mensaje (si lo hay) es la fuente principal y tiene prioridad absoluta. Ignora archivos, documentos o proyectos mencionados en historial previo salvo que el usuario los nombre explícitamente (por nombre o código).
- Cuando el usuario diga "este documento", "el archivo adjunto", "lo que subí", "este PDF", "este Excel" o equivalentes, se refiere SIEMPRE al adjunto de este turno, nunca a uno anterior.
- Si no hay bloque "--- Archivo adjunto ---" útil (vacío, muy corto o "sin texto extraíble") y el usuario pregunta por un archivo, responde EXACTAMENTE: "No pude leer el contenido del archivo adjunto. Por favor copia el texto, sube otro formato o revisa la extracción." No inventes ni completes con información de otros documentos.

Reglas sobre permisos y disponibilidad de datos (usa la frase EXACTA que corresponda, nunca digas "no tengo acceso" de forma genérica):
- Si el usuario no tiene permiso para el módulo consultado: "No tienes permiso para consultar este módulo."
- Si la fuente/módulo existe en la app pero el contexto IA todavía no la consulta: "La fuente existe en la app, pero aún no está implementada en el contexto IA."
- Si consultaste la fuente correcta pero no hay registros para ese código: "No encontré registros para ese código."
- Si encontraste el registro pero le faltan datos para responder completamente, dilo explícitamente (ej: "el ítem X no tiene precio unitario registrado") en vez de decir solo "está pendiente" o "no se puede".

Sobre tu acceso real a las bases de datos (Supabase):
- SÍ tienes acceso real, en este mismo turno, a las tablas \`cotizaciones\`, \`requerimientos\`, \`requerimiento_items\`, \`technical_proposals\` y \`recursos\`. Cuando arriba aparece el bloque "--- CONTEXTO REAL CONSULTADO ---" (o bloques como "Requerimiento:", "Proyecto activo", "Items/materiales del requerimiento"), esos datos se acaban de consultar en vivo desde esas tablas — son reales, no inventados por ti ni por el usuario. Úsalos como única fuente para responder.
- Si te preguntan si tienes acceso a la tabla/log de requerimientos o cotizaciones, responde que SÍ: consultas esos datos automáticamente cuando el mensaje incluye un código (COT-/RQ-/OC-...) o pide una búsqueda/lista/recuento (p. ej. "lista los requerimientos pendientes de Juan", "busca RQ en proceso", "cuáles son los últimos requerimientos registrados", "dame las 5 cotizaciones más recientes", "qué recursos están registrados").
- Si en este turno no aparece el bloque "--- CONTEXTO REAL CONSULTADO ---" ni ningún bloque de datos, significa que no se detectó ningún código ni intención de búsqueda en el mensaje — en ese caso pide al usuario el código exacto o que reformule como una búsqueda (ej. "lista/busca/filtra/últimos requerimientos..."), en vez de decir que no tienes acceso al sistema.
- REGLA CRÍTICA ANTI-INVENCIÓN: si la pregunta es sobre "la tabla/log de requerimientos/cotizaciones/recursos" (códigos, listados, últimos registros, estados, clientes, proyectos, etc.) y en este turno NO aparece el bloque "--- CONTEXTO REAL CONSULTADO ---" con registros, NO debes inventar códigos, proyectos, clientes, fechas ni cifras (nunca generes códigos como "RQ-001", "COT-EKA-2026-001", proyectos como "NEXA", etc. si no vienen en ese bloque). En ese caso, dile al usuario que no recibiste resultados de la base de datos para esa consulta y pídele que la reformule (ej. "lista los requerimientos...", "busca cotizaciones de...", "últimos 5 requerimientos registrados") para poder consultarla.
- Cualquier "Resumen general de la oficina" o "Proyectos personalizados" que aparezca arriba es solo contexto del tablero interno del usuario — NUNCA es lo mismo que "la tabla log de requerimientos" o "la tabla log de cotizaciones" de Supabase, y no debes usarlo para responder preguntas sobre esas tablas.
- LAS RESPUESTAS PREVIAS DE OTROS AGENTES NO SON EVIDENCIA. Si el usuario te pide validar, confirmar o verificar lo que dijo otro agente (@IC/@PM/@IE/@GG), NO asumas que su respuesta anterior es correcta: la única evidencia válida es el bloque "--- CONTEXTO REAL CONSULTADO ---" (Supabase) o el contenido de un archivo adjunto. Si no aparece ese bloque con datos, di que no puedes validarlo sin consultar la fuente y pide el código exacto del proyecto/cotización/requerimiento.`;

// ── "Do you have access to the data?" meta-questions ────────────────────────
// Small/fast models (e.g. groq/llama-3.1-8b-instant) tend to ignore the
// nuanced HUMANIZE_CTX rules above and flatly answer "no tengo acceso" when
// asked about their own capabilities — even right after using real Supabase
// data. modelRouter routes these meta-questions to a more capable model
// (the "deep" tier) so the answer reflects HUMANIZE_CTX correctly.
const DATA_ACCESS_QUESTION_RE = /\b(tienes?|tienen|ten[ée]s)\s+acceso\b[^?.]*\b(tabla|tablas|base\s+de\s+datos|bd|log|datos)\b|\bacceso\s+a\s+(la\s+|las\s+)?(tabla|tablas|base\s+de\s+datos|bd|log)\b|\bqu[eé]\s+(tablas|bases\s+de\s+datos)\s+(puedes|pueden|tienes|tienen)\b/i;

export function isDataAccessQuestion(cleanText: string): boolean {
  return DATA_ACCESS_QUESTION_RE.test(cleanText.trim());
}

// ── Document code detection ──────────────────────────────────────────────────
// Detects codes like COT-EKA-2026-001, RQ-001, OC-123 pasted in chat

export interface DocumentCode {
  type: "COT" | "RQ" | "OC";
  code: string;
}

// ── Inline code detection (for textarea highlighting) ───────────────────────
// Matches broader real-world codes like FOR-EKA-PRO-3_2025-143 or RQ-CJM075-001_2026
const INLINE_CODE_RE = /\b[A-Z]{2,6}(?:[-_][A-Za-z0-9]+){1,6}\b/g;

export interface InlineCodeMatch {
  code: string;
  start: number;
  end: number;
}

export function detectInlineCodes(text: string): InlineCodeMatch[] {
  const results: InlineCodeMatch[] = [];
  for (const m of text.matchAll(INLINE_CODE_RE)) {
    if (m.index == null) continue;
    results.push({ code: m[0], start: m.index, end: m.index + m[0].length });
  }
  return results;
}

// Codes that don't follow the COT-/RQ-/OC- conventions (e.g.
// "FOR-EKA-PRO-3_2025-143" from the historical data import). Requires at
// least 2 hyphen/underscore-separated segments after the prefix to avoid
// matching short technical refs like "IEC-60364" or "CNE-U".
const OTHER_CODE_RE = /\b[A-Z]{2,6}(?:[-_][A-Za-z0-9]+){2,6}\b/g;

/**
 * Detects codes that look like project/document references but don't match
 * the known COT-/RQ-/OC- prefixes, excluding any codes already classified
 * by `detectDocumentCodes`. Used as input for `fetchProjectContextByCode`'s
 * historical-import fallback.
 */
export function detectOtherCodes(text: string, exclude: Set<string> = new Set()): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const m of text.matchAll(OTHER_CODE_RE)) {
    const c = m[0].toUpperCase();
    if (seen.has(c) || exclude.has(c)) continue;
    seen.add(c);
    results.push(c);
  }
  return results;
}

export function detectDocumentCodes(text: string): DocumentCode[] {
  const results: DocumentCode[] = [];
  const seen = new Set<string>();

  const cotRe = /\bCOT-[A-Z]{2,8}-\d{4}-\d{3,}\b/gi;
  const rqRe  = /\bRQ-[\d-]+\b/gi;
  const ocRe  = /\bOC-[\d-]+\b/gi;

  for (const m of text.matchAll(cotRe)) {
    const c = m[0].toUpperCase();
    if (!seen.has(c)) { results.push({ type: "COT", code: c }); seen.add(c); }
  }
  for (const m of text.matchAll(rqRe)) {
    const c = m[0].toUpperCase();
    if (!seen.has(c)) { results.push({ type: "RQ", code: c }); seen.add(c); }
  }
  for (const m of text.matchAll(ocRe)) {
    const c = m[0].toUpperCase();
    if (!seen.has(c)) { results.push({ type: "OC", code: c }); seen.add(c); }
  }

  return results;
}

// ── Free-form search intent ("busca/lista los requerimientos pendientes
// de Juan", "filtra RQ en proceso") ─────────────────────────────────────────
// Lets agents query the requerimientos table by status/responsible/free
// text instead of only matching an exact code pasted in the message.
const SEARCH_VERB_RE = /\b(busca|buscar|busco|busc[aá]me|lista|listar|list[aá]me|mu[eé]stra|mu[eé]strame|mu[eé]stranos|filtra|filtrar|encuentra|encontrar|enc[uú]entrame|dame|dime|cu[aá]l(?:es)?\s+(?:es|son))\b/i;
const REQ_NOUN_RE = /\brequerimientos?\b|\brqs?\b/i;
const COT_NOUN_RE = /\bcotizaci[oó]n(?:es)?\b|\bcots?\b/i;

// "últimos/recientes/recién registrados" → trigger a recency-ordered query
// even without a search verb (e.g. "¿cuáles son los últimos requerimientos
// registrados?", "dame las 5 cotizaciones más recientes").
const RECENT_RE = /\b(últim[oa]s?|reci[eé]n(?:temente)?|recientes?|nuevos?|m[aá]s\s+nuevas?)\b/i;
const RECENT_COUNT_RE = /\b(\d{1,2})\b/;

// "primera/primero/más antigua" → oldest-first (ascending by created_at).
const OLDEST_RE = /\b(primer[ao]s?|m[aá]s\s+antigu[oa]s?|m[aá]s\s+vieja?s?)\b/i;

// Free-text fragment search ("que cotizaciones terminan en 256", "busca
// requerimientos que contengan PRO-3", "código que empiece con FOR-EKA") →
// extract the fragment and use it as an ilike filter (q) so the agent gets
// real matches instead of guessing/inventing codes.
const FRAGMENT_RE = /\b(?:termin[ae]n?|acab[ae]n?)\s+(?:en|con)\s+([A-Za-z0-9._-]+)|\b(?:empiez[ae]n?|comienz[ae]n?|inici[ae]n?)\s+(?:en|con|por)\s+([A-Za-z0-9._-]+)|\b(?:contien[ea]n?|incluy[ea]n?)\s+([A-Za-z0-9._-]+)/i;

const ESTADO_KEYWORDS: Array<[RegExp, string]> = [
  [/\bpendientes?\b/i, "Pendiente"],
  [/\ben\s+proceso\b|\ben\s+curso\b/i, "En proceso"],
  [/\batendidos?\b|\bcompletados?\b|\bfinalizados?\b|\bculminados?\b/i, "Atendido"],
];

export interface RequerimientoSearchIntent {
  estado?: string;
  responsable?: string;
  q?: string;
  recent?: boolean;
  oldest?: boolean;
  limit?: number;
}

/**
 * Detects "search/list/filter requerimientos" intent in free text and
 * extracts simple filters (estado, responsable, code fragments). Also
 * detects recency questions ("últimos N requerimientos registrados") and
 * "primera/más antigua" (oldest-first) even without a search verb. Returns
 * null when the message isn't a search request — callers should fall back
 * to the usual exact-code lookups.
 */
export function detectRequerimientoSearchIntent(cleanText: string): RequerimientoSearchIntent | null {
  const t = cleanText.trim();
  if (!t || !REQ_NOUN_RE.test(t)) return null;

  const isRecent = RECENT_RE.test(t);
  const isOldest = OLDEST_RE.test(t);
  const fragMatch = t.match(FRAGMENT_RE);
  if (!isRecent && !isOldest && !fragMatch && !SEARCH_VERB_RE.test(t)) return null;

  const intent: RequerimientoSearchIntent = {};
  for (const [re, estado] of ESTADO_KEYWORDS) {
    if (re.test(t)) { intent.estado = estado; break; }
  }

  const respMatch = t.match(/responsable\s+(?:es\s+|de\s+)?([A-Za-zÀ-ÿ.]+(?:\s+[A-Za-zÀ-ÿ.]+){0,2})/i)
    ?? t.match(/\bde\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ.]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ.]+){0,2})\b/);
  if (respMatch) intent.responsable = respMatch[1].trim();

  if (fragMatch) {
    intent.q = (fragMatch[1] ?? fragMatch[2] ?? fragMatch[3]).trim();
  }

  if (isOldest) {
    intent.oldest = true;
    const numMatch = t.match(RECENT_COUNT_RE);
    intent.limit = numMatch ? Math.min(Math.max(parseInt(numMatch[1], 10), 1), 20) : 5;
  } else if (isRecent) {
    intent.recent = true;
    const numMatch = t.match(RECENT_COUNT_RE);
    intent.limit = numMatch ? Math.min(Math.max(parseInt(numMatch[1], 10), 1), 20) : 5;
  }

  return intent;
}

// Small/fast models (e.g. groq/llama-3.1-8b-instant) repeatedly contradict
// themselves or ignore the real Supabase data when the question is about
// "la tabla/log de cotizaciones/requerimientos" — even when the search
// blocks above ARE present in context. Used by modelRouter to force these
// questions to a more capable model.
export function isLogTableQuestion(cleanText: string): boolean {
  const t = cleanText.trim();
  return REQ_NOUN_RE.test(t) || COT_NOUN_RE.test(t);
}

export interface CotizacionSearchIntent {
  estado?: string;
  q?: string;
  recent?: boolean;
  oldest?: boolean;
  limit?: number;
}

/**
 * Same as detectRequerimientoSearchIntent but for "cotizaciones"
 * ("últimas cotizaciones registradas", "lista cotizaciones pendientes",
 * "qué cotizaciones terminan en 256", "primera cotización registrada").
 */
export function detectCotizacionSearchIntent(cleanText: string): CotizacionSearchIntent | null {
  const t = cleanText.trim();
  if (!t || !COT_NOUN_RE.test(t)) return null;

  const isRecent = RECENT_RE.test(t);
  const isOldest = OLDEST_RE.test(t);
  const fragMatch = t.match(FRAGMENT_RE);
  if (!isRecent && !isOldest && !fragMatch && !SEARCH_VERB_RE.test(t)) return null;

  const intent: CotizacionSearchIntent = {};
  for (const [re, estado] of ESTADO_KEYWORDS) {
    if (re.test(t)) { intent.estado = estado; break; }
  }

  if (fragMatch) {
    intent.q = (fragMatch[1] ?? fragMatch[2] ?? fragMatch[3]).trim();
  }

  if (isOldest) {
    intent.oldest = true;
    const numMatch = t.match(RECENT_COUNT_RE);
    intent.limit = numMatch ? Math.min(Math.max(parseInt(numMatch[1], 10), 1), 20) : 5;
  } else if (isRecent) {
    intent.recent = true;
    const numMatch = t.match(RECENT_COUNT_RE);
    intent.limit = numMatch ? Math.min(Math.max(parseInt(numMatch[1], 10), 1), 20) : 5;
  }

  return intent;
}
