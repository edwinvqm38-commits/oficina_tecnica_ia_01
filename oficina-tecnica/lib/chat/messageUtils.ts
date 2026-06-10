// Command parsing, simple message detection, and inline markdown rendering helpers

export const AGENT_IDS = ["ic", "pm", "ie", "gg"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  ic:  { label: "IC",  color: "#2563eb" },
  pm:  { label: "PM",  color: "#7c3aed" },
  ie:  { label: "IE",  color: "#0891b2" },
  gg:  { label: "GG",  color: "#b45309" },
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

export type ParsedInput = {
  cleanText: string;
  targetAgentId: string | null;   // @IC, @PM etc.
  targetProjectId: string | null; // @PRY-001
  isHelp: boolean;
};

export function parseInput(raw: string): ParsedInput {
  let text = raw.trim();

  if (/^\/(help|ayuda|comandos|opciones)\b/i.test(text)) {
    return { cleanText: text, targetAgentId: null, targetProjectId: null, isHelp: true };
  }

  let targetAgentId: string | null = null;
  let targetProjectId: string | null = null;

  // @IC @PM @IE @GG
  const agentMatch = text.match(/@(IC|PM|IE|GG)\b/i);
  if (agentMatch) {
    targetAgentId = agentMatch[1].toLowerCase();
    text = text.replace(agentMatch[0], "").trim();
  }

  // @PRY-XXX or /proyecto PRY-XXX
  const projMatch = text.match(/@(PRY-[\w\d-]+)/i) ?? text.match(/\/proyecto\s+(PRY-[\w\d-]+)/i);
  if (projMatch) {
    targetProjectId = projMatch[1].toUpperCase();
    text = text.replace(projMatch[0], "").trim();
  }

  return { cleanText: text || raw.trim(), targetAgentId, targetProjectId, isHelp: false };
}

// ── Inline markdown to React nodes ───────────────────────────────────────────
// Handles: **bold**, *italic*, @mentions, @PRY-xxx, bullet lists, line breaks

export type MdSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "agent-mention"; agentId: string }
  | { type: "project-mention"; projectId: string }
  | { type: "break" };

export function parseMd(text: string): MdSegment[] {
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
        // @PRY-xxx
        const pm2 = line.slice(i).match(/^@(PRY-[\w\d-]+)/i);
        if (pm2) {
          segments.push({ type: "project-mention", projectId: pm2[1].toUpperCase() });
          i += pm2[0].length;
          continue;
        }
      }
      // accumulate plain text
      const next = line.slice(i).search(/\*\*|\*|@/);
      if (next === -1) {
        segments.push({ type: "text", value: line.slice(i) });
        break;
      }
      segments.push({ type: "text", value: line.slice(i, i + next) });
      i += next;
    }
  }
  return segments;
}

export { AGENT_LABELS };

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
