import { useEffect, useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import AgentPicker from './AgentPicker';
import StatusTimeline from './StatusTimeline';
import ActivityLog from './ActivityLog';
import { ProgressDetail } from './ProgressFeed';

/* ── Constants ────────────────────────────────────────────── */

const GHERKIN_KEYWORDS = [
  { pattern: /^(\s*)(Feature:)(.*)/, style: { color: "#6A1B9A", fontWeight: 700, fontSize: 15 } },
  { pattern: /^(\s*)(Scenario Outline:)(.*)/, style: { color: "#1565C0", fontWeight: 700 } },
  { pattern: /^(\s*)(Background:|Scenario:)(.*)/, style: { color: "#1565C0", fontWeight: 700 } },
  { pattern: /^(\s*)(Given )(.*)/, style: { color: "#2E7D32", fontWeight: 600 } },
  { pattern: /^(\s*)(When )(.*)/, style: { color: "#E65100", fontWeight: 600 } },
  { pattern: /^(\s*)(Then )(.*)/, style: { color: "#1565C0", fontWeight: 600 } },
  { pattern: /^(\s*)(And |But )(.*)/, style: { color: "#757575", fontWeight: 600 } },
];
const GHERKIN_TEST = /^(Given|When|Then|And|But|Scenario|Background|Feature|Scenario Outline|Examples)\b/;

const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊", ifra: "🛠️" };
const AGENT_ROLES = { neo: "Builder", alpha: "Leader", beta: "QA", mu: "Builder", flow: "Orchestrator", ifra: "Ops" };

const STATUS_CONFIG = {
  todo:        { bg: "#79747E14", color: "#79747E", label: "Todo",        accent: "#79747E" },
  assigned:    { bg: "#6750A414", color: "#6750A4", label: "Assigned",    accent: "#6750A4" },
  in_progress: { bg: "#E8A31714", color: "#E8A317", label: "In Progress", accent: "#D97706" },
  running:     { bg: "#E8A31714", color: "#E8A317", label: "Running",     accent: "#D97706" },

  qa:          { bg: "#5E35B114", color: "#5E35B1", label: "QA",          accent: "#5E35B1" },
  qa_testing:  { bg: "#5E35B114", color: "#5E35B1", label: "QA Testing",  accent: "#5E35B1" },
  completed:   { bg: "#1B5E2014", color: "#1B5E20", label: "Completed",   accent: "#1B5E20" },
  failed:      { bg: "#BA1A1A14", color: "#BA1A1A", label: "Failed",      accent: "#BA1A1A" },
  deployed:    { bg: "#00838F14", color: "#00838F", label: "Deployed",    accent: "#00838F" },
  deprecated:  { bg: "#9E9E9E14", color: "#9E9E9E", label: "Deprecated",  accent: "#9E9E9E" },
};

const PRIORITY_CONFIG = {
  urgent: { bg: "#D32F2F14", color: "#D32F2F", label: "Urgent", icon: "🔴" },
  high:   { bg: "#E6510014", color: "#E65100", label: "High", icon: "🟠" },
  normal: null,
  low:    { bg: "#75757514", color: "#757575", label: "Low", icon: "⚪" },
};

const TYPE_COLORS = {
  coding: "#6750A4", research: "#0061A4", ops: "#7D5260", general: "#79747E", test: "#386A20",
};

const STAGE_COLORS = {
  refinery: "#E65100", foundry: "#1565C0", builder: "#2E7D32", inspector: "#6A1B9A", deployer: "#00838F",
};
const STAGES = ["refinery", "foundry", "builder", "inspector", "deployer"];
const STAGE_LABELS = { refinery: "Refine", foundry: "Found", builder: "Build", inspector: "Inspect", deployer: "Deploy" };
const ACTIVE_STATUSES = new Set(["in_progress", "assigned", "running", "qa_testing", "completed"]);

const HAS_MARKDOWN = /[#*`\[|]/;

const TIMELINE_STEPS = [
  { key: 'created', label: 'Created', statuses: ['todo', 'assigned', 'in_progress', 'running', 'completed', 'failed', 'qa', 'qa_testing', 'deployed'] },
  { key: 'assigned', label: 'Assigned', statuses: ['assigned', 'in_progress', 'running', 'completed', 'failed', 'qa', 'qa_testing', 'deployed'] },
  { key: 'in_progress', label: 'Working', statuses: ['in_progress', 'running', 'completed', 'failed', 'qa', 'qa_testing', 'deployed'] },
  { key: 'qa_testing', label: 'QA Testing', statuses: ['qa_testing', 'completed', 'failed', 'deployed'] },
  { key: 'qa', label: 'QA', statuses: ['qa', 'completed', 'deployed'] },
  { key: 'completed', label: 'Complete', statuses: ['completed', 'deployed'] },
];

/* ── Styles ────────────────────────────────────────────────── */

const MODAL_STYLE_ID = 'task-modal-styles';
function ensureModalStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MODAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.textContent = `
    @keyframes timeline-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
      50% { box-shadow: 0 0 0 6px rgba(217, 119, 6, 0); }
    }
    .timeline-pulse { animation: timeline-pulse 2s ease-in-out infinite; }

    @keyframes tdm-overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes tdm-panel-in {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes tdm-slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    @keyframes tdm-accent-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .tdm-overlay { animation: tdm-overlay-in 0.2s ease-out; }
    .tdm-panel { animation: tdm-panel-in 0.28s cubic-bezier(0.16, 1, 0.3, 1); }
    .tdm-mobile-panel { animation: tdm-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

    .tdm-md table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
    .tdm-md table th, .tdm-md table td { border: 1px solid var(--md-surface-variant, #E7E0EC); padding: 6px 10px; text-align: left; }
    .tdm-md table th { background: var(--md-surface-container-low, #F7F2FA); font-weight: 600; }
    .tdm-md table tr:nth-child(even) td { background: var(--md-surface, #FFFBFE); }
    .tdm-md blockquote { border-left: 3px solid var(--md-primary, #6750A4); background: var(--md-surface-container-low, #F7F2FA); margin: 8px 0; padding: 8px 16px; border-radius: 0 8px 8px 0; }
    .tdm-md a { color: var(--md-primary, #6750A4); text-decoration: underline; text-underline-offset: 2px; }
    .tdm-md a:hover { opacity: 0.8; }
    .tdm-md pre { background: var(--md-surface-container-low, #F7F2FA); border-radius: 8px; padding: 12px; overflow-x: auto; font-size: 13px; }
    .tdm-md code { font-family: 'Roboto Mono', 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.9em; }
    .tdm-md code:not(pre code) { background: var(--md-surface-container-low, #F7F2FA); padding: 2px 6px; border-radius: 4px; }

    .tdm-json-toggle { cursor: pointer; user-select: none; opacity: 0.5; font-size: 10px; display: inline-block; width: 14px; text-align: center; margin-right: 2px; transition: transform 0.15s, opacity 0.15s; }
    .tdm-json-toggle:hover { opacity: 1; }
    .tdm-copy-btn { position: absolute; top: 8px; right: 8px; background: var(--md-surface-container-low, #F7F2FA); border: 1px solid var(--md-surface-variant, #E7E0EC); border-radius: 8px; padding: 4px 10px; font-size: 11px; cursor: pointer; opacity: 0; transition: opacity 0.15s; font-family: 'Roboto', system-ui, sans-serif; }
    .tdm-copy-btn:hover { opacity: 1 !important; }
    div:hover > .tdm-copy-btn { opacity: 0.7; }

    .tdm-stage-select {
      appearance: none; -webkit-appearance: none;
      padding: 5px 24px 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
      border: 1px solid var(--md-surface-variant, #E7E0EC);
      background-color: var(--md-surface, #FFFBFE);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2379747E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 6px center;
      cursor: pointer; font-family: inherit; outline: none;
      text-transform: uppercase; letter-spacing: 0.04em;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .tdm-stage-select:focus { border-color: var(--md-primary, #6750A4); box-shadow: 0 0 0 2px rgba(103, 80, 164, 0.1); }
    .tdm-stage-select:hover { border-color: var(--md-outline, #79747E); }

    .tdm-action-btn {
      border: none; padding: 8px 18px; border-radius: 100px; font-weight: 600; font-size: 13px;
      cursor: pointer; transition: all 0.15s; font-family: 'Roboto', system-ui, sans-serif;
      letter-spacing: 0.02em; display: inline-flex; align-items: center; gap: 6px;
    }
    .tdm-action-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .tdm-action-btn:active { transform: translateY(0); }

    .tdm-pill-tab {
      padding: 6px 14px; font-size: 12px; font-weight: 500; border: none;
      background: transparent; cursor: pointer; color: var(--md-outline, #79747E);
      border-radius: 100px; transition: all 0.15s;
      font-family: 'Roboto', system-ui, sans-serif; letter-spacing: 0.02em;
      position: relative;
    }
    .tdm-pill-tab:hover { color: var(--md-on-surface, #1C1B1F); background: var(--md-surface-container-low, #F7F2FA); }
    .tdm-pill-tab[data-active="true"] {
      color: var(--md-primary, #6750A4); background: rgba(103, 80, 164, 0.08);
      font-weight: 600;
    }

    .tdm-scrollbar::-webkit-scrollbar { width: 5px; }
    .tdm-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .tdm-scrollbar::-webkit-scrollbar-thumb { background: var(--md-surface-variant, #E7E0EC); border-radius: 3px; }
    .tdm-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--md-outline, #79747E); }

    .tdm-meta-cell { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; }
    .tdm-meta-label { font-size: 10px; font-weight: 500; color: var(--md-outline, #79747E); text-transform: uppercase; letter-spacing: 0.06em; }
    .tdm-meta-value { font-size: 13px; font-weight: 500; color: var(--md-on-surface, #1C1B1F); }

    .tdm-sidebar-card {
      background: var(--md-surface-container-low, #F7F2FA);
      border: 1px solid var(--md-surface-variant, #E7E0EC);
      border-radius: 12px; padding: 12px;
    }

    .tdm-kbd {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 18px; padding: 0 5px;
      background: var(--md-surface-container-low, #F7F2FA);
      border: 1px solid var(--md-surface-variant, #E7E0EC);
      border-radius: 4px; font-size: 10px; font-weight: 600;
      font-family: 'Roboto Mono', monospace;
      color: var(--md-outline, #79747E);
      line-height: 1;
    }

    .tdm-section-toggle {
      cursor: pointer; user-select: none; display: flex; align-items: center; gap: 6px;
      padding: 4px 0; transition: opacity 0.15s;
    }
    .tdm-section-toggle:hover { opacity: 0.7; }

    .tdm-live-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #22C55E;
      animation: tdm-live-blink 2s ease-in-out infinite;
    }
    @keyframes tdm-live-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(ms) {
  if (!ms || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60); const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ── Gherkin ──────────────────────────────────────────────── */

function processGherkinText(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const result = [];
  let inGherkin = false;
  let gherkinBlock = [];
  function flush() {
    if (gherkinBlock.length > 0) {
      result.push('%%%GH_S%%%');
      gherkinBlock.forEach(l => result.push(l));
      result.push('%%%GH_E%%%');
      gherkinBlock = [];
    }
    inGherkin = false;
  }
  for (const line of lines) {
    const t = line.trimStart();
    if (GHERKIN_TEST.test(t)) { inGherkin = true; gherkinBlock.push(line); }
    else if (inGherkin && (t === '' || t.startsWith('|') || t.startsWith('#'))) { gherkinBlock.push(line); }
    else { flush(); result.push(line); }
  }
  flush();
  return result.join('\n');
}

function GherkinBlock({ text }) {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  return (
    <div style={{ borderRadius: 8, padding: '12px 16px', margin: '8px 0', borderLeft: '3px solid #2E7D32', background: 'rgba(46,125,50,0.04)', fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace", fontSize: 13 }}>
      {lines.map((line, i) => {
        for (const { pattern, style } of GHERKIN_KEYWORDS) {
          const m = line.match(pattern);
          if (m) return <div key={i} style={{ padding: '2px 0' }}>{m[1]}<span style={style}>{m[2]}</span><span style={{ color: '#5D4037' }}>{m[3]}</span></div>;
        }
        return <div key={i} style={{ padding: '2px 0', color: '#5D4037', paddingLeft: 16 }}>{line}</div>;
      })}
    </div>
  );
}

function MarkdownContent({ text }) {
  const processed = processGherkinText(text);
  const parts = processed.split(/(%%%GH_S%%%[\s\S]*?%%%GH_E%%%)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('%%%GH_S%%%')) {
          const inner = part.replace('%%%GH_S%%%\n', '').replace('\n%%%GH_E%%%', '').replace('%%%GH_S%%%', '').replace('%%%GH_E%%%', '');
          return <GherkinBlock key={i} text={inner} />;
        }
        if (part.trim() === '') return null;
        return (
          <div key={i} className="tdm-md" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--md-on-surface, #1C1B1F)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}
              components={{ a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
            >{part}</ReactMarkdown>
          </div>
        );
      })}
    </>
  );
}

/* ── JSON Viewer ──────────────────────────────────────────── */

function CollapsibleJson({ label, data, indent }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <span>
      <span className="tdm-json-toggle" onClick={() => setExpanded(e => !e)} style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
      {label}
      {expanded ? <JsonSyntax data={data} indent={indent} _skipBrace /> : <span style={{ color: '#79747E' }}>{Array.isArray(data) ? `[…${data.length}]` : `{…${Object.keys(data).length}}`}</span>}
    </span>
  );
}

function JsonSyntax({ data, indent = 0, _skipBrace = false }) {
  const pad = '\u00A0\u00A0'.repeat(indent);
  const padInner = '\u00A0\u00A0'.repeat(indent + 1);
  if (data === null) return <span style={{ color: '#BA1A1A' }}>null</span>;
  if (typeof data === 'boolean') return <span style={{ color: '#BA1A1A' }}>{String(data)}</span>;
  if (typeof data === 'number') return <span style={{ color: '#E8A317' }}>{String(data)}</span>;
  if (typeof data === 'string') return <span style={{ color: '#386A20' }}>"{data}"</span>;
  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#79747E' }}>[]</span>;
    if (_skipBrace) return (<span><span style={{ color: '#79747E' }}>[</span>{'\n'}{data.map((item, i) => (<span key={i}>{padInner}{item && typeof item === 'object' ? <CollapsibleJson label="" data={item} indent={indent + 1} /> : <JsonSyntax data={item} indent={indent + 1} />}{i < data.length - 1 ? <span style={{ color: '#79747E' }}>,</span> : null}{'\n'}</span>))}{pad}<span style={{ color: '#79747E' }}>]</span></span>);
    return <CollapsibleJson label="" data={data} indent={indent} />;
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span style={{ color: '#79747E' }}>{'{}'}</span>;
    if (_skipBrace) return (<span><span style={{ color: '#79747E' }}>{'{'}</span>{'\n'}{entries.map(([key, val], i) => (<span key={key}>{padInner}<span style={{ color: '#0061A4' }}>"{key}"</span><span style={{ color: '#79747E' }}>: </span>{val && typeof val === 'object' ? <CollapsibleJson label="" data={val} indent={indent + 1} /> : <JsonSyntax data={val} indent={indent + 1} />}{i < entries.length - 1 ? <span style={{ color: '#79747E' }}>,</span> : null}{'\n'}</span>))}{pad}<span style={{ color: '#79747E' }}>{'}'}</span></span>);
    return <CollapsibleJson label="" data={data} indent={indent} />;
  }
  return <span>{String(data)}</span>;
}

/* ── Result Display ───────────────────────────────────────── */

function ResultDisplay({ result, variant = "success" }) {
  const [copied, setCopied] = useState(false);
  const isError = variant === "error";
  const bgColor = isError ? "#BA1A1A06" : "#386A2006";
  const borderColor = isError ? "#BA1A1A18" : "#386A2018";

  if (!result) return <p style={{ fontSize: 13, color: 'var(--md-outline, #79747E)', fontStyle: 'italic' }}>No result yet</p>;

  let parsed = result;
  if (typeof result === 'string') {
    try { parsed = JSON.parse(result); } catch {
      if (HAS_MARKDOWN.test(result)) {
        return <div className="tdm-md" style={{ padding: 14, background: bgColor, borderRadius: 10, border: `1px solid ${borderColor}` }}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{result}</ReactMarkdown></div>;
      }
      return <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: 14, background: bgColor, borderRadius: 10, border: `1px solid ${borderColor}`, color: isError ? '#BA1A1A' : 'var(--md-on-surface, #1C1B1F)' }}>{result}</div>;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: 14, background: bgColor, borderRadius: 10, border: `1px solid ${borderColor}` }}>{String(parsed)}</div>;
  }

  const summaryMd = parsed.summary && typeof parsed.summary === 'string' && HAS_MARKDOWN.test(parsed.summary);
  const handleCopy = () => { navigator.clipboard.writeText(JSON.stringify(parsed, null, 2)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };

  return (
    <>
      {summaryMd && <div className="tdm-md" style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.7 }}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{parsed.summary}</ReactMarkdown></div>}
      <div style={{ position: 'relative' }}>
        <button className="tdm-copy-btn" onClick={handleCopy}>{copied ? '✓ Copied' : '📋 Copy'}</button>
        <pre style={{ fontSize: 12, fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', overflowX: 'auto', padding: '16px 16px 16px', paddingTop: 32, background: 'var(--md-surface-container-low, #F7F2FA)', borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)', margin: 0, lineHeight: 1.6 }}>
          <JsonSyntax data={parsed} indent={0} />
        </pre>
      </div>
    </>
  );
}

/* ── Badges ───────────────────────────────────────────────── */

function Badge({ label, color, bg, style: extra }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 100,
      background: bg || `${color}14`, color,
      textTransform: "uppercase", letterSpacing: "0.04em",
      lineHeight: 1.2, whiteSpace: "nowrap",
      fontFamily: "'Roboto', system-ui, sans-serif",
      display: "inline-block", ...extra,
    }}>{label}</span>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.todo;
  return <Badge label={c.label || status.replace("_", " ")} color={c.color} bg={c.bg} />;
}

function PriorityBadge({ priority }) {
  if (!priority || priority === 'normal') return null;
  const c = PRIORITY_CONFIG[priority];
  if (!c) return null;
  return <Badge label={`${c.icon} ${c.label}`} color={c.color} bg={c.bg} />;
}

/* ── Duration Ticker ──────────────────────────────────────── */

function DurationTicker({ task, compact }) {
  const [now, setNow] = useState(Date.now());
  const active = ACTIVE_STATUSES.has(task.status);
  useEffect(() => {
    if (!active || !task.created_at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, task.created_at]);

  if (!task.created_at) return null;
  const end = task.completed_at ? new Date(task.completed_at) : (active ? now : new Date(task.updated_at || task.created_at));
  const elapsed = end - new Date(task.created_at).getTime();
  return (
    <span style={{
      fontSize: compact ? 12 : 13, fontWeight: 600, fontVariantNumeric: "tabular-nums",
      color: active ? "#D97706" : "var(--md-on-surface-variant, #49454F)",
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {!compact && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
      )}
      {formatDuration(elapsed)}
    </span>
  );
}

/* ── Pipeline Stepper ─────────────────────────────────────── */

function PipelineStepper({ stage }) {
  if (!stage) return null;
  const currentIdx = STAGES.indexOf(stage);
  if (currentIdx === -1) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, padding: "4px 0" }}>
      {STAGES.map((s, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        const color = isCurrent ? (STAGE_COLORS[s] || "#79747E") : isCompleted ? "#386A20" : "var(--md-outline-variant, #CAC4D0)";
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36, gap: 3 }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%", border: `2px solid ${color}`,
                background: (isCompleted || isCurrent) ? color : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                animation: isCurrent ? "timeline-pulse 2s ease-in-out infinite" : "none",
              }}>
                {isCompleted && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span style={{ fontSize: 9, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? color : isCompleted ? "#386A20" : "var(--md-outline-variant, #CAC4D0)", letterSpacing: "0.03em", whiteSpace: "nowrap", textTransform: "uppercase" }}>{STAGE_LABELS[s]}</span>
            </div>
            {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, minWidth: 6, background: isCompleted ? "#386A20" : "var(--md-surface-variant, #E7E0EC)", marginTop: -10, borderRadius: 1 }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Timeline (vertical, compact) ─────────────────────────── */

function getStepTime(task, key) {
  if (key === 'created') return task.created_at;
  if (key === 'completed' || key === 'qa_testing') return task.completed_at;
  return task.updated_at;
}

function Timeline({ task }) {
  const status = task.status || 'todo';
  const isFailed = status === 'failed';
  const steps = isFailed
    ? [...TIMELINE_STEPS.slice(0, 4), { key: 'failed', label: 'Failed', statuses: ['failed'] }]
    : TIMELINE_STEPS;
  const activeIdx = steps.reduce((last, s, i) => s.statuses.includes(status) ? i : last, -1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((step, i) => {
        const isCompleted = i < activeIdx;
        const isCurrent = i === activeIdx;
        const isFail = step.key === 'failed';
        const stepColor = isFail ? '#BA1A1A' : isCompleted ? '#386A20' : isCurrent ? (STATUS_CONFIG[status]?.color || '#E8A317') : 'var(--md-outline-variant, #CAC4D0)';
        const stepTime = (isCompleted || isCurrent) ? getStepTime(task, step.key) : null;

        return (
          <div key={step.key}>
            {i > 0 && (
              <div style={{ paddingLeft: 7 }}>
                <div style={{ width: 2, height: 10, backgroundColor: isCompleted ? '#386A20' : 'var(--md-surface-variant, #E7E0EC)', borderRadius: 1 }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={isCurrent && !isFail ? 'timeline-pulse' : undefined} style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: (isCompleted || isCurrent) ? stepColor : 'transparent',
                border: (isCompleted || isCurrent) ? 'none' : `2px solid ${stepColor}`,
              }}>
                {isCompleted && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
                {isFail && isCurrent && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>}
                {isCurrent && !isCompleted && !isFail && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />}
              </div>
              <span style={{ fontSize: 11, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'var(--md-on-surface, #1C1B1F)' : isCompleted ? 'var(--md-on-surface-variant, #49454F)' : 'var(--md-outline-variant, #CAC4D0)' }}>{step.label}</span>
              {stepTime && <span style={{ fontSize: 9, color: 'var(--md-outline, #79747E)', fontFamily: "'Roboto Mono', monospace", marginLeft: 'auto' }}>{formatDate(stepTime)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Section Header ───────────────────────────────────────── */

function SectionLabel({ children, icon, color, collapsible, collapsed, onToggle }) {
  const inner = (
    <>
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
      {children}
      {collapsible && (
        <span style={{ fontSize: 9, opacity: 0.6, transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
      )}
    </>
  );
  const baseStyle = {
    fontSize: 10, fontWeight: 600, color: color || 'var(--md-outline, #79747E)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: collapsed ? 0 : 6,
    display: 'flex', alignItems: 'center', gap: 5,
  };

  if (collapsible) {
    return <div className="tdm-section-toggle" style={baseStyle} onClick={onToggle}>{inner}</div>;
  }
  return <div style={baseStyle}>{inner}</div>;
}

/* ── Meta Cell (for grid layout) ──────────────────────────── */

function MetaCell({ label, children }) {
  return (
    <div className="tdm-meta-cell">
      <span className="tdm-meta-label">{label}</span>
      <span className="tdm-meta-value">{children}</span>
    </div>
  );
}

/* ── Smart Retry Info ─────────────────────────────────────── */

function SmartRetryInfo({ metadata }) {
  if (!metadata?.smart_retry) return null;
  const sr = metadata.smart_retry;
  return (
    <div style={{ padding: 10, background: '#E6510008', borderRadius: 10, border: '1px solid #E6510018', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: '#E65100', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔄 Smart Retry</div>
      {sr.reasoning && <div style={{ color: 'var(--md-on-surface-variant, #49454F)', lineHeight: 1.5 }}>{sr.reasoning}</div>}
      {sr.recommended_agent && <div style={{ marginTop: 4, color: 'var(--md-outline, #79747E)', fontSize: 11 }}>→ Routed to <strong>{sr.recommended_agent}</strong></div>}
    </div>
  );
}

/* ── Main Modal ───────────────────────────────────────────── */

export default function TaskDetailModal({ task, onClose, onStatusChange, isMobile, isTablet, progress, monitor }) {
  const [closing, setClosing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [idCopied, setIdCopied] = useState(false);
  const [deprecateConfirm, setDeprecateConfirm] = useState(false);
  const [deprecating, setDeprecating] = useState(false);
  const [deprecateError, setDeprecateError] = useState(null);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [assignErr, setAssignErr] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState(null);
  const [deploySuccess, setDeploySuccess] = useState(false);

  useEffect(() => { ensureModalStyles(); }, []);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const toggleSection = (key) => setCollapsedSections(s => ({ ...s, [key]: !s[key] }));

  const copyId = () => {
    navigator.clipboard.writeText(task.id).then(() => { setIdCopied(true); setTimeout(() => setIdCopied(false), 1200); }).catch(() => {});
  };

  const handleDeprecate = async () => {
    if (!deprecateConfirm) { setDeprecateConfirm(true); return; }
    setDeprecating(true);
    setDeprecateError(null);
    try {
      await onStatusChange(task.id, { status: 'deprecated' });
      handleClose();
    } catch (err) {
      setDeprecating(false);
      setDeprecateConfirm(false);
      setDeprecateError(err.message || "Failed to deprecate task");
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployError(null);
    setDeploySuccess(false);
    try {
      const resp = await fetch(`/api/deploy/${task.id}`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Deploy failed (HTTP ${resp.status})`);
      }
      setDeploySuccess(true);
      // Auto-close after success so the board refreshes
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      setDeployError(e.message || "Deploy failed");
      setTimeout(() => setDeployError(null), 5000);
    } finally {
      setDeploying(false);
    }
  };

  if (!task) return null;

  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";
  const role = AGENT_ROLES[agent] || "Agent";
  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const typeColor = TYPE_COLORS[task.type] || "#79747E";
  const isActive = ACTIVE_STATUSES.has(task.status);
  const hasResult = !!task.result;
  const hasError = !!task.error;
  const hasQA = !!task.qa_result;
  const hasCriteria = !!task.acceptance_criteria;
  const hasDescription = !!task.description;
  const hasMetadata = !!task.metadata && typeof task.metadata === 'object' && Object.keys(task.metadata).length > 0;

  const tabs = [{ key: 'details', label: 'Details' }];
  tabs.push({ key: 'activity', label: 'Activity' });
  if (hasResult || hasError) tabs.push({ key: 'output', label: hasError ? '⚠ Output' : 'Output' });
  if (hasQA) tabs.push({ key: 'qa', label: 'QA' });
  if (hasMetadata) tabs.push({ key: 'meta', label: 'Meta' });

  const useWideLayout = !isMobile && !isTablet;

  /* ── Overlay ──────────────────────────────────────────── */

  const overlayStyle = isMobile ? {
    position: "fixed", inset: 0, background: "var(--md-background, #FFFBFE)", zIndex: 200,
    display: "flex", flexDirection: "column",
    opacity: closing ? 0 : 1, transition: 'opacity 0.2s',
  } : {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
    opacity: closing ? 0 : 1, transition: 'opacity 0.2s',
  };

  const panelStyle = isMobile ? {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
    fontFamily: "'Roboto', system-ui, -apple-system, sans-serif",
  } : {
    background: "var(--md-surface, #FFFBFE)", borderRadius: 16, padding: 0,
    width: useWideLayout ? 900 : 700, maxWidth: "94vw",
    maxHeight: "90vh", overflow: "hidden",
    boxShadow: "0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
    transform: closing ? 'translateY(8px) scale(0.97)' : 'none',
    transition: 'transform 0.2s',
    fontFamily: "'Roboto', system-ui, -apple-system, sans-serif",
    display: "flex", flexDirection: "column",
  };

  /* ── Sidebar content ──────────────────────────────────── */
  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Agent card */}
      {agent && (
        <div className="tdm-sidebar-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                fontSize: 16, width: 32, height: 32, borderRadius: '50%',
                background: 'var(--md-surface, #FFFBFE)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--md-surface-variant, #E7E0EC)',
              }}>{icon}</span>
              {isActive && <div className="tdm-live-dot" style={{ position: 'absolute', bottom: -1, right: -1, border: '2px solid var(--md-surface-container-low, #F7F2FA)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface, #1C1B1F)' }}>{agent}</div>
              <div style={{ fontSize: 10, color: 'var(--md-outline, #79747E)' }}>{role}</div>
            </div>
            <DurationTicker task={task} compact />
          </div>
        </div>
      )}

      {/* Compact meta grid */}
      <div className="tdm-sidebar-card" style={{ padding: '4px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <MetaCell label="Type">
            <span style={{ color: typeColor, fontWeight: 600 }}>{task.type}</span>
          </MetaCell>
          <MetaCell label="Priority">
            {task.priority && task.priority !== 'normal'
              ? <span style={{ color: PRIORITY_CONFIG[task.priority]?.color }}>{PRIORITY_CONFIG[task.priority]?.icon} {task.priority}</span>
              : <span style={{ color: 'var(--md-outline, #79747E)' }}>Normal</span>
            }
          </MetaCell>
          {task.dispatched_by && (
            <MetaCell label="Owner">{task.dispatched_by}</MetaCell>
          )}
          {task.project && (
            <MetaCell label="Project">{task.project.name}</MetaCell>
          )}
          {task.pull_request_url?.length > 0 && (
            <MetaCell label={task.pull_request_url.length > 1 ? "Pull Requests" : "Pull Request"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(Array.isArray(task.pull_request_url) ? task.pull_request_url : [task.pull_request_url]).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#6750A4", textDecoration: "none", fontWeight: 500, fontSize: 13 }}>
                    {url.match(/\/([^/]+)\/pull\/(\d+)/)?.[0]?.replace(/^\//, "") || "View PR"} ↗
                  </a>
                ))}
              </div>
            </MetaCell>
          )}
          <MetaCell label="Created">
            <span title={task.created_at}>{formatDateShort(task.created_at)}</span>
          </MetaCell>
          {task.completed_at && (
            <MetaCell label="Finished">
              <span title={task.completed_at}>{formatDateShort(task.completed_at)}</span>
            </MetaCell>
          )}
        </div>

        {/* Stage selector */}
        <div style={{ borderTop: '1px solid var(--md-surface-variant, #E7E0EC)', paddingTop: 8, paddingBottom: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="tdm-meta-label">Stage</span>
            <select
              className="tdm-stage-select"
              value={task.stage || ""}
              onChange={e => onStatusChange(task.id, { stage: e.target.value || null })}
              onClick={e => e.stopPropagation()}
              style={{ color: task.stage ? (STAGE_COLORS[task.stage] || 'var(--md-on-surface-variant, #49454F)') : 'var(--md-outline, #79747E)' }}
            >
              <option value="">None</option>
              {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Pipeline stepper */}
      {task.stage && (
        <div className="tdm-sidebar-card">
          <SectionLabel icon="🔄">Pipeline</SectionLabel>
          <PipelineStepper stage={task.stage} />
        </div>
      )}

      {/* Timeline */}
      <div className="tdm-sidebar-card">
        <SectionLabel icon="⏱️" collapsible collapsed={collapsedSections.timeline} onToggle={() => toggleSection('timeline')}>Timeline</SectionLabel>
        {!collapsedSections.timeline && (
          task.status_history && task.status_history.length > 0
            ? <StatusTimeline task={task} />
            : <Timeline task={task} />
        )}
      </div>

      {/* Live Progress Feed */}
      {isActive && (progress || monitor) && (
        <ProgressDetail progress={progress} monitor={monitor} />
      )}

      {/* Smart retry */}
      <SmartRetryInfo metadata={task.metadata} />

      {/* Task ID */}
      <div
        onClick={copyId}
        style={{
          fontSize: 9, color: 'var(--md-outline, #79747E)', fontFamily: "'Roboto Mono', monospace",
          wordBreak: 'break-all', opacity: 0.6, cursor: 'pointer',
          padding: '4px 0', transition: 'opacity 0.15s',
        }}
        title="Click to copy task ID"
      >
        {idCopied ? '✓ Copied!' : task.id}
      </div>
    </div>
  );

  /* ── Tab content ──────────────────────────────────────── */
  const tabContent = (
    <div>
      {activeTab === 'details' && (
        <>
          {hasDescription && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel icon="📝" collapsible collapsed={collapsedSections.desc} onToggle={() => toggleSection('desc')}>Description</SectionLabel>
              {!collapsedSections.desc && (
                <div style={{ padding: 14, background: 'var(--md-surface-container-low, #F7F2FA)', borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)' }}>
                  <MarkdownContent text={task.description} />
                </div>
              )}
            </div>
          )}
          {hasCriteria && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel icon="✅" color="#E65100" collapsible collapsed={collapsedSections.criteria} onToggle={() => toggleSection('criteria')}>Acceptance Criteria</SectionLabel>
              {!collapsedSections.criteria && (
                <div style={{ padding: 14, background: '#E6510006', borderRadius: 10, border: '1px solid #E6510018' }}>
                  <MarkdownContent text={task.acceptance_criteria} />
                </div>
              )}
            </div>
          )}
          {!hasDescription && !hasCriteria && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--md-outline, #79747E)', fontSize: 13, fontStyle: 'italic' }}>
              No description or acceptance criteria provided.
            </div>
          )}
        </>
      )}

      {activeTab === 'output' && (
        <>
          {hasResult && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel icon="✓" color="#386A20">Result</SectionLabel>
              <ResultDisplay result={task.result} variant="success" />
            </div>
          )}
          {hasError && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel icon="✕" color="#BA1A1A">Error</SectionLabel>
              <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: 14, background: '#BA1A1A06', borderRadius: 10, border: '1px solid #BA1A1A18', color: '#BA1A1A' }}>{task.error}</div>
            </div>
          )}
        </>
      )}

      {activeTab === 'qa' && hasQA && (
        <div>
          <SectionLabel icon={task.qa_result.passed ? "✓" : "✕"} color={task.qa_result.passed ? "#386A20" : "#BA1A1A"}>
            {task.qa_result.passed ? "QA Passed" : "QA Failed"}
          </SectionLabel>
          <ResultDisplay result={task.qa_result} variant={task.qa_result.passed ? "success" : "error"} />
        </div>
      )}

      {activeTab === 'activity' && (
        <ActivityLog taskId={task.id} />
      )}

      {activeTab === 'meta' && hasMetadata && (
        <div>
          <SectionLabel icon="🔧">Task Metadata</SectionLabel>
          <div style={{ position: 'relative' }}>
            <pre style={{ fontSize: 12, fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', overflowX: 'auto', padding: 14, background: 'var(--md-surface-container-low, #F7F2FA)', borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)', margin: 0, lineHeight: 1.6 }}>
              <JsonSyntax data={task.metadata} indent={0} />
            </pre>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={isMobile ? 'tdm-mobile-panel' : 'tdm-overlay'} style={overlayStyle} onClick={isMobile ? undefined : handleClose}>
      <div className={isMobile ? undefined : 'tdm-panel'} style={panelStyle} onClick={e => e.stopPropagation()}>

        {/* ── Status accent bar ───────────────────────────── */}
        {!isMobile && (
          <div style={{
            height: 3, borderRadius: '16px 16px 0 0', flexShrink: 0,
            background: `linear-gradient(90deg, ${sc.accent || sc.color}, ${sc.accent || sc.color}88)`,
          }} />
        )}

        {/* ── Header ──────────────────────────────────────── */}
        <div style={{
          padding: isMobile ? "12px 16px 0" : "20px 24px 0",
          flexShrink: 0,
        }}>
          {/* Top row: badges + close */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={task.status} />
              <Badge label={task.type} color={typeColor} />
              <PriorityBadge priority={task.priority} />
              {isActive && !isMobile && !useWideLayout && <DurationTicker task={task} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {!isMobile && <span className="tdm-kbd">esc</span>}
              <button onClick={handleClose} style={{
                background: "transparent", border: "1px solid var(--md-surface-variant, #E7E0EC)",
                cursor: "pointer", fontSize: 12, color: "var(--md-outline, #79747E)", padding: 0,
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-low, #F7F2FA)'; e.currentTarget.style.color = 'var(--md-on-surface, #1C1B1F)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--md-outline, #79747E)'; }}
              >✕</button>
            </div>
          </div>

          {/* Title */}
          <h2 style={{
            margin: '0 0 12px', fontSize: isMobile ? 17 : 20, fontWeight: 700, lineHeight: 1.3,
            color: "var(--md-on-surface, #1C1B1F)", letterSpacing: '-0.015em',
          }}>
            {task.title}
          </h2>

          {/* Pill tabs */}
          <div style={{ display: 'flex', gap: 4, paddingBottom: 12, borderBottom: '1px solid var(--md-surface-variant, #E7E0EC)' }}>
            {tabs.map(t => (
              <button key={t.key} className="tdm-pill-tab" data-active={activeTab === t.key ? "true" : "false"} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="tdm-scrollbar" style={{
          flex: 1, overflowY: 'auto', minHeight: 0,
          padding: isMobile ? "14px 16px 80px" : "18px 24px 24px",
        }}>
          {useWideLayout ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
              <div>{tabContent}</div>
              <div style={{ position: 'sticky', top: 0 }}>{sidebarContent}</div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>{sidebarContent}</div>
              {tabContent}
            </div>
          )}
        </div>

        {/* ── Action Footer ───────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: isMobile ? '8px 16px' : '8px 24px',
          background: 'var(--md-surface, #FFFBFE)',
          borderTop: '1px solid var(--md-surface-variant, #E7E0EC)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          {task.status === "todo" && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button className="tdm-action-btn" disabled={assigningAgent}
                onClick={() => setShowAssignPicker(!showAssignPicker)}
                style={{ background: assigningAgent ? 'var(--md-outline, #79747E)' : 'var(--md-primary, #6750A4)', color: 'var(--md-on-primary, #fff)', minHeight: isMobile ? 42 : 36, opacity: assigningAgent ? 0.7 : 1 }}>
                {assigningAgent ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                )}
                {assigningAgent ? 'Assigning…' : 'Assign'}
              </button>
              {showAssignPicker && (
                <AgentPicker
                  onSelect={async (agentId) => {
                    setShowAssignPicker(false);
                    setAssigningAgent(true);
                    setAssignErr(null);
                    try {
                      await onStatusChange(task.id, { status: 'assigned', assigned_agent: agentId });
                    } catch (e) {
                      setAssignErr(e.message || 'Assignment failed');
                      setTimeout(() => setAssignErr(null), 3000);
                    } finally {
                      setAssigningAgent(false);
                    }
                  }}
                  onCancel={() => setShowAssignPicker(false)}
                />
              )}
              {assignErr && <span style={{ position: 'absolute', bottom: -20, left: 0, fontSize: 11, color: '#BA1A1A', whiteSpace: 'nowrap' }}>⚠️ {assignErr}</span>}
            </div>
          )}
          {task.status === "failed" && (
            <button className="tdm-action-btn" onClick={() => onStatusChange(task.id, { status: "todo" })}
              style={{ background: '#E65100', color: '#fff', minHeight: isMobile ? 42 : 36 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 105.64-12.48L1 10" /></svg>
              Retry
            </button>
          )}
          {(task.status === "qa_testing" || task.status === "completed") && (
            <button className="tdm-action-btn" onClick={() => onStatusChange(task.id, { status: "todo" })}
              style={{ background: 'var(--md-surface-container-low, #F7F2FA)', color: 'var(--md-on-surface-variant, #49454F)', border: '1px solid var(--md-surface-variant, #E7E0EC)', minHeight: isMobile ? 42 : 36 }}>
              Reopen
            </button>
          )}
          {task.status === "completed" && (
            <button className="tdm-action-btn" onClick={handleDeploy} disabled={deploying || deploySuccess}
              style={{
                background: deploySuccess ? '#00838F' : deploying ? '#00838F88' : '#00838F',
                color: '#fff',
                minHeight: isMobile ? 42 : 36,
                opacity: deploying ? 0.8 : 1,
                cursor: deploying ? 'wait' : 'pointer',
              }}>
              {deploying ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 14 }}>⏳</span>
                  Deploying…
                </>
              ) : deploySuccess ? (
                <>✅ Deployed</>
              ) : (
                <>🚀 Deploy</>
              )}
            </button>
          )}
          {deployError && <span style={{ color: '#D32F2F', fontSize: 12, wordBreak: 'break-word' }}>⚠️ {deployError}</span>}
          <div style={{ flex: 1 }} />
          {/* Time hint */}
          {!isMobile && task.created_at && (
            <span style={{ fontSize: 10, color: 'var(--md-outline, #79747E)', fontFamily: "'Roboto Mono', monospace" }}>
              {timeAgo(task.updated_at || task.created_at)}
            </span>
          )}
          {task.status !== 'deprecated' && (
            <button className="tdm-action-btn" onClick={handleDeprecate} disabled={deprecating}
              onBlur={() => { if (!deprecating) setDeprecateConfirm(false); }}
              style={{
                background: deprecateConfirm ? '#9E9E9E' : 'var(--md-surface-container-low, #F7F2FA)',
                color: deprecateConfirm ? '#fff' : '#79747E',
                border: deprecateConfirm ? '1px solid #9E9E9E' : '1px solid var(--md-surface-variant, #E7E0EC)',
                minHeight: isMobile ? 42 : 36,
                opacity: deprecating ? 0.6 : 1,
                cursor: deprecating ? 'wait' : 'pointer',
              }}>
              {deprecating ? '⏳ Deprecating…' : deprecateConfirm ? 'Mark as deprecated? This hides the task from the board.' : 'Deprecate'}
            </button>
          )}
          {deprecateError && <span style={{color:"#D32F2F",fontSize:13,marginLeft:8}}>{deprecateError}</span>}
          <button className="tdm-action-btn" onClick={handleClose}
            style={{ background: 'var(--md-surface-container-low, #F7F2FA)', color: 'var(--md-on-surface-variant, #49454F)', border: '1px solid var(--md-surface-variant, #E7E0EC)', minHeight: isMobile ? 42 : 36 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}