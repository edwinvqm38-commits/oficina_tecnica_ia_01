"use client";
import type { CSSProperties } from "react";
import { parseMd, AGENT_FULL_LABELS } from "../../lib/chat/messageUtils";

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

export function MdText({ text, variant = "default" }: { text: string; variant?: "default" | "inverted" }) {
  const segments = parseMd(text);
  const inverted = variant === "inverted";

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === "bold") {
          return <strong key={i} style={{ fontWeight: 700, color: "inherit" }}>{seg.value}</strong>;
        }
        if (seg.type === "italic") {
          return <em key={i} style={{ fontStyle: "italic" }}>{seg.value}</em>;
        }
        if (seg.type === "agent-mention") {
          const label = AGENT_FULL_LABELS[seg.agentId] ?? seg.agentId.toUpperCase();
          if (inverted) {
            return <span key={i} style={INVERTED_CHIP}>{label}</span>;
          }
          const c = AGENT_COLORS[seg.agentId] ?? AGENT_COLORS.gg;
          return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, lineHeight: 1.6, margin: "0 1px" }}>
              {label}
            </span>
          );
        }
        if (seg.type === "project-mention") {
          if (inverted) {
            return <span key={i} style={INVERTED_CHIP}>@{seg.projectId}</span>;
          }
          return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, fontFamily: "var(--mono)", lineHeight: 1.6, margin: "0 1px" }}>
              @{seg.projectId}
            </span>
          );
        }
        if (seg.type === "break") {
          return <br key={i} />;
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </span>
  );
}
