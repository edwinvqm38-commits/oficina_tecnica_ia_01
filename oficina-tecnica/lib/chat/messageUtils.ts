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
- SÍ tienes acceso real, en este mismo turno, a las tablas \`cotizaciones\`, \`requerimientos\` y \`requerimiento_items\`. Cuando arriba aparecen bloques como "Cotización detectada", "Requerimiento:", "Items/materiales del requerimiento (Supabase)", "Resultados de búsqueda en requerimientos", "Proyecto activo" o "Requerimientos relacionados al código", esos datos se acaban de consultar en vivo desde esas tablas — son reales, no inventados por ti ni por el usuario.
- Si te preguntan si tienes acceso a la tabla/log de requerimientos o cotizaciones, responde que SÍ: consultas esos datos automáticamente cuando el mensaje incluye un código (COT-/RQ-/OC-/PRY-...) o pide una búsqueda/lista (p. ej. "lista los requerimientos pendientes de Juan", "busca RQ en proceso").
- Si en este turno no aparece ninguno de esos bloques de datos, significa que no se detectó ningún código ni intención de búsqueda en el mensaje — en ese caso pide al usuario el código exacto o que reformule como una búsqueda (ej. "lista/busca/filtra requerimientos..."), en vez de decir que no tienes acceso al sistema.`;

// ── "Do you have access to the data?" meta-questions ────────────────────────
// Small/fast models (e.g. groq/llama-3.1-8b-instant) tend to ignore the
// nuanced HUMANIZE_CTX rules above and flatly answer "no tengo acceso" when
// asked about their own capabilities — even right after using real Supabase
// data. Answer these meta-questions deterministically (no LLM call) so the
// answer is always correct and consistent regardless of model quality.
const DATA_ACCESS_QUESTION_RE = /\b(tienes?|tienen|ten[ée]s)\s+acceso\b[^?.]*\b(tabla|tablas|base\s+de\s+datos|bd|log|datos)\b|\bacceso\s+a\s+(la\s+|las\s+)?(tabla|tablas|base\s+de\s+datos|bd|log)\b|\bqu[eé]\s+(tablas|bases\s+de\s+datos)\s+(puedes|pueden|tienes|tienen)\b/i;

export function isDataAccessQuestion(cleanText: string): boolean {
  return DATA_ACCESS_QUESTION_RE.test(cleanText.trim());
}

export const DATA_ACCESS_ANSWER = `Sí: consulto en tiempo real las tablas **Cotizaciones**, **Requerimientos** y los ítems/materiales de cada requerimiento (Supabase).

Te traigo esos datos automáticamente cuando:
- Mencionas un código (ej. **COT-...**, **RQ-...**, **OC-...**, **PRY-...**), o
- Pides una búsqueda/lista, ej. "lista los requerimientos pendientes de Juan" o "busca RQ en proceso".

Si en una respuesta anterior no incluí esos datos, es porque no detecté ningún código ni pedido de búsqueda en ese mensaje — dame el código exacto o reformula como una búsqueda y lo consulto.`;

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
const SEARCH_VERB_RE = /\b(busca|buscar|busco|busc[aá]me|lista|listar|list[aá]me|mu[eé]stra|mu[eé]strame|mu[eé]stranos|filtra|filtrar|encuentra|encontrar|enc[uú]entrame)\b/i;
const REQ_NOUN_RE = /\brequerimientos?\b|\brqs?\b/i;

const ESTADO_KEYWORDS: Array<[RegExp, string]> = [
  [/\bpendientes?\b/i, "Pendiente"],
  [/\ben\s+proceso\b|\ben\s+curso\b/i, "En proceso"],
  [/\batendidos?\b|\bcompletados?\b|\bfinalizados?\b|\bculminados?\b/i, "Atendido"],
];

export interface RequerimientoSearchIntent {
  estado?: string;
  responsable?: string;
  q?: string;
}

/**
 * Detects "search/list/filter requerimientos" intent in free text and
 * extracts simple filters (estado, responsable). Returns null when the
 * message isn't a search request — callers should fall back to the usual
 * exact-code lookups in that case.
 */
export function detectRequerimientoSearchIntent(cleanText: string): RequerimientoSearchIntent | null {
  const t = cleanText.trim();
  if (!t || !SEARCH_VERB_RE.test(t) || !REQ_NOUN_RE.test(t)) return null;

  const intent: RequerimientoSearchIntent = {};
  for (const [re, estado] of ESTADO_KEYWORDS) {
    if (re.test(t)) { intent.estado = estado; break; }
  }

  const respMatch = t.match(/responsable\s+(?:es\s+|de\s+)?([A-Za-zÀ-ÿ.]+(?:\s+[A-Za-zÀ-ÿ.]+){0,2})/i)
    ?? t.match(/\bde\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ.]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ.]+){0,2})\b/);
  if (respMatch) intent.responsable = respMatch[1].trim();

  return intent;
}
