"use client";
import { parseMd } from "../../lib/chat/messageUtils";

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ic: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  pm: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  ie: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" },
  gg: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
};

export function MdText({ text }: { text: string }) {
  const segments = parseMd(text);

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
          const c = AGENT_COLORS[seg.agentId] ?? AGENT_COLORS.gg;
          return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, fontFamily: "var(--mono)", lineHeight: 1.6, margin: "0 1px" }}>
              @{seg.agentId.toUpperCase()}
            </span>
          );
        }
        if (seg.type === "project-mention") {
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
