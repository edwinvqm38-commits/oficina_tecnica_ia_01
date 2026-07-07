"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import katex from "katex";
import { Parser } from "expr-eval";
import { parseMd, AGENT_FULL_LABELS, type UserDirectory } from "../../lib/chat/messageUtils";

// Texts longer than this render as plain text (no markdown/mention parsing)
// to keep parseMd's per-line work bounded for very long messages.
const MAX_PARSE_LENGTH = 30000;

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ic: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  pm: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  ie: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" },
  cd: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  ti: { bg: "#f8fafc", text: "#334155", border: "#cbd5e1" },
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

type MdBlock =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; src: string }
  | { type: "math"; value: string }
  | { type: "htmlApp"; value: string }
  | { type: "mermaid"; value: string }
  | { type: "plot"; kind: "chart" | "graph2d" | "graph3d" | "plotly"; value: string }
  | { type: "table"; headers: string[]; rows: string[][] };

type PlotlyRuntime = {
  newPlot: (element: HTMLElement, data: unknown[], layout?: Record<string, unknown>, config?: Record<string, unknown>) => Promise<unknown>;
  react: (element: HTMLElement, data: unknown[], layout?: Record<string, unknown>, config?: Record<string, unknown>) => Promise<unknown>;
  purge: (element: HTMLElement) => void;
};

type PlotSpec = {
  data: unknown[];
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
  animation?: {
    enabled: boolean;
    variable: string;
    values: number[];
    expression: string;
  };
};

declare global {
  interface Window {
    Plotly?: PlotlyRuntime;
    __otPlotlyPromise?: Promise<PlotlyRuntime>;
  }
}

function loadPlotly(): Promise<PlotlyRuntime> {
  if (typeof window === "undefined") return Promise.reject(new Error("Plotly solo está disponible en el navegador."));
  if (window.Plotly) return Promise.resolve(window.Plotly);
  if (window.__otPlotlyPromise) return window.__otPlotlyPromise;
  window.__otPlotlyPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-ot-plotly='true']");
    if (existing) {
      existing.addEventListener("load", () => window.Plotly ? resolve(window.Plotly) : reject(new Error("Plotly no quedó disponible.")), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Plotly.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
    script.async = true;
    script.dataset.otPlotly = "true";
    script.onload = () => window.Plotly ? resolve(window.Plotly) : reject(new Error("Plotly no quedó disponible."));
    script.onerror = () => reject(new Error("No se pudo cargar Plotly desde CDN."));
    document.head.appendChild(script);
  });
  return window.__otPlotlyPromise;
}

function renderKatex(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: "html",
    });
  } catch {
    return value;
  }
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 4;
}

