"use client";

import Link from "next/link";

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const agentChip = (id: string, color: string, border: string, bg: string) => (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 7px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>
      @{id}
    </span>
  );

  const codeChip = (label: string, color: string, border: string, bg: string) => (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 7px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );

  const plainCode = (label: string) => (
    <span style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 7px" }}>
      {label}
    </span>
  );

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--blue-border)", borderRadius: "var(--r)", padding: "14px 16px", fontSize: 12, color: "var(--t2)", lineHeight: 1.7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Guía de comandos del chat</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/wiki-agentes" className="btn btn--ghost btn--sm" style={{ fontSize: 11 }}>Ver guía completa →</Link>
          <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ fontSize: 11 }}>Cerrar ✕</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Agentes */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Dirigirte a un agente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { chip: agentChip("IC", "#1d4ed8", "#bfdbfe", "#eff6ff"), desc: "Ing. de Costos — presupuesto, metrados, desviaciones" },
              { chip: agentChip("PM", "#6d28d9", "#ddd6fe", "#f5f3ff"), desc: "Project Manager — cronograma, riesgos, restricciones" },
              { chip: agentChip("IE", "#0e7490", "#a5f3fc", "#ecfeff"), desc: "Ing. Eléctrico — normas, diseño, cálculo eléctrico" },
              { chip: agentChip("CD", "#0f766e", "#99f6e4", "#f0fdfa"), desc: "Control Documentario — códigos, versiones, carpetas, trazabilidad" },
              { chip: agentChip("TI", "#475569", "#cbd5e1", "#f8fafc"), desc: "Ing. Sistemas — app, Supabase, integraciones, performance" },
              { chip: agentChip("GG", "#92400e", "#fde68a", "#fffbeb"), desc: "Gerente General — consultas ejecutivas o aprobaciones" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {r.chip}
                <span>{r.desc}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginTop: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Hablarle a todo el equipo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {plainCode("@todos")} {plainCode("/equipo")}
              <span>Responde el coordinador (PM) y deriva al especialista correcto</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>👋</span>
              <span>Un saludo o mensaje corto sin mención específica también lo responde solo el coordinador</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>🎯</span>
              <span>Si tu mensaje toca el tema de un agente (costos, cronograma, normas…), responde solo ese agente</span>
            </div>
          </div>
        </div>

        {/* Proyectos / RQs */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Referenciar un proyecto o RQ</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {plainCode("/proyecto")}
              <span>Busca una cotización/proyecto en Supabase (por código, nombre o cliente)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {codeChip("FOR-EKA-PRO-3_2025-143", "#166534", "#bbf7d0", "#f0fdf4")}
              <span>Al elegirlo, su código se inserta en el chat resaltado en <b style={{ color: "#166534" }}>verde</b></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {plainCode("/rq")}
              <span>Busca un requerimiento del proyecto referenciado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {codeChip("RQ-CJM075-001_2026", "#0e7490", "#a5f3fc", "#ecfeff")}
              <span>Al elegirlo, su código se inserta resaltado en <b style={{ color: "#0e7490" }}>celeste</b></span>
            </div>
            <div style={{ marginTop: 2 }}>
              Puedes seguir escribiendo tu pregunta a continuación de los códigos, p. ej.:
              <div style={{ marginTop: 4, padding: "5px 8px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 10.5 }}>
                {codeChip("FOR-EKA-PRO-3_2025-143", "#166534", "#bbf7d0", "#f0fdf4")}{" "}
                {codeChip("RQ-CJM075-001_2026", "#0e7490", "#a5f3fc", "#ecfeff")}{" "}
                ¿en qué estado está este RQ?
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span>📋</span>
              <span>Mientras el código siga en el texto, el agente responsable usa esos datos reales para responder</span>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginTop: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Otros</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>📋</span>
              <span>Pega un código <b>COT-…</b>, <b>RQ-…</b> u <b>OC-…</b> en tu mensaje y se busca su info automáticamente</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>📎</span>
              <span>Adjunta archivos (PDF, TXT, CSV, Excel, HTML/HTM, código…) para que el agente los lea</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {plainCode("/ayuda")}
              <span>Muestra esta guía</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {plainCode("/menu")} {plainCode("@IC /menu")}
              <span>Muestra botones de consultas rápidas por agente</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Ejemplos de consultas</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            "@IC ¿cuánto cuesta el tendido de cable de este proyecto?",
            "@IC /menu",
            "@CD /menu",
            "@TI revisa si esta consulta puede consumir mucho egress",
            "@PM ¿qué riesgos tiene el cronograma actual?",
            "@IE ¿qué norma aplica a la SET 138kV?",
            "buenos días",
            "@todos ¿cuál es el estado del portafolio?",
            "FOR-EKA-PRO-3_2025-143 RQ-CJM075-001_2026 ¿en qué estado está este RQ?",
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
