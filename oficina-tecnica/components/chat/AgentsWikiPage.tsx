"use client";

import type { ReactNode } from "react";
import { AGENT_FULL_LABELS } from "../../lib/chat/messageUtils";

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".07em" }}>
      {children}
    </div>
  );
}

function Chip({ label, color, border, bg }: { label: string; color: string; border: string; bg: string }) {
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 7px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function PlainCode({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 7px" }}>
      {children}
    </span>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 12, color: "var(--t2)", lineHeight: 1.7 }}>{children}</div>;
}

export function AgentsWikiPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Guía · Disponible para todos los usuarios aprobados</p>
          <h1 className="page-title">Wiki de Agentes IA · Cómo trabajar con el equipo</h1>
          <p className="page-desc">
            Referencia completa de cómo dirigirte a los agentes (Mesa de trabajo y Chat privado), qué pueden y qué no
            pueden hacer, y buenas prácticas para que las respuestas sean precisas.
          </p>
        </div>
      </div>

      {/* Agentes IA */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Agentes IA del equipo</SectionTitle>
        <Row><Chip label="@IC" color="#1d4ed8" border="#bfdbfe" bg="#eff6ff" /><span><b>{AGENT_FULL_LABELS.ic}</b> — presupuesto, metrados, costos, desviaciones de cotizaciones y requerimientos.</span></Row>
        <Row><Chip label="@PM" color="#6d28d9" border="#ddd6fe" bg="#f5f3ff" /><span><b>{AGENT_FULL_LABELS.pm}</b> — cronograma, riesgos, restricciones, y coordinador del equipo cuando le hablas a “todos”.</span></Row>
        <Row><Chip label="@IE" color="#0e7490" border="#a5f3fc" bg="#ecfeff" /><span><b>{AGENT_FULL_LABELS.ie}</b> — normas técnicas, diseño y cálculo eléctrico.</span></Row>
        <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--r)", fontSize: 12, color: "var(--amber-text)", lineHeight: 1.7 }}>
          <b>@GG ({AGENT_FULL_LABELS.gg})</b> es una persona del equipo (el Gerente General), no un agente IA. Si lo
          mencionas, tu mensaje queda visible para él/ella, pero no genera una respuesta automática de IA.
        </div>
      </div>

      {/* Hablarle al equipo */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Hablarle a todo el equipo</SectionTitle>
        <Row><PlainCode>@todos</PlainCode><PlainCode>/equipo</PlainCode><span>Si tu mensaje incluye una pregunta, código o instrucción clara, responde el coordinador (PM) y deriva al especialista correcto. Un saludo simple (“buenos días a todos”) no genera respuesta de IA — solo notifica a las personas conectadas.</span></Row>
        <Row><span>👋</span><span>Un saludo o mensaje corto sin mención específica también lo responde solo el coordinador (PM).</span></Row>
        <Row><span>🎯</span><span>Si tu mensaje toca el tema de un agente (costos, cronograma, normas…) sin mencionarlo explícitamente, responde solo ese agente.</span></Row>
        <Row><span>🤝</span><span>Si mencionas varios agentes (<PlainCode>@IC @PM</PlainCode>), responden ambos, en orden, sin duplicar respuestas.</span></Row>
      </div>

      {/* Archivos adjuntos */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Archivos adjuntos</SectionTitle>
        <Row><span>📎</span><span>Adjunta archivos PDF, Word, Excel, CSV o TXT para que el agente los lea.</span></Row>
        <Row><span>📋</span><span>El archivo adjunto de tu mensaje actual es siempre la fuente principal. Si dices “este documento”, “el archivo adjunto”, “lo que subí”, el agente se refiere SIEMPRE al adjunto de ese turno, nunca a uno anterior.</span></Row>
        <Row><span>⚠️</span><span>Si el agente no puede leer el archivo, responderá exactamente: <i>“No pude leer el contenido del archivo adjunto. Por favor copia el texto, sube otro formato o revisa la extracción.”</i> No debe inventar contenido ni usar un archivo de una conversación anterior.</span></Row>
      </div>

      {/* Códigos de proyecto/RQ */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Referenciar un proyecto o requerimiento</SectionTitle>
        <Row><PlainCode>/proyecto</PlainCode><span>Busca una cotización/proyecto en Supabase (por código, nombre o cliente).</span></Row>
        <Row><Chip label="FOR-EKA-PRO-3_2025-143" color="#166534" border="#bbf7d0" bg="#f0fdf4" /><span>Al elegirlo, su código se inserta en el chat resaltado en <b style={{ color: "#166534" }}>verde</b>.</span></Row>
        <Row><PlainCode>/rq</PlainCode><span>Busca un requerimiento del proyecto referenciado.</span></Row>
        <Row><Chip label="RQ-CJM075-001_2026" color="#0e7490" border="#a5f3fc" bg="#ecfeff" /><span>Al elegirlo, su código se inserta resaltado en <b style={{ color: "#0e7490" }}>celeste</b>.</span></Row>
        <Row><span>📋</span><span>También puedes pegar directamente un código <b>COT-…</b>, <b>RQ-…</b>, <b>OC-…</b> u otro código de proyecto (ej. <PlainCode>FOR-EKA-PRO-3_2025-143</PlainCode>) en tu mensaje y se busca su información automáticamente. Mientras el código siga en el texto, el agente responsable usa esos datos reales para responder.</span></Row>
      </div>

      {/* Comandos slash */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Comandos</SectionTitle>
        <Row><PlainCode>/ayuda</PlainCode><span>Muestra la guía rápida de comandos dentro del chat.</span></Row>
        <Row><PlainCode>/proyecto</PlainCode><span>Abre el buscador de proyectos/cotizaciones.</span></Row>
        <Row><PlainCode>/rq</PlainCode><span>Abre el buscador de requerimientos del proyecto referenciado.</span></Row>
        <Row><PlainCode>@IC</PlainCode><PlainCode>@PM</PlainCode><PlainCode>@IE</PlainCode><span>Dirige tu mensaje a un agente específico (puedes combinar varios).</span></Row>
        <Row><PlainCode>@todos</PlainCode><PlainCode>/equipo</PlainCode><span>Dirige tu mensaje a todo el equipo.</span></Row>
      </div>

      {/* Etiquetas recomendadas */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Etiquetas recomendadas (buenas prácticas, opcionales)</SectionTitle>
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7, marginBottom: 8 }}>
          No son comandos obligatorios ni cambian el comportamiento del sistema, pero ayudan a que el agente y tus
          compañeros entiendan rápido la intención del mensaje:
        </p>
        <Row><PlainCode>[CONSULTA]</PlainCode><span>Es una pregunta — esperas una respuesta con información.</span></Row>
        <Row><PlainCode>[ARCHIVO]</PlainCode><span>El mensaje trata sobre un archivo adjunto que acabas de subir.</span></Row>
        <Row><PlainCode>[DECISIÓN]</PlainCode><span>Necesitas que alguien (humano o agente) tome o confirme una decisión.</span></Row>
        <Row><PlainCode>[TAREA]</PlainCode><span>Estás pidiendo que se realice una acción concreta (ej. armar una tabla, calcular algo).</span></Row>
        <Row><PlainCode>[NO RESPONDER]</PlainCode><span>Es un comentario informativo entre personas; los agentes IA no deben intervenir.</span></Row>
      </div>

      {/* Qué pueden y no pueden hacer */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Qué pueden y qué no pueden hacer los agentes</SectionTitle>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green-text)", marginBottom: 4 }}>Sí pueden:</div>
        <Row><span>✅</span><span>Leer el archivo adjunto del mensaje actual y responder sobre su contenido.</span></Row>
        <Row><span>✅</span><span>Consultar datos reales de proyectos, cotizaciones y requerimientos cuando se referencia un código.</span></Row>
        <Row><span>✅</span><span>Recordar el contexto reciente de la conversación (sin adjuntos nuevos).</span></Row>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--amber-text)", marginTop: 10, marginBottom: 4 }}>No pueden / no deben:</div>
        <Row><span>🚫</span><span>Inventar datos, cifras o nombres de proyectos que no estén en el contexto o en Supabase.</span></Row>
        <Row><span>🚫</span><span>Afirmar que leyeron un archivo si la extracción falló — en ese caso deben pedir que se reenvíe en otro formato.</span></Row>
        <Row><span>🚫</span><span>Responder con datos de un archivo o proyecto anterior cuando preguntas por “el archivo actual”.</span></Row>
        <Row><span>🚫</span><span>Acceder a módulos para los que el usuario no tiene permiso (responden con un mensaje explícito de permiso).</span></Row>
      </div>

      {/* Mensajes de permisos/disponibilidad */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Mensajes que puedes recibir sobre permisos o datos</SectionTitle>
        <Row><span>🔒</span><span><i>“No tienes permiso para consultar este módulo.”</i> — tu usuario no tiene acceso a esa sección.</span></Row>
        <Row><span>🧩</span><span><i>“La fuente existe en la app, pero aún no está implementada en el contexto IA.”</i> — el dato existe en el sistema, pero el agente todavía no puede consultarlo.</span></Row>
        <Row><span>🔍</span><span><i>“No encontré registros para ese código.”</i> — se consultó la fuente correcta pero no hay datos para ese código.</span></Row>
      </div>

      {/* Ejemplos */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <SectionTitle>Ejemplos de consultas</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            "@IC ¿cuánto cuesta el tendido de cable de este proyecto?",
            "@PM ¿qué riesgos tiene el cronograma actual?",
            "@IE ¿qué norma aplica a la SET 138kV?",
            "buenos días",
            "@todos ¿cuál es el estado del portafolio?",
            "[ARCHIVO] @IC revisa este presupuesto adjunto",
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
