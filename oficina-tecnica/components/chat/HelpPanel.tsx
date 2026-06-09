"use client";

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const agentChip = (id: string, color: string, border: string, bg: string) => (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 7px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>
      @{id}
    </span>
  );

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--blue-border)", borderRadius: "var(--r)", padding: "14px 16px", fontSize: 12, color: "var(--t2)", lineHeight: 1.7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Comandos disponibles</span>
        <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ fontSize: 11 }}>Cerrar ✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Dirigirte a un agente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { chip: agentChip("IC", "#1d4ed8", "#bfdbfe", "#eff6ff"), desc: "Ing. de Costos — presupuesto, metrados, desviaciones" },
              { chip: agentChip("PM", "#6d28d9", "#ddd6fe", "#f5f3ff"), desc: "Project Manager — cronograma, riesgos, restricciones" },
              { chip: agentChip("IE", "#0e7490", "#a5f3fc", "#ecfeff"), desc: "Ing. Eléctrico — normas, diseño, cálculo eléctrico" },
              { chip: agentChip("GG", "#92400e", "#fde68a", "#fffbeb"), desc: "Solo consultas ejecutivas o aprobaciones" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {r.chip}
                <span>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Proyectos y comandos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 7px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>@PRY-001</span>
              <span>Enfoca la consulta en ese proyecto</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 7px" }}>/proyecto PRY-001</span>
              <span>Igual que @PRY-001</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 7px" }}>/ayuda</span>
              <span>Muestra esta ayuda</span>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginTop: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Los agentes pueden mencionar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>{agentChip("GG", "#92400e", "#fde68a", "#fffbeb")} cuando necesitan tu aprobación</span>
            <span>{agentChip("IC", "#1d4ed8", "#bfdbfe", "#eff6ff")} o {agentChip("PM", "#6d28d9", "#ddd6fe", "#f5f3ff")} para coordinarse entre ellos</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Ejemplos de consultas</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            "@IC ¿cuánto cuesta el tendido de cable @PRY-001?",
            "@PM ¿qué riesgos tiene el cronograma actual?",
            "@IE ¿qué norma aplica a la SET 138kV?",
            "buenos días",
            "¿cuál es el estado del portafolio?",
            "@IC @PRY-002 analiza la desviación de costo",
          ].map((ex) => (
            <span key={ex} style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", fontFamily: "var(--mono)", fontSize: 10, color: "var(--t2)" }}>
              {ex}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