function splitTableLine(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isSeparatorLine(line: string): boolean {
  const cells = splitTableLine(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseBlocks(text: string): MdBlock[] {
  const lines = text.split("\n");
  const blocks: MdBlock[] = [];
  let buffer: string[] = [];
  let i = 0;

  function flushText() {
    if (!buffer.length) return;
    blocks.push({ type: "text", value: buffer.join("\n") });
    buffer = [];
  }

  while (i < lines.length) {
    const current = lines[i];
    const next = lines[i + 1];
    const fenceMatch = current.trim().match(/^```(mermaid|chart|graph2d|graph3d|plotly|html-app|html)\b/i);
    if (fenceMatch) {
      flushText();
      const code: string[] = [];
      const fenceType = fenceMatch[1].toLowerCase() as "mermaid" | "chart" | "graph2d" | "graph3d" | "plotly" | "html-app" | "html";
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) i += 1;
      if (fenceType === "html-app" || fenceType === "html") {
        blocks.push({ type: "htmlApp", value: code.join("\n").trim() });
      } else if (fenceType === "mermaid") {
        blocks.push({ type: "mermaid", value: code.join("\n").trim() });
      } else {
        blocks.push({ type: "plot", kind: fenceType, value: code.join("\n").trim() });
      }
      continue;
    }
    const trimmed = current.trim();
    const sameLineMath = trimmed.match(/^\$\$(.+)\$\$$/);
    if (sameLineMath) {
      flushText();
      blocks.push({ type: "math", value: sameLineMath[1].trim() });
      i += 1;
      continue;
    }
    const sameLineBracketMath = trimmed.match(/^\\\[(.+)\\\]$/);
    if (sameLineBracketMath) {
      flushText();
      blocks.push({ type: "math", value: sameLineBracketMath[1].trim() });
      i += 1;
      continue;
    }
    if (trimmed === "$$" || trimmed === "\\[") {
      flushText();
      const formula: string[] = [];
      i += 1;
      const endToken = trimmed === "\\[" ? "\\]" : "$$";
      while (i < lines.length && lines[i].trim() !== endToken) {
        formula.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim() === endToken) i += 1;
      blocks.push({ type: "math", value: formula.join("\n").trim() });
      continue;
    }
    const imageMatch = current.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imageMatch) {
      flushText();
      blocks.push({ type: "image", alt: imageMatch[1] || "Imagen", src: imageMatch[2] });
      i += 1;
      continue;
    }
    if (current && next && isTableLine(current) && isTableLine(next) && isSeparatorLine(next)) {
      flushText();
      const headers = splitTableLine(current);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableLine(lines[i])) {
        const row = splitTableLine(lines[i]);
        rows.push(headers.map((_, idx) => row[idx] ?? ""));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    buffer.push(current);
    i += 1;
  }

  flushText();
  return blocks;
}

function htmlAppTitle(code: string): string {
  const titleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) return titleMatch[1].trim();
  const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match?.[1]) return h1Match[1].replace(/\s+/g, " ").trim();
  return "Aplicacion HTML generada";
}

function htmlDownloadName(title: string): string {
  const safe = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${safe || "app_mesa_trabajo"}.html`;
}

function HtmlAppBlock({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const title = useMemo(() => htmlAppTitle(code), [code]);
  const filename = useMemo(() => htmlDownloadName(title), [title]);

  useEffect(() => {
    const blob = new Blob([code], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [code]);

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const iframe = (height: number | string) => (
    <iframe
      title={title}
      srcDoc={code}
      sandbox="allow-scripts allow-forms allow-modals allow-downloads"
      style={{ display: "block", width: "100%", height, border: 0, background: "#fff" }}
    />
  );

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "#fff", overflow: "hidden", color: "var(--t1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
        <span style={{ fontWeight: 800, fontSize: 11.5 }}>{title}</span>
        <span style={{ color: "var(--t3)", fontSize: 10 }}>{Math.max(1, Math.round(code.length / 1024))} KB · app aislada</span>
        <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto", fontSize: 10 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Ocultar" : "Mostrar"}
        </button>
        <button className="btn btn--ghost btn--sm" style={{ fontSize: 10 }} onClick={() => setFullscreen(true)}>
          Pantalla completa
        </button>
        <button className="btn btn--ghost btn--sm" style={{ fontSize: 10 }} onClick={copyHtml}>
          {copied ? "Copiado" : "Copiar HTML"}
        </button>
        {downloadUrl && (
          <>
            <a className="btn btn--ghost btn--sm" style={{ fontSize: 10, textDecoration: "none" }} href={downloadUrl} target="_blank" rel="noreferrer">
              Abrir
            </a>
            <a className="btn btn--ghost btn--sm" style={{ fontSize: 10, textDecoration: "none" }} href={downloadUrl} download={filename}>
              Descargar
            </a>
          </>
        )}
      </div>
      {expanded && iframe(560)}
      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 5000,
            background: "rgba(15,23,42,.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div style={{ width: "min(1440px, 98vw)", height: "min(920px, 94vh)", background: "#fff", borderRadius: 10, boxShadow: "0 24px 80px rgba(0,0,0,.3)", overflow: "hidden", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
              <strong style={{ fontSize: 12.5 }}>{title}</strong>
              <span style={{ color: "var(--t3)", fontSize: 10 }}>vista grande</span>
              <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto", fontSize: 10 }} onClick={copyHtml}>
                {copied ? "Copiado" : "Copiar HTML"}
              </button>
              {downloadUrl && (
                <a className="btn btn--ghost btn--sm" style={{ fontSize: 10, textDecoration: "none" }} href={downloadUrl} download={filename}>
                  Descargar
                </a>
              )}
              <button className="btn btn--primary btn--sm" style={{ fontSize: 10 }} onClick={() => setFullscreen(false)}>
                Cerrar
              </button>
            </div>
            {iframe("calc(min(920px, 94vh) - 42px)")}
          </div>
        </div>
      )}
    </div>
  );
}

function MermaidBlock({ code }: { code: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setSvg("");
    import("mermaid")
      .then(async (mod) => {
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: "Inter, Arial, sans-serif",
            primaryColor: "#f8fafc",
            primaryBorderColor: "#94a3b8",
            primaryTextColor: "#0f172a",
            lineColor: "#334155",
            secondaryColor: "#ecfeff",
            tertiaryColor: "#f0fdf4",
          },
        });
        const result = await mermaid.render(`mermaid-${id}`, code);
        if (active) setSvg(result.svg);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo renderizar el diagrama.");
      });
    return () => {
      active = false;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre style={{ whiteSpace: "pre-wrap", margin: 0, padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-subtle)", color: "var(--t2)", fontSize: 12 }}>
        {code}
      </pre>
    );
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", padding: 10 }}>
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div style={{ fontSize: 12, color: "var(--t3)" }}>Renderizando diagrama...</div>
      )}
    </div>
  );
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rangeValues(range: unknown, defaults: { min: number; max: number; step?: number; points?: number }): number[] {
  const cfg = (range && typeof range === "object" ? range : {}) as Record<string, unknown>;
  const min = asNumber(cfg.min, defaults.min);
  const max = asNumber(cfg.max, defaults.max);
  const points = Math.max(2, Math.min(160, Math.round(asNumber(cfg.points ?? cfg.steps, defaults.points ?? 80))));
  const rawStep = cfg.step == null ? null : asNumber(cfg.step, 0);
  if (rawStep && rawStep > 0) {
    const values: number[] = [];
    for (let v = min; v <= max + rawStep / 2 && values.length < 200; v += rawStep) values.push(Number(v.toFixed(8)));
    return values;
  }
  const step = (max - min) / Math.max(points - 1, 1);
  return Array.from({ length: points }, (_, idx) => Number((min + step * idx).toFixed(8)));
}

function mathScope(primaryVariable: string, primaryValue: number, timeVariable: string, timeValue: number) {
  const value = primaryVariable === timeVariable ? primaryValue : timeValue;
  return {
    [primaryVariable]: primaryValue,
    [timeVariable]: timeValue,
    x: primaryVariable === "x" ? primaryValue : value,
    t: timeVariable === "t" ? timeValue : value,
    I: primaryVariable === "I" ? primaryValue : value,
    V: primaryVariable === "V" ? primaryValue : value,
    R: primaryVariable === "R" ? primaryValue : value,
    i: primaryVariable === "i" ? primaryValue : value,
    v: primaryVariable === "v" ? primaryValue : value,
    r: primaryVariable === "r" ? primaryValue : value,
  };
}

function evaluateExpression(expression: string, variable: string, value: number, timeValue = value): number {
  const parser = new Parser();
  const expr = parser.parse(expression);
  return asNumber(expr.evaluate(mathScope(variable, value, "t", timeValue)), NaN);
}

function buildPlotSpec(kind: "chart" | "graph2d" | "graph3d" | "plotly", jsonText: string): PlotSpec {
  const spec = JSON.parse(jsonText) as Record<string, unknown>;
  if (kind === "plotly") {
    return {
      data: Array.isArray(spec.data) ? spec.data : [],
      layout: (spec.layout && typeof spec.layout === "object" ? spec.layout : {}) as Record<string, unknown>,
      config: (spec.config && typeof spec.config === "object" ? spec.config : {}) as Record<string, unknown>,
    };
  }

  if (kind === "chart") {
    const chartType = String(spec.type ?? "bar").toLowerCase();
    const labels = Array.isArray(spec.labels) ? spec.labels.map(String) : [];
    const values = Array.isArray(spec.values) ? spec.values.map((v) => asNumber(v, 0)) : [];
    const title = String(spec.title ?? "Gráfico");
    const data = chartType === "pie"
      ? [{ type: "pie", labels, values, hole: spec.donut ? 0.42 : 0 }]
      : [{ type: chartType === "line" ? "scatter" : chartType, mode: chartType === "line" ? "lines+markers" : undefined, x: labels, y: values, marker: { color: "#0f766e" } }];
    return {
      data,
      layout: { title: { text: title }, margin: { l: 46, r: 18, t: 42, b: 42 }, height: 320 },
      config: {},
    };
  }

  if (kind === "graph2d") {
    const variable = String(spec.variable ?? "x");
    const expression = String(spec.expression ?? "x");
    const parser = new Parser();
    const expr = parser.parse(expression);
    const x = rangeValues(spec.x, { min: -10, max: 10, points: 121 });
    const y = x.map((v) => {
      try {
        return asNumber(expr.evaluate(mathScope(variable, v, "t", v)), NaN);
      } catch {
        return NaN;
      }
    });
    const animationCfg = (spec.animation && typeof spec.animation === "object" ? spec.animation : {}) as Record<string, unknown>;
    const cursorEnabled = spec.cursor === true || animationCfg.enabled === true || animationCfg.cursor === true;
    const cursorVariable = String(animationCfg.variable ?? variable);
    const cursorValues = cursorEnabled ? rangeValues(animationCfg.range ?? spec.x, { min: x[0] ?? -10, max: x[x.length - 1] ?? 10, points: 80 }) : [];
    return {
      data: [
        { type: "scatter", mode: "lines", x, y, line: { color: "#1d4ed8", width: 2.5 }, name: expression },
        ...(cursorEnabled ? [{
          type: "scatter",
          mode: "markers",
          x: [cursorValues[0] ?? x[0]],
          y: [y[0]],
          marker: { color: "#dc2626", size: 10 },
          name: cursorVariable,
        }] : []),
      ],
      layout: {
        title: { text: String(spec.title ?? `${expression}`) },
        xaxis: { title: { text: variable }, zeroline: true },
        yaxis: { title: { text: "f(x)" }, zeroline: true },
        margin: { l: 54, r: 18, t: 42, b: 46 },
        height: 340,
      },
      config: {},
      animation: cursorEnabled ? { enabled: true, variable: cursorVariable, values: cursorValues, expression } : undefined,
    };
  }

  const expression = String(spec.expression ?? "x*y");
  const parser = new Parser();
  const expr = parser.parse(expression);
  const xs = rangeValues(spec.x, { min: -5, max: 5, points: 55 });
  const ys = rangeValues(spec.y, { min: -5, max: 5, points: 55 });
  const z = ys.map((y) => xs.map((x) => {
    try {
      return asNumber(expr.evaluate({ x, y }), NaN);
    } catch {
      return NaN;
    }
  }));
  return {
    data: [{ type: "surface", x: xs, y: ys, z, colorscale: "Viridis", name: expression }],
    layout: {
      title: { text: String(spec.title ?? `z = ${expression}`) },
      scene: {
        xaxis: { title: { text: "x" } },
        yaxis: { title: { text: "y" } },
        zaxis: { title: { text: "z" } },
      },
      margin: { l: 0, r: 0, t: 42, b: 0 },
      height: 430,
    },
    config: {},
  };
}

function PlotBlock({ kind, code }: { kind: "chart" | "graph2d" | "graph3d" | "plotly"; code: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<PlotlyRuntime | null>(null);
  const specRef = useRef<PlotSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [readout, setReadout] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setStep(0);
    setReadout(null);
    loadPlotly()
      .then(async (Plotly) => {
        if (!active || !ref.current) return;
        plotlyRef.current = Plotly;
        const plotSpec = buildPlotSpec(kind, code);
        specRef.current = plotSpec;
        await Plotly.newPlot(
          ref.current,
          plotSpec.data,
          plotSpec.layout,
          { responsive: true, displaylogo: false, ...(plotSpec.config ?? {}) }
        );
        if (plotSpec.animation?.enabled) {
          const x0 = plotSpec.animation.values[0] ?? 0;
          const y0 = evaluateExpression(plotSpec.animation.expression, plotSpec.animation.variable, x0);
          setReadout(`${plotSpec.animation.variable} = ${x0.toFixed(3)} | f = ${Number.isFinite(y0) ? y0.toFixed(3) : "N/D"}`);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo renderizar el gráfico.");
      });
    return () => {
      active = false;
      if (ref.current && window.Plotly) window.Plotly.purge(ref.current);
    };
  }, [code, kind]);

  function updateSimulation(nextStep: number) {
    const plotSpec = specRef.current;
    const Plotly = plotlyRef.current;
    if (!plotSpec?.animation?.enabled || !Plotly || !ref.current) return;
    const values = plotSpec.animation.values;
    const idx = Math.max(0, Math.min(nextStep, values.length - 1));
    const xVal = values[idx] ?? 0;
    let yVal = NaN;
    try {
      yVal = evaluateExpression(plotSpec.animation.expression, plotSpec.animation.variable, xVal);
    } catch {
      yVal = NaN;
    }
    const marker = {
      type: "scatter",
      mode: "markers",
      x: [xVal],
      y: [yVal],
      marker: { color: "#dc2626", size: 10 },
      name: plotSpec.animation.variable,
    };
    const data = [plotSpec.data[0], marker];
    Plotly.react(ref.current, data, plotSpec.layout, { responsive: true, displaylogo: false, ...(plotSpec.config ?? {}) });
    setStep(idx);
    setReadout(`${plotSpec.animation.variable} = ${xVal.toFixed(3)} | f = ${Number.isFinite(yVal) ? yVal.toFixed(3) : "N/D"}`);
  }

  if (error) {
    return (
      <pre style={{ whiteSpace: "pre-wrap", margin: 0, padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-subtle)", color: "var(--red-text, #b91c1c)", fontSize: 12 }}>
        No se pudo renderizar el gráfico: {error}
      </pre>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "#fff", padding: 8, overflow: "hidden" }}>
      <div ref={ref} style={{ width: "100%", minHeight: kind === "graph3d" ? 430 : 320 }} />
      {specRef.current?.animation?.enabled && (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", padding: "4px 10px 8px" }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => updateSimulation(Math.max(0, step - 1))}>◀</button>
          <input
            type="range"
            min={0}
            max={Math.max((specRef.current.animation.values.length ?? 1) - 1, 0)}
            value={step}
            onChange={(e) => updateSimulation(Number(e.target.value))}
            aria-label="Simulación en el tiempo"
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => updateSimulation(Math.min((specRef.current?.animation?.values.length ?? 1) - 1, step + 1))}>▶</button>
          <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>
            {readout ?? "Mueve el control para recorrer la curva."}
          </div>
        </div>
      )}
    </div>
  );
}

export function MdText({ text, variant = "default", userDirectory }: { text: string; variant?: "default" | "inverted"; userDirectory?: UserDirectory }) {
  const blocks = useMemo(() => {
    if (text.length > MAX_PARSE_LENGTH) {
      return [{ type: "text" as const, value: text }];
    }
    return parseBlocks(text);
  }, [text]);
  const inverted = variant === "inverted";

  function splitInlineMath(value: string): Array<{ type: "text" | "math"; value: string }> {
    const parts: Array<{ type: "text" | "math"; value: string }> = [];
    let cursor = 0;
    let textStart = 0;
    function canOpenDollar(idx: number) {
      const prev = value[idx - 1] ?? "";
      const next = value[idx + 1] ?? "";
      return next !== "" && !/\s|\$/.test(next) && !/[A-Za-z0-9_\])]/.test(prev);
    }
    function canCloseDollar(idx: number) {
      const prev = value[idx - 1] ?? "";
      const next = value[idx + 1] ?? "";
      return prev !== "" && !/\s/.test(prev) && !/[A-Za-z0-9_[(]/.test(next);
    }
    while (cursor < value.length) {
      if (value.startsWith("\\(", cursor)) {
        const end = value.indexOf("\\)", cursor + 2);
        if (end !== -1) {
          if (cursor > textStart) parts.push({ type: "text", value: value.slice(textStart, cursor) });
          parts.push({ type: "math", value: value.slice(cursor + 2, end).trim() });
          cursor = end + 2;
          textStart = cursor;
          continue;
        }
      }
      if (value[cursor] === "$" && canOpenDollar(cursor)) {
        let end = cursor + 1;
        while (end < value.length) {
          if (value[end] === "$" && value[end - 1] !== "\\" && canCloseDollar(end)) break;
          end += 1;
        }
        if (end < value.length && value[end] === "$") {
          if (cursor > textStart) parts.push({ type: "text", value: value.slice(textStart, cursor) });
          parts.push({ type: "math", value: value.slice(cursor + 1, end).trim() });
          cursor = end + 1;
          textStart = cursor;
          continue;
        }
      }
      cursor += 1;
    }
    if (textStart < value.length) parts.push({ type: "text", value: value.slice(textStart) });
    return parts.filter((part) => part.value.length > 0);
  }

  function renderInline(value: string, keyPrefix: string) {
    const parts = splitInlineMath(value);
    return parts.flatMap((part, partIdx) => {
      if (part.type === "math") {
        return [
          <span
            key={`${keyPrefix}-math-${partIdx}`}
            style={{ display: "inline-block", verticalAlign: "middle", margin: "0 2px" }}
            dangerouslySetInnerHTML={{ __html: renderKatex(part.value, false) }}
          />,
        ];
      }
      const segments = parseMd(part.value, userDirectory);
      return segments.map((seg, i) => {
      const key = `${keyPrefix}-${partIdx}-${i}`;
      if (seg.type === "bold") {
        return <strong key={key} style={{ fontWeight: 700, color: "inherit" }}>{seg.value}</strong>;
      }
      if (seg.type === "italic") {
        return <em key={key} style={{ fontStyle: "italic" }}>{seg.value}</em>;
      }
      if (seg.type === "agent-mention") {
        const label = AGENT_FULL_LABELS[seg.agentId] ?? seg.agentId.toUpperCase();
        if (inverted) {
          return <span key={key} style={INVERTED_CHIP}>{label}</span>;
        }
        const c = AGENT_COLORS[seg.agentId] ?? AGENT_COLORS.gg;
        return (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, lineHeight: 1.6, margin: "0 1px" }}>
            {label}
          </span>
        );
      }
      if (seg.type === "project-mention") {
        if (inverted) {
          return <span key={key} style={INVERTED_CHIP}>@{seg.projectId}</span>;
        }
        return (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, fontFamily: "var(--mono)", lineHeight: 1.6, margin: "0 1px" }}>
            @{seg.projectId}
          </span>
        );
      }
      if (seg.type === "code-link") {
        const linkStyle: CSSProperties = inverted
          ? { ...INVERTED_CHIP, textDecoration: "underline", cursor: "pointer" }
          : {
              display: "inline-flex",
              alignItems: "center",
              background: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
              borderRadius: 4,
              padding: "0 5px",
              fontSize: "0.92em",
              fontWeight: 800,
              fontFamily: "var(--mono)",
              lineHeight: 1.6,
              margin: "0 1px",
              textDecoration: "none",
            };
        return (
          <a key={key} href={seg.href} style={linkStyle} title={`Abrir ${seg.code}`}>
            {seg.code}
          </a>
        );
      }
      if (seg.type === "user-mention") {
        if (inverted) {
          return <span key={key} title={seg.email} style={INVERTED_CHIP}>@{seg.displayName}</span>;
        }
        return (
          <span key={key} title={seg.email} style={{ display: "inline-flex", alignItems: "center", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 700, lineHeight: 1.6, margin: "0 1px" }}>
            @{seg.displayName}
          </span>
        );
      }
      if (seg.type === "team-mention") {
        if (inverted) {
          return <span key={key} style={{ ...INVERTED_CHIP, fontWeight: 800 }}>@Todos</span>;
        }
        return (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 4, padding: "0 5px", fontSize: "0.9em", fontWeight: 800, lineHeight: 1.6, margin: "0 1px" }}>
            @Todos
          </span>
        );
      }
      if (seg.type === "break") {
        return <br key={key} />;
      }
      return <span key={key}>{seg.value}</span>;
      });
    });
  }

  function renderTextBlock(value: string, keyPrefix: string) {
    const lines = value.split("\n");
    return (
      <div style={{ display: "grid", gap: 5 }}>
        {lines.map((line, idx) => {
          const bullet = line.match(/^\s*(?:[-•])\s+(.+)$/);
          if (!line.trim()) return <div key={`${keyPrefix}-blank-${idx}`} style={{ height: 4 }} />;
          if (bullet) {
            return (
              <div key={`${keyPrefix}-line-${idx}`} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 4, alignItems: "start" }}>
                <span style={{ color: "var(--t3)", lineHeight: 1.55 }}>•</span>
                <span>{renderInline(bullet[1], `${keyPrefix}-b-${idx}`)}</span>
              </div>
            );
          }
          return <div key={`${keyPrefix}-line-${idx}`}>{renderInline(line, `${keyPrefix}-l-${idx}`)}</div>;
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {blocks.map((block, blockIdx) => {
        if (block.type === "text") {
          return <div key={blockIdx}>{renderTextBlock(block.value, `text-${blockIdx}`)}</div>;
        }
        if (block.type === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={blockIdx}
              src={block.src}
              alt={block.alt}
              style={{
                maxWidth: "min(100%, 420px)",
                maxHeight: 260,
                objectFit: "contain",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--bg-subtle)",
                padding: 6,
              }}
              loading="lazy"
            />
          );
        }
        if (block.type === "math") {
          return (
            <div
              key={blockIdx}
              style={{ overflowX: "auto", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: inverted ? "rgba(255,255,255,.08)" : "var(--bg-subtle)" }}
              dangerouslySetInnerHTML={{ __html: renderKatex(block.value, true) }}
            />
          );
        }
        if (block.type === "htmlApp") {
          return <HtmlAppBlock key={blockIdx} code={block.value} />;
        }
        if (block.type === "mermaid") {
          return <MermaidBlock key={blockIdx} code={block.value} />;
        }
        if (block.type === "plot") {
          return <PlotBlock key={blockIdx} kind={block.kind} code={block.value} />;
        }
        return (
          <div key={blockIdx} style={{ maxWidth: "100%", overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8, background: inverted ? "rgba(255,255,255,.08)" : "var(--bg-card)" }}>
            <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {block.headers.map((header, idx) => (
                    <th key={idx} style={{ textAlign: "left", padding: "7px 9px", borderBottom: "1px solid var(--border)", background: inverted ? "rgba(255,255,255,.14)" : "var(--bg-subtle)", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {renderInline(header, `table-${blockIdx}-h-${idx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {block.headers.map((_, cellIdx) => (
                      <td key={cellIdx} style={{ padding: "7px 9px", borderTop: rowIdx === 0 ? "none" : "1px solid var(--border)", verticalAlign: "top" }}>
                        {renderInline(row[cellIdx] ?? "", `table-${blockIdx}-r-${rowIdx}-${cellIdx}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
