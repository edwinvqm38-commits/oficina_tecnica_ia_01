"use client";
import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { parseMd, AGENT_FULL_LABELS, type UserDirectory, type MdSegment } from "../../lib/chat/messageUtils";

// Texts longer than this render as plain text (no markdown/mention parsing)
// to keep parseMd's per-line work bounded for very long messages.
const MAX_PARSE_LENGTH = 10000;

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ic: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  pm: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  ie: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" },
  gg: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
};

// Style used for chips rendered inside a colored bubble (e.g. the user's own
// blue message bubble), where the per-agent background colors above would
// have low contrast.
const INVERTED_CHIP: CSSProperties = {
  display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,.22)", color: "inherit",
  border: "1px solid rgba(255,255,255,.4)", borderRadius: 4, padding: "0 5px", fontSize: "0.9em",
  fontWeight: 700, lineHeight: 1.6, margin: "0 1px",
};

// ── Block splitting: separate GFM tables from normal text ────────────────────
// The deterministic answers (and any model output) can contain Markdown tables.
// parseMd only handles inline formatting, so we detect table blocks here and
// render real <table> elements; everything else keeps the existing rendering.
type Block =
  | { type: "text"; value: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function isSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  const inner = t.replace(/^\|/, "").replace(/\|$/, "");
  const cells = inner.split("|");
  return cells.length > 0 && cells.every((c) => /^\s*:?-{1,}:?\s*$/.test(c));
}

function splitRow(line: string): string[] {
  // Respeta pipes escapados (\|) dentro de las celdas.
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => { if (buf.length) { blocks.push({ type: "text", value: buf.join("\n") }); buf = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (line.includes("|") && next != null && isSeparatorLine(next)) {
      flush();
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--; // compensate the for-loop increment
      blocks.push({ type: "table", headers, rows });
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

function renderSegments(segments: MdSegment[], inverted: boolean): ReactNode[] {
  return segments.map((seg, i) => {
    if (seg.type === "bold") {
      return <strong key={i} style={{ fontWeight: 700, color: "inherit" }}>{seg.value}</strong>;
    }
    if (seg.type === "italic") {
      return <em key={i} style={{ fontStyle: "italic" }}>{seg.value}</em>;
    }
    if (seg.type === "agent-mention") {
      const label = AGENT_FULL_LABELS[seg.agentId] ?? seg.agentId.toUpperCase();
      if (inverted) return <span key={i} style={INVERTED_CHIP}>{label}</span>;
      const c = AGENT_COLORS[seg.agentId] ?? AGENT_COLORS.gg;
      return (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, lineHeight: 1.6, margin: "0 1px" }}>
          {label}
        </span>
      );
    }
    if (seg.type === "project-mention") {
      if (inverted) return <span key={i} style={INVERTED_CHIP}>@{seg.projectId}</span>;
      return (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, fontFamily: "var(--mono)", lineHeight: 1.6, margin: "0 1px" }}>
          @{seg.projectId}
        </span>
      );
    }
    if (seg.type === "user-mention") {
      if (inverted) return <span key={i} title={seg.email} style={INVERTED_CHIP}>@{seg.displayName}</span>;
      return (
        <span key={i} title={seg.email} style={{ display: "inline-flex", alignItems: "center", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, lineHeight: 1.6, margin: "0 1px" }}>
          @{seg.displayName}
        </span>
      );
    }
    if (seg.type === "team-mention") {
      if (inverted) return <span key={i} style={{ ...INVERTED_CHIP, fontWeight: 800 }}>@Todos</span>;
      return (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 800, lineHeight: 1.6, margin: "0 1px" }}>
          @Todos
        </span>
      );
    }
    if (seg.type === "break") return <br key={i} />;
    return <span key={i}>{seg.value}</span>;
  });
}

function MdTable({ block, inverted, userDirectory }: { block: Extract<Block, { type: "table" }>; inverted: boolean; userDirectory?: UserDirectory }) {
  const border = inverted ? "1px solid rgba(255,255,255,.35)" : "1px solid var(--bd, #e2e8f0)";
  const headBg = inverted ? "rgba(255,255,255,.14)" : "var(--bg2, #f8fafc)";
  return (
    <div style={{ overflowX: "auto", margin: "6px 0" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "0.92em", width: "100%" }}>
        <thead>
          <tr>
            {block.headers.map((h, i) => (
              <th key={i} style={{ border, padding: "4px 8px", textAlign: "left", background: headBg, fontWeight: 700, whiteSpace: "nowrap" }}>
                {renderSegments(parseMd(h, userDirectory), inverted)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {block.headers.map((_h, c) => (
                <td key={c} style={{ border, padding: "4px 8px", verticalAlign: "top" }}>
                  {renderSegments(parseMd(row[c] ?? "", userDirectory), inverted)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MdText({ text, variant = "default", userDirectory }: { text: string; variant?: "default" | "inverted"; userDirectory?: UserDirectory }) {
  const blocks = useMemo(() => {
    if (text.length > MAX_PARSE_LENGTH) return [{ type: "text" as const, value: text }];
    return parseBlocks(text);
  }, [text]);
  const inverted = variant === "inverted";

  return (
    <span>
      {blocks.map((block, bi) =>
        block.type === "table"
          ? <MdTable key={bi} block={block} inverted={inverted} userDirectory={userDirectory} />
          : <span key={bi}>{renderSegments(parseMd(block.value, userDirectory), inverted)}</span>
      )}
    </span>
  );
}
