"use client";
import { useState } from "react";
import type { RoutingDecision } from "@/lib/llm/modelRouter";

const COMPLEXITY_LABEL: Record<string, string> = {
  simple: "Simple",
  technical: "Técnico",
  analytical: "Analítico",
  generative: "Generativo",
};

const COMPLEXITY_COLOR: Record<string, string> = {
  simple: "var(--green)",
  technical: "var(--blue)",
  analytical: "var(--amber)",
  generative: "var(--orange)",
};

export function ModelBadge({ decision }: { decision: RoutingDecision }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const color = COMPLEXITY_COLOR[decision.complexity] ?? "var(--t3)";

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          borderRadius: 20,
          border: `1px solid var(--border)`,
          background: "var(--bg-card)",
          cursor: "default",
          fontSize: "10px",
          color: "var(--t3)",
          fontFamily: "var(--font-mono, monospace)",
          lineHeight: 1.6,
          userSelect: "none",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
        {decision.modelLabel}
      </button>

      {showTooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            background: "var(--sb-bg)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "10px 12px",
            minWidth: 200,
            maxWidth: 260,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: "11px", color: "#ffffff", fontWeight: 600, marginBottom: 4 }}>
            {decision.modelLabel}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", marginBottom: 6, lineHeight: 1.5 }}>
            {decision.reason}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: "9px",
              padding: "1px 6px",
              borderRadius: 10,
              background: `${color}22`,
              color: color,
              border: `1px solid ${color}44`,
            }}>
              {COMPLEXITY_LABEL[decision.complexity]}
            </span>
            <span style={{
              fontSize: "9px",
              padding: "1px 6px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              {decision.config.provider}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
