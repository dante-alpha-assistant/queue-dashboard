import { useEffect, useState, useCallback, useRef } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Clock, FileText, Image, Lightbulb, Link, Package, Pencil, RefreshCw, Timer, Wrench, XCircle, Pause, Rocket } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import AgentPicker from './AgentPicker';
import StatusTimeline from './StatusTimeline';
import ActivityLog from './ActivityLog';
import TaskComments from './TaskComments';
import TaskRelationships from './TaskRelationships';
import { ProgressDetail } from './ProgressFeed';
import CostsTab from './CostsTab';
import HumanInterventionForm from './HumanInterventionForm';
import TaskAttachments from './TaskAttachments';
import { AgentAvatar, TaskTypeIcon, BlockerTypeIcon, PriorityDot, RefreshIcon, UserPlusIcon, RocketIcon, FolderIcon, OpsIcon } from './Icons';

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
  blocked:     { bg: "#E6510014", color: "#E65100", label: "Blocked",     accent: "#E65100" },
  deployed:    { bg: "#00838F14", color: "#00838F", label: "Deployed",    accent: "#00838F" },
  deploying:   { bg: "#E8A31714", color: "#E8A317", label: "Deploying",   accent: "#D97706" },
  deploy_failed: { bg: "#BA1A1A14", color: "#BA1A1A", label: "Deploy Failed", accent: "#BA1A1A" },
  saving:      { bg: "#E8A31714", color: "#E8A317", label: "Saving",      accent: "#D97706" },
  deprecated:  { bg: "#9E9E9E14", color: "#9E9E9E", label: "Deprecated",  accent: "#9E9E9E" },
};

/** Statuses that indicate a long-running async operation is in flight */
const TRANSITIONAL_STATUSES = new Set(['deploying', 'saving']);

const PRIORITY_CONFIG = {
  urgent: { bg: "#D32F2F14", color: "#D32F2F", label: "Urgent", icon: "🔴" },
  high:   { bg: "#E6510014", color: "#E65100", label: "High", icon: "🟠" },
  normal: null,
  low:    { bg: "#75757514", color: "#757575", label: "Low", icon: "⚪" },
};

const TYPE_COLORS = {
  coding: "#6750A4", research: "#0061A4", ops: "#7D5260", general: "#79747E", test: "#386A20", manual: "#795548",
};
const TASK_TYPES = ["manual", "coding", "ops", "general", "research", "test"];

const STAGE_COLORS = {
  refinery: "#E65100", foundry: "#1565C0", builder: "#2E7D32", inspector: "#6A1B9A", deployer: "#00838F",
};
const STAGES = ["refinery", "foundry", "builder", "inspector", "deployer"];
const STAGE_LABELS = { refinery: "Refine", foundry: "Found", builder: "Build", inspector: "Inspect", deployer: "Deploy" };

const DEPLOY_TARGETS = ["kubernetes", "vercel", "railway", "none"];
const DEPLOY_TARGET_CONFIG = {
  kubernetes: { icon: "☸️", color: "#326CE5", label: "Kubernetes" },
  vercel: { icon: "▲", color: "#000000", label: "Vercel" },
  railway: { icon: "🚂", color: "#7B3FE4", label: "Railway" },
  none: { icon: "⏭️", color: "#79747E", label: "None" },
};
const ACTIVE_STATUSES = new Set(["in_progress", "running", "qa_testing", "completed"]);

const HAS_MARKDOWN = /[#*`\[|]/;

/* ── Error → Suggestion pattern matching ─────────────────── */

const ERROR_SUGGESTIONS = [
  { pattern: /idle timeout/i, suggestion: "The agent timed out waiting. Click Actions → Retry to re-dispatch, or check if the agent has capacity." },
  { pattern: /session idle/i, suggestion: "The agent session went idle. Click Actions → Retry to re-dispatch, or check if the agent has capacity." },
  { pattern: /qa rejected.*no pr/i, suggestion: "The coding agent did not create a pull request. Click Actions → Retry to re-assign to a different agent." },
  { pattern: /qa rejected.*no pull request/i, suggestion: "The coding agent did not create a pull request. Click Actions → Retry to re-assign to a different agent." },
  { pattern: /qa rejected/i, suggestion: "QA found issues with this task. Review the QA result, then click Actions → Retry to re-assign." },
  { pattern: /at capacity/i, suggestion: "All agent replicas are busy. Wait for a task to complete, or scale up replicas in gitops." },
  { pattern: /no available agent/i, suggestion: "No agents are available to handle this task. Check agent status on the Pingboard, or wait for an agent to free up." },
  { pattern: /deploy failed.*railway/i, suggestion: "Check Railway dashboard for deploy logs, ensure RAILWAY_TOKEN is configured, then retry." },
  { pattern: /deploy failed.*vercel/i, suggestion: "Install the Vercel GitHub integration at vercel.com/integrations/github, then retry the deploy." },
  { pattern: /deploy failed/i, suggestion: "The deployment failed. Check the deploy logs for details, then click Actions → Retry." },
  { pattern: /merge conflict/i, suggestion: "The PR has merge conflicts. Click Actions → Rebase PR to attempt an automatic rebase, or resolve conflicts manually." },
  { pattern: /rate limit/i, suggestion: "An API rate limit was hit. Wait a few minutes, then click Actions → Retry." },
  { pattern: /auth.*fail|unauthorized|403|401/i, suggestion: "Authentication failed. Check that the agent's tokens are valid and not expired." },
  { pattern: /timeout|timed out/i, suggestion: "The operation timed out. Click Actions → Retry to try again, or check if the target service is healthy." },
  { pattern: /out of memory|oom/i, suggestion: "The agent ran out of memory. Consider scaling up resources in gitops, then retry." },
  { pattern: /network|connection refused|ECONNREFUSED/i, suggestion: "A network error occurred. Check connectivity to the target service, then retry." },
  { pattern: /not found|404/i, suggestion: "A required resource was not found. Verify the repo/endpoint exists and the agent has access." },
  { pattern: /dispatch.*fail/i, suggestion: "Task dispatch failed. Check that target agents are online, then click Actions → Retry." },
];

function getErrorSuggestion(error) {
  if (!error || typeof error !== 'string') return null;
  for (const { pattern, suggestion } of ERROR_SUGGESTIONS) {
    if (pattern.test(error)) return suggestion;
  }
  return null;
}

const TIMELINE_STEPS = [
  { key: 'created', label: 'Created', statuses: ['todo', 'blocked', 'in_progress', 'running', 'completed', 'failed', 'qa', 'qa_testing', 'deploying', 'deployed', 'deploy_failed'] },
  { key: 'assigned', label: 'Assigned', statuses: [ 'in_progress', 'running', 'completed', 'failed', 'qa', 'qa_testing', 'deploying', 'deployed', 'deploy_failed'] },
  { key: 'in_progress', label: 'Working', statuses: ['in_progress', 'running', 'completed', 'failed', 'qa', 'qa_testing', 'deploying', 'deployed', 'deploy_failed'] },
  { key: 'qa_testing', label: 'QA Testing', statuses: ['qa_testing', 'completed', 'failed', 'deploying', 'deployed', 'deploy_failed'] },
  { key: 'qa', label: 'QA', statuses: ['qa', 'completed', 'deploying', 'deployed', 'deploy_failed'] },
  { key: 'completed', label: 'Complete', statuses: ['completed', 'deploying', 'deployed', 'deploy_failed'] },
  { key: 'deploying', label: 'Deploying', statuses: ['deploying', 'deployed', 'deploy_failed'] },
];

/* ── Styles ────────────────────────────────────────────────── */

const MODAL_STYLE_ID = 'task-modal-styles';
function ensureModalStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MODAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.textContent = `
    @keyframes tdm-spin {
      to { transform: rotate(360deg); }
    }
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

    .tdm-md { overflow: hidden; overflow-wrap: break-word; word-break: break-word; max-width: 100%; }
    .tdm-md table { border-collapse: collapse; width: 100%; max-width: 100%; margin: 8px 0; font-size: 13px; display: block; overflow-x: auto; }
    .tdm-md table th, .tdm-md table td { border: 1px solid var(--md-surface-variant, #E7E0EC); padding: 6px 10px; text-align: left; }
    .tdm-md table th { background: var(--md-surface-container-low, #F7F2FA); font-weight: 600; }
    .tdm-md table tr:nth-child(even) td { background: var(--md-surface, #FFFBFE); }
    .tdm-md blockquote { border-left: 3px solid var(--md-primary, #6750A4); background: var(--md-surface-container-low, #F7F2FA); margin: 8px 0; padding: 8px 16px; border-radius: 0 8px 8px 0; }
    .tdm-md a { color: var(--md-primary, #6750A4); text-decoration: underline; text-underline-offset: 2px; }
    .tdm-md a:hover { opacity: 0.8; }
    .tdm-md pre { background: var(--md-surface-container-low, #F7F2FA); border-radius: 8px; padding: 12px; overflow-x: auto; max-width: 100%; font-size: 13px; }
    .tdm-md pre code { display: block; overflow-x: auto; }
    .tdm-md code { font-family: 'Roboto Mono', 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.9em; }
    .tdm-md code:not(pre code) { background: var(--md-surface-container-low, #F7F2FA); padding: 2px 6px; border-radius: 4px; }

    .tdm-json-toggle { cursor: pointer; user-select: none; opacity: 0.5; font-size: 10px; display: inline-block; width: 14px; text-align: center; margin-right: 2px; transition: transform 0.15s, opacity 0.15s; }
    .tdm-json-toggle:hover { opacity: 1; }
    .tdm-copy-btn { position: absolute; top: 8px; right: 8px; background: var(--md-surface-container-low, #F7F2FA); border: 1px solid var(--md-surface-variant, #E7E0EC); border-radius: 8px; padding: 4px 10px; font-size: 11px; cursor: pointer; opacity: 0; transition: opacity 0.15s; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
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
      cursor: pointer; transition: all 0.15s; font-family: 'Inter', system-ui, -apple-system, sans-serif;
      letter-spacing: 0.02em; display: inline-flex; align-items: center; gap: 6px;
    }
    .tdm-action-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .tdm-action-btn:active { transform: translateY(0); }

    .tdm-pill-tab {
      padding: 6px 14px; font-size: 12px; font-weight: 500; border: none;
      background: transparent; cursor: pointer; color: var(--md-outline, #79747E);
      border-radius: 100px; transition: all 0.15s;
      font-family: 'Inter', system-ui, -apple-system, sans-serif; letter-spacing: 0.02em;
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
      border-radius: 12px; padding: 12px; overflow: visible;
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
        <button className="tdm-copy-btn" onClick={handleCopy}>{copied ? <><CheckCircle2 size={12} /> Copied</> : <><ClipboardList size={12} /> Copy</>}</button>
        <pre style={{ fontSize: 12, fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', overflowX: 'auto', maxWidth: '100%', wordBreak: 'break-word', padding: '16px 16px 16px', paddingTop: 32, background: 'var(--md-surface-container-low, #F7F2FA)', borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)', margin: 0, lineHeight: 1.6 }}>
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
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
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
  const isDeployFailed = status === 'deploy_failed';
  const steps = isFailed
    ? [...TIMELINE_STEPS.slice(0, 4), { key: 'failed', label: 'Failed', statuses: ['failed'] }]
    : isDeployFailed
    ? [...TIMELINE_STEPS, { key: 'deploy_failed', label: 'Deploy Failed', statuses: ['deploy_failed'] }]
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
      <div style={{ fontWeight: 600, color: '#E65100', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}><RefreshCw size={14} /> Smart Retry</div>
      {sr.reasoning && <div style={{ color: 'var(--md-on-surface-variant, #49454F)', lineHeight: 1.5 }}>{sr.reasoning}</div>}
      {sr.recommended_agent && <div style={{ marginTop: 4, color: 'var(--md-outline, #79747E)', fontSize: 11 }}>→ Routed to <strong>{sr.recommended_agent}</strong></div>}
    </div>
  );
}

/* ── Actions Dropdown ─────────────────────────────────────── */

const FORCE_STATUS_OPTIONS = [
  { value: "todo", label: "Todo", color: "#79747E" },
  { value: "in_progress", label: "In Progress", color: "#E8A317" },
  { value: "qa_testing", label: "QA Testing", color: "#5E35B1" },
  { value: "completed", label: "Completed", color: "#1B5E20" },
  { value: "blocked", label: "Blocked", color: "#D84315" },
  { value: "deployed", label: "Deployed", color: "#00838F" },
  { value: "failed", label: "Failed", color: "#BA1A1A" },
];

function ActionsDropdown({ task, onStatusChange, onClose, handleDeploy, deploying, deploySuccess, deployConfirm, handleRebase, rebasing, rebaseSuccess, rebaseError, handleDeprecate, deprecating, deprecateConfirm, isMobile, dropUp = true, actionProcessing, setActionProcessing }) {
  const [open, setOpen] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [forceCompleteConfirm, setForceCompleteConfirm] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [forceStatusConfirm, setForceStatusConfirm] = useState(null); // status value pending confirmation
  const isTransitional = TRANSITIONAL_STATUSES.has(task.status);
  const actionLoading = actionProcessing || isTransitional;
  const setActionLoading = setActionProcessing;
  const ref = useRef(null);

  useEffect(() => {
    if (!open) { setForceCompleteConfirm(false); return; }
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build actions based on task status
  const actions = [];
  const s = task.status;

  // Stop/Resume: paused tasks can be resumed, non-paused can be stopped
  if (task.paused) {
    actions.push({ label: '▶️ Resume', key: 'resume', color: '#2E7D32' });
  } else {
    actions.push({ label: 'Stop task', iconKey: 'pause', key: 'stop', color: '#E65100' });
  }

  if (s === 'todo' && !task.paused) {
    actions.push({ label: 'Assign', iconKey: 'user', key: 'assign' });
  }
  if (s === 'failed' || s === 'deploy_failed') {
    actions.push({ label: 'Retry', iconKey: 'refresh', key: 'retry', color: '#E65100' });
  }
  if (s === 'blocked') {
    actions.push({ label: 'Unblock', iconKey: 'unlock', key: 'unblock', color: '#1B5E20' });
  }
  if (s === 'qa_testing' || s === 'completed') {
    actions.push({ label: 'Reopen', iconKey: 'undo', key: 'reopen' });
  }
  if (s === 'completed' || s === 'deploy_failed') {
    const deployTarget = task.deploy_target || 'kubernetes';
    const deployLabel = deploying ? 'Deploying…' : deploySuccess ? 'Deployed' : deployConfirm ? `Confirm Deploy → ${deployTarget}` : `Deploy → ${deployTarget}`;
    actions.push({ label: deployLabel, key: 'deploy', color: deployConfirm ? '#E65100' : '#00838F', disabled: deploying || deploySuccess });
  }
  // Rebase PR — available when task has PRs and is in completed, qa_testing, deploy_failed, or failed status
  if (['completed', 'qa_testing', 'deploy_failed', 'failed'].includes(s) && task.pull_request_url?.length > 0) {
    const rebaseLabel = rebasing ? 'Rebasing…' : rebaseSuccess ? 'Rebase Sent' : 'Rebase PR';
    actions.push({ label: rebaseLabel, key: 'rebase', color: '#E65100', disabled: rebasing || rebaseSuccess });
  }
  // Force Complete — for non-terminal tasks
  const TERMINAL = new Set(['completed', 'deployed', 'deprecated']);
  if (!TERMINAL.has(s)) {
    actions.push({ label: forceCompleteConfirm ? 'Confirm Force Complete' : 'Force Complete', key: 'force_complete', color: forceCompleteConfirm ? '#E65100' : '#1B5E20' });
  }
  // Change Status — always available (except deprecated)
  if (s !== 'deprecated') {
    actions.push({ label: '🔀 Change Status', key: 'change_status', color: '#6750A4' });
  }

  if (s !== 'deprecated') {
    actions.push({ label: deprecating ? '…' : 'Deprecate', key: 'deprecate', color: '#9E9E9E', disabled: deprecating });
  }

  const handleForceStatus = async (newStatus) => {
    setActionLoading(true);
    setShowStatusPicker(false);
    setForceStatusConfirm(null);
    try {
      const resp = await fetch(`/api/tasks/${task.id}/force-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, changed_by: 'dashboard' }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Force status failed');
      // Trigger UI refresh via onStatusChange with empty update (task already updated server-side)
      if (onStatusChange) await onStatusChange(task.id, {});
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (key) => {
    // Force Complete — two-click confirmation
    if (key === 'force_complete' && !forceCompleteConfirm) {
      setForceCompleteConfirm(true);
      return; // keep dropdown open
    }
    if (key === 'force_complete' && forceCompleteConfirm) {
      setOpen(false);
      setForceCompleteConfirm(false);
      await handleForceStatus('completed');
      return;
    }
    // Change Status — show status picker
    if (key === 'change_status') {
      setShowStatusPicker(true);
      setOpen(false);
      return;
    }
    // For deploy confirmation step, keep dropdown open so user sees the confirm button
    if (key === 'deploy' && !deployConfirm) {
      // First click — don't close dropdown, just trigger confirm state
      setActionLoading(true);
      try { await handleDeploy(); } finally { setActionLoading(false); }
      return;
    }
    setOpen(false);
    if (key === 'assign') { setShowAssignPicker(true); return; }
    setActionLoading(true);
    try {
      switch (key) {
        case 'stop': await onStatusChange(task.id, { status: 'todo', assigned_agent: null, started_at: null, paused: true }); break;
        case 'resume': await onStatusChange(task.id, { paused: false }); break;
        case 'retry': await onStatusChange(task.id, { status: 'todo', assigned_agent: null, idle_retries: 0, qa_retries: 0 }); break;
        case 'unblock': await onStatusChange(task.id, { status: 'todo', blocked_reason: null, assigned_agent: null }); break;
        case 'reopen': await onStatusChange(task.id, { status: 'todo', assigned_agent: null }); break;
        case 'deploy': await handleDeploy(); break;
        case 'rebase': await handleRebase(); break;
        case 'deprecate': await handleDeprecate(); break;
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (agentId) => {
    setShowAssignPicker(false);
    setAssigning(true);
    try {
      await onStatusChange(task.id, { assigned_agent: agentId });
    } finally {
      setAssigning(false);
    }
  };

  if (actions.length === 0) return null;

  const menuStyle = {
    position: 'absolute',
    ...(dropUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
    right: 0,
    background: 'var(--md-surface, #FFFBFE)',
    border: '1px solid var(--md-surface-variant, #E7E0EC)',
    borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    minWidth: 180, zIndex: 300, overflow: 'hidden',
  };

  const itemStyle = (color, disabled) => ({
    display: 'block', width: '100%', padding: '10px 16px',
    background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13, fontWeight: 500, textAlign: 'left',
    color: disabled ? '#bbb' : (color || 'var(--md-on-surface, #1C1B1F)'),
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="tdm-action-btn"
        onClick={() => !assigning && !actionLoading && setOpen(!open)}
        disabled={assigning || actionLoading}
        style={{
          background: (assigning || actionLoading) ? 'var(--md-outline, #79747E)' : 'var(--md-primary, #6750A4)',
          cursor: (assigning || actionLoading) ? 'not-allowed' : 'pointer', color: '#fff',
          minHeight: isMobile ? 42 : 36, display: 'flex', alignItems: 'center', gap: 6,
        }}>
        {actionLoading ? (<><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'tdm-spin 0.6s linear infinite' }} /> Processing…</>) : assigning ? "Assigning…" : "Actions ▾"}
      </button>
      {open && (
        <div style={menuStyle}>
          {actions.map(a => (
            <button key={a.key} style={itemStyle(a.color, a.disabled)}
              disabled={a.disabled}
              onMouseEnter={e => { if (!a.disabled) e.target.style.background = 'var(--md-surface-container-low, #F7F2FA)'; }}
              onMouseLeave={e => { e.target.style.background = 'none'; }}
              onClick={() => !a.disabled && handleAction(a.key)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      {showAssignPicker && (
        <div style={{ position: 'absolute', ...(dropUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), right: 0, zIndex: 301 }}>
          <AgentPicker
            onSelect={handleAssign}
            onCancel={() => setShowAssignPicker(false)}
          />
        </div>
      )}
      {showStatusPicker && (
        <div style={{
          position: 'absolute',
          ...(dropUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
          right: 0, background: 'var(--md-surface, #FFFBFE)',
          border: '1px solid var(--md-surface-variant, #E7E0EC)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          minWidth: 200, zIndex: 301, overflow: 'hidden',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--md-outline, #79747E)', padding: '10px 16px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Change status to:
          </div>
          {FORCE_STATUS_OPTIONS.filter(o => o.value !== task.status).map(opt => (
            forceStatusConfirm === opt.value ? (
              <button key={opt.value}
                onClick={() => handleForceStatus(opt.value)}
                style={{ display: 'block', width: '100%', padding: '10px 16px', background: '#FFF3E0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left', color: '#E65100' }}
              >
                <AlertTriangle size={14} /> Confirm → {opt.label}
              </button>
            ) : (
              <button key={opt.value}
                onClick={() => setForceStatusConfirm(opt.value)}
                style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left', color: opt.color }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--md-surface-container-low, #F7F2FA)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {opt.label}
              </button>
            )
          ))}
          <button
            onClick={() => { setShowStatusPicker(false); setForceStatusConfirm(null); }}
            style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', borderTop: '1px solid var(--md-surface-variant, #E7E0EC)', cursor: 'pointer', fontSize: 12, color: 'var(--md-outline, #79747E)', textAlign: 'center' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Modal ───────────────────────────────────────────── */

/* ── App slug color helper ────────────────────────────────── */
function appSlugColor(slug) {
  if (!slug) return "#6750A4";
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 45%, 42%)`;
}

export default function TaskDetailModal({ task, onClose, onStatusChange, isMobile, isTablet, apps = [], progress, monitor }) {
  const [closing, setClosing] = useState(false);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [idCopied, setIdCopied] = useState(false);
  const [deprecateConfirm, setDeprecateConfirm] = useState(false);
  const [deprecating, setDeprecating] = useState(false);
  const [deprecateError, setDeprecateError] = useState(null);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [assignErr, setAssignErr] = useState(null);
  const [deploying, setDeploying] = useState(task.status === 'deploying');
  const [deployError, setDeployError] = useState(null);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [rebasing, setRebasing] = useState(false);
  const [rebaseError, setRebaseError] = useState(null);
  const [rebaseSuccess, setRebaseSuccess] = useState(false);
  const [mergeConflict, setMergeConflict] = useState(null); // null = unchecked, true/false = checked
  const [editingDeployUrl, setEditingDeployUrl] = useState(false);
  const [deployUrlDraft, setDeployUrlDraft] = useState(task.deployment_url || '');
  const [savingDeployUrl, setSavingDeployUrl] = useState(false);

  // Auto-clear deploy success after 3s
  useEffect(() => {
    if (deploySuccess) {
      const t = setTimeout(() => setDeploySuccess(false), 3000);
      return () => clearTimeout(t);
    }
  }, [deploySuccess]);

  // Sync deploying overlay with Realtime status updates
  const deployPollRef = useRef(null);
  const deployTimeoutRef = useRef(null);

  const stopDeployPolling = useCallback(() => {
    clearInterval(deployPollRef.current);
    clearTimeout(deployTimeoutRef.current);
    deployPollRef.current = null;
    deployTimeoutRef.current = null;
  }, []);

  // Cleanup deploy polling on unmount
  useEffect(() => () => stopDeployPolling(), [stopDeployPolling]);

  useEffect(() => {
    if (task.status === 'deploying') {
      setDeploying(true);
    } else if (task.status === 'deployed' || task.status === 'deploy_failed') {
      stopDeployPolling();
      setDeploying(false);
      setDeploySuccess(task.status === 'deployed');
      if (task.status === 'deploy_failed') {
        setDeployError('Deploy failed');
        // Error persists until dismissed
      }
    }
  }, [task.status, stopDeployPolling]);

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
    setDeprecating(true);
    setDeprecateError(null);
    try {
      await onStatusChange(task.id, { status: 'deprecated' });
    } catch (err) {
      setDeprecateError(err.message || "Failed to deprecate task");
    } finally {
      setDeprecating(false);
      setDeprecateConfirm(false);
    }
  };

  const [deployConfirm, setDeployConfirm] = useState(false);
  const deployConfirmTimer = useRef(null);

  const handleDeploy = async () => {
    if (!deployConfirm) {
      setDeployConfirm(true);
      // Auto-reset confirmation after 5 seconds
      clearTimeout(deployConfirmTimer.current);
      deployConfirmTimer.current = setTimeout(() => setDeployConfirm(false), 5000);
      return;
    }
    clearTimeout(deployConfirmTimer.current);
    setDeployConfirm(false);
    setDeploying(true);
    setDeployError(null);
    setDeploySuccess(false);
    stopDeployPolling();
    try {
      const resp = await fetch(`/api/deploy/${task.id}`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Deploy failed (HTTP ${resp.status})`);
      }
      // If task is already deployed/deploy_failed, no Realtime update will come — reset now
      if (task.status === 'deployed' || task.status === 'deploy_failed') {
        setDeploying(false);
        setDeploySuccess(task.status === 'deployed');
        return;
      }
      // Start polling as fallback in case Realtime doesn't fire
      deployPollRef.current = setInterval(async () => {
        try {
          const pollResp = await fetch(`/api/tasks/${task.id}`);
          if (pollResp.ok) {
            const pollData = await pollResp.json();
            const st = pollData?.status || pollData?.task?.status;
            if (st === 'deployed' || st === 'deploy_failed') {
              stopDeployPolling();
              setDeploying(false);
              setDeploySuccess(st === 'deployed');
              if (st === 'deploy_failed') {
                setDeployError('Deploy failed');
                // Error persists until dismissed
              }
            }
          }
        } catch (_) { /* ignore poll errors */ }
      }, 5000);
      // Timeout: reset spinner after 30s no matter what
      deployTimeoutRef.current = setTimeout(() => {
        stopDeployPolling();
        setDeploying(false);
        setDeployError('Deploy may still be in progress. Refresh to check status.');
        // Error persists until dismissed
      }, 30000);
    } catch (e) {
      stopDeployPolling();
      setDeploying(false);
      setDeployError(e.message || "Deploy failed");
      // Error persists until dismissed
    }
  };

  // Check PR mergeability when task has PRs and is in a deployable state
  useEffect(() => {
    if (!task?.pull_request_url?.length) return;
    if (!['completed', 'qa_testing', 'deploy_failed'].includes(task.status)) return;
    let cancelled = false;
    fetch(`/api/tasks/${task.id}/mergeability`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.prs?.length) {
          const hasConflict = data.prs.some(pr => pr.mergeable === false || pr.mergeable_state === 'dirty');
          setMergeConflict(hasConflict);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [task?.id, task?.status]);

  const handleRebase = async () => {
    setRebasing(true);
    setRebaseError(null);
    setRebaseSuccess(false);
    try {
      const resp = await fetch(`/api/tasks/${task.id}/rebase`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Rebase failed (HTTP ${resp.status})`);
      }
      setRebaseSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      setRebaseError(e.message || "Rebase failed");
      // Error persists until dismissed
    } finally {
      setRebasing(false);
    }
  };

  const handleFieldChange = useCallback(async (updates) => {
    setFieldSaving(true);
    setSaveError(null);
    try {
      await onStatusChange(task.id, updates);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1200);
    } catch (err) {
      setSaveError(err.message || 'Failed to save');
      // Error persists until dismissed
    } finally {
      setFieldSaving(false);
    }
  }, [task?.id, onStatusChange]);

  if (!task) return null;

  const agent = task.assigned_agent?.toLowerCase();
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

  const hasDeployment = ['deploying', 'deployed', 'deploy_failed'].includes(task.status) || !!task.deployment_url || !!task.deploy_target;
  const hasCosts = !!task.metadata?.costs && typeof task.metadata.costs === 'object' && Object.keys(task.metadata.costs).length > 0;

  // Filter cost-related keys from metadata for the Meta tab
  const COST_KEYS = new Set(['costs', 'totalCost', 'totalTokens']);
  const filteredMetadata = hasMetadata
    ? Object.fromEntries(Object.entries(task.metadata).filter(([k]) => !COST_KEYS.has(k)))
    : {};
  const hasFilteredMetadata = Object.keys(filteredMetadata).length > 0;

  const tabs = [{ key: 'details', label: 'Details' }];
  tabs.push({ key: 'comments', label: 'Comments' });
  tabs.push({ key: 'activity', label: 'Activity' });
  tabs.push({ key: 'deployment', label: 'Deployment' });
  if (hasCosts) tabs.push({ key: 'costs', label: '💰 Costs' });
  tabs.push({ key: 'metadata', label: 'Metadata' });
  if (hasQA) tabs.push({ key: 'qa', label: 'QA' });
  if (hasFilteredMetadata) tabs.push({ key: 'meta', label: 'Meta' });

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
    position: "relative",
  } : {
    background: "var(--md-surface, #FFFBFE)", borderRadius: 16, padding: 0,
    width: useWideLayout ? 900 : 700, maxWidth: "94vw",
    maxHeight: "90vh", overflow: "hidden",
    boxShadow: "0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
    transform: closing ? 'translateY(8px) scale(0.97)' : 'none',
    transition: 'transform 0.2s',
    fontFamily: "'Roboto', system-ui, -apple-system, sans-serif",
    display: "flex", flexDirection: "column",
    position: "relative",
  };

  /* ── Sidebar content ──────────────────────────────────── */
  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Agent card */}
      {agent && (
        <div className="tdm-sidebar-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <AgentAvatar agent={agent} size={32} style={{ border: '1px solid var(--md-surface-variant, #E7E0EC)' }} />
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
            <select
              className="tdm-stage-select"
              value={task.type || "general"}
              disabled={fieldSaving || actionProcessing}
              onChange={e => handleFieldChange({ type: e.target.value })}
              onClick={e => e.stopPropagation()}
              style={{ color: TYPE_COLORS[task.type] || '#79747E' }}
            >
              {TASK_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
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
          <MetaCell label="App">
            <select
              className="tdm-stage-select"
              value={task.app_id || ""}
              disabled={fieldSaving || actionProcessing}
              onChange={e => handleFieldChange({ app_id: e.target.value || null })}
              onClick={e => e.stopPropagation()}
              style={{ color: task.app ? appSlugColor(task.app.slug || task.app.name) : 'var(--md-outline, #79747E)' }}
            >
              <option value="">No app</option>
              {apps.map(a => <option key={a.id} value={a.id}>{a.icon || "📦"} {a.name}</option>)}
            </select>
          </MetaCell>

          <MetaCell label="Deploy">
            <select
              className="tdm-stage-select"
              value={task.deploy_target || "kubernetes"}
              disabled={fieldSaving || actionProcessing}
              onChange={e => handleFieldChange({ deploy_target: e.target.value })}
              onClick={e => e.stopPropagation()}
              style={{ color: DEPLOY_TARGET_CONFIG[task.deploy_target || 'kubernetes']?.color || '#79747E' }}
            >
              {DEPLOY_TARGETS.map(t => <option key={t} value={t}>{DEPLOY_TARGET_CONFIG[t].icon} {DEPLOY_TARGET_CONFIG[t].label}</option>)}
            </select>
            {task.deployment_url ? (
              <a href={task.deployment_url} target="_blank" rel="noopener noreferrer" style={{
                color: '#6750A4', textDecoration: 'none', fontSize: 11, display: 'flex',
                alignItems: 'center', gap: 4, marginTop: 4, wordBreak: 'break-all',
              }}>
                <span style={{ fontSize: 10 }}><Link size={14} /></span>
                {task.deployment_url.replace(/^https?:\/\//, '').slice(0, 30)}{task.deployment_url.replace(/^https?:\/\//, '').length > 30 ? '…' : ''}
              </a>
            ) : null}
          </MetaCell>
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
              disabled={fieldSaving || actionProcessing}
              onChange={e => handleFieldChange({ stage: e.target.value || null })}
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
          <SectionLabel icon={<RefreshCw size={14} />}>Pipeline</SectionLabel>
          <PipelineStepper stage={task.stage} />
        </div>
      )}

      {/* Timeline */}
      <div className="tdm-sidebar-card">
        <SectionLabel icon={<Timer size={14} />} collapsible collapsed={collapsedSections.timeline} onToggle={() => toggleSection('timeline')}>Timeline</SectionLabel>
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
          {task.status === 'blocked' && (
            <div style={{ marginBottom: 16 }}>
              <HumanInterventionForm task={task} onStatusChange={onStatusChange} onClose={handleClose} />
            </div>
          )}
          {hasError && (
            <>
              <div style={{
                marginBottom: 0, padding: '12px 16px', borderRadius: getErrorSuggestion(task.error) ? '10px 10px 0 0' : 10,
                background: '#BA1A1A0A', border: '1px solid #BA1A1A25',
                borderBottom: getErrorSuggestion(task.error) ? 'none' : undefined,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}><XCircle size={14} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#BA1A1A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Error</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--md-on-surface, #1C1B1F)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{task.error}</div>
                </div>
              </div>
              {getErrorSuggestion(task.error) && (
                <div style={{
                  marginBottom: 16, padding: '10px 16px', borderRadius: '0 0 10px 10px',
                  background: '#E8A31708', border: '1px solid #E8A31730',
                  borderTop: '1px dashed #E8A31740',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}><Lightbulb size={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#E8A317', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Suggestion</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--md-on-surface-variant, #49454F)' }}>{getErrorSuggestion(task.error)}</div>
                  </div>
                </div>
              )}
              {!getErrorSuggestion(task.error) && <div style={{ marginBottom: 16 }} />}
            </>
          )}
          {hasDescription && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel icon={<FileText size={14} />} collapsible collapsed={collapsedSections.desc} onToggle={() => toggleSection('desc')}>Description</SectionLabel>
              {!collapsedSections.desc && (
                <div style={{ padding: 14, background: 'var(--md-surface-container-low, #F7F2FA)', borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)', overflow: 'hidden', overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%' }}>
                  <MarkdownContent text={task.description} />
                </div>
              )}
            </div>
          )}
          {hasCriteria && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel icon={<CheckCircle2 size={14} />} color="#E65100" collapsible collapsed={collapsedSections.criteria} onToggle={() => toggleSection('criteria')}>Acceptance Criteria</SectionLabel>
              {!collapsedSections.criteria && (
                <div style={{ padding: 14, background: '#E6510006', borderRadius: 10, border: '1px solid #E6510018', overflow: 'hidden', overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%' }}>
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
          {/* Attachments */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel icon={<Image size={14} />}>Attachments</SectionLabel>
            <TaskAttachments
              taskId={task.id}
              attachments={task.metadata?.attachments || []}
              onAttachmentsChange={() => {}}
              readonly={['deployed', 'deprecated'].includes(task.status)}
            />
          </div>
          <TaskRelationships taskId={task.id} onNavigateToTask={(id) => { window.location.href = `/task/${id}`; }} />
          <div style={{ marginTop: 16 }}>
            <SectionLabel icon={<Link size={14} />}>Links</SectionLabel>
            <div style={{ padding: 14, background: 'var(--md-surface-container-low, #F7F2FA)', borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {task.pull_request_url?.length > 0 ? (
                (Array.isArray(task.pull_request_url) ? task.pull_request_url : [task.pull_request_url]).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#6750A4", textDecoration: "none", fontWeight: 500, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🔀</span> {url.replace(/https:\/\/github\.com\//, '')}
                  </a>
                ))
              ) : null}
              {task.repository_url && (
                <a href={task.repository_url} target="_blank" rel="noopener noreferrer" style={{ color: "#386A20", textDecoration: "none", fontWeight: 500, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <span><Package size={14} /></span> {task.repository_url.replace(/https:\/\/github\.com\//, '')}
                </a>
              )}
              {/* Show artifact URLs from result (repos, deployments, etc.) */}
              {task.result?.artifacts?.length > 0 && task.result.artifacts.map((artifact, i) => {
                const url = typeof artifact === 'string' ? artifact : artifact?.url;
                const type = typeof artifact === 'string' ? 'link' : (artifact?.type || 'link');
                if (!url) return null;
                const icon = type === 'github_repo' || type === 'repo' ? '📦' : type === 'deployment' ? '🚀' : '🔗';
                const label = url.replace(/https:\/\/github\.com\//, '');
                return (
                  <a key={`artifact-${i}`} href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#386A20", textDecoration: "none", fontWeight: 500, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{icon}</span> {label}
                  </a>
                );
              })}
              {!task.pull_request_url?.length && !task.repository_url && !task.result?.artifacts?.length && (
                <span style={{ color: 'var(--md-outline, #79747E)', fontSize: 13, fontStyle: 'italic' }}>No links</span>
              )}

            </div>
          </div>
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

      {activeTab === 'deployment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Deployment Status */}
          {['deployed', 'deploying', 'deploy_failed'].includes(task.status) && (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: task.status === 'deployed' ? '#00838F0A' : task.status === 'deploy_failed' ? '#BA1A1A0A' : '#E8A3170A',
              border: `1px solid ${task.status === 'deployed' ? '#00838F25' : task.status === 'deploy_failed' ? '#BA1A1A25' : '#E8A31725'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>
                {task.status === 'deployed' ? <CheckCircle2 size={14} /> : task.status === 'deploy_failed' ? <XCircle size={14} /> : <Clock size={14} />}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: task.status === 'deployed' ? '#00838F' : task.status === 'deploy_failed' ? '#BA1A1A' : '#E8A317' }}>
                  {task.status === 'deployed' ? 'Deployed' : task.status === 'deploy_failed' ? 'Deploy Failed' : 'Deploying…'}
                </div>
                {task.updated_at && (
                  <div style={{ fontSize: 11, color: 'var(--md-outline, #79747E)', marginTop: 2 }}>
                    {formatDate(task.updated_at)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deployment URL — editable */}
          <div className="tdm-sidebar-card">
            <SectionLabel icon={<Link size={14} />}>Deployment URL</SectionLabel>
            {editingDeployUrl ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={deployUrlDraft}
                  onChange={e => setDeployUrlDraft(e.target.value)}
                  placeholder="https://example.com"
                  autoFocus
                  style={{
                    flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 8,
                    border: '1px solid var(--md-surface-variant, #E7E0EC)',
                    background: 'var(--md-surface, #FFFBFE)',
                    fontFamily: "'Roboto Mono', monospace", outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--md-primary, #6750A4)'}
                  onBlur={e => e.target.style.borderColor = 'var(--md-surface-variant, #E7E0EC)'}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      setSavingDeployUrl(true);
                      try {
                        await onStatusChange(task.id, { deployment_url: deployUrlDraft || null });
                        setEditingDeployUrl(false);
                      } finally { setSavingDeployUrl(false); }
                    } else if (e.key === 'Escape') {
                      setEditingDeployUrl(false);
                      setDeployUrlDraft(task.deployment_url || '');
                    }
                  }}
                />
                <button
                  disabled={savingDeployUrl}
                  onClick={async () => {
                    setSavingDeployUrl(true);
                    try {
                      await onStatusChange(task.id, { deployment_url: deployUrlDraft || null });
                      setEditingDeployUrl(false);
                    } finally { setSavingDeployUrl(false); }
                  }}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                    background: 'var(--md-primary, #6750A4)', color: '#fff', border: 'none',
                    cursor: savingDeployUrl ? 'not-allowed' : 'pointer', opacity: savingDeployUrl ? 0.6 : 1,
                  }}
                >{savingDeployUrl ? '…' : '✓'}</button>
                <button
                  onClick={() => { setEditingDeployUrl(false); setDeployUrlDraft(task.deployment_url || ''); }}
                  style={{
                    padding: '6px 10px', fontSize: 12, borderRadius: 8,
                    background: 'var(--md-surface-container-low, #F7F2FA)', color: 'var(--md-outline, #79747E)',
                    border: '1px solid var(--md-surface-variant, #E7E0EC)', cursor: 'pointer',
                  }}
                >✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {task.deployment_url ? (
                  <a href={task.deployment_url} target="_blank" rel="noopener noreferrer" style={{
                    color: '#6750A4', textDecoration: 'none', fontWeight: 500, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6, wordBreak: 'break-all', flex: 1, minWidth: 0,
                  }}>
                    <span><Link size={14} /></span> {task.deployment_url}
                  </a>
                ) : (
                  <span style={{ color: 'var(--md-outline, #79747E)', fontSize: 13, fontStyle: 'italic' }}>
                    No deployment URL yet
                  </span>
                )}
                <button
                  onClick={() => { setDeployUrlDraft(task.deployment_url || ''); setEditingDeployUrl(true); }}
                  title="Edit deployment URL"
                  style={{
                    padding: '4px 8px', fontSize: 11, borderRadius: 6,
                    background: 'var(--md-surface-container-low, #F7F2FA)',
                    border: '1px solid var(--md-surface-variant, #E7E0EC)',
                    cursor: 'pointer', color: 'var(--md-outline, #79747E)',
                    flexShrink: 0, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-on-surface, #1C1B1F)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--md-outline, #79747E)'; }}
                ><Pencil size={14} /></button>
              </div>
            )}
          </div>

          {/* Deploy Target */}
          <div className="tdm-sidebar-card">
            <SectionLabel icon={DEPLOY_TARGET_CONFIG[task.deploy_target || 'kubernetes']?.icon || '☸️'}>Deploy Target</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge
                label={DEPLOY_TARGET_CONFIG[task.deploy_target || 'kubernetes']?.label || task.deploy_target || 'Kubernetes'}
                color={DEPLOY_TARGET_CONFIG[task.deploy_target || 'kubernetes']?.color || '#326CE5'}
              />
            </div>

            {/* Vercel-specific links */}
            {(task.deploy_target === 'vercel') && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {task.result?.project_url && (
                  <a href={task.result.project_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6750A4', textDecoration: 'none', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span><BarChart3 size={14} /></span> Vercel Project Dashboard
                  </a>
                )}
                {task.result?.project_name && (
                  <a href={`https://vercel.com/~/projects/${task.result.project_name}/deployments`} target="_blank" rel="noopener noreferrer" style={{ color: '#6750A4', textDecoration: 'none', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span><ClipboardList size={14} /></span> Deployment History
                  </a>
                )}
              </div>
            )}

            {/* Railway-specific info */}
            {task.deploy_target === 'railway' && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {task.result?.project_url && (
                  <a href={task.result.project_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6750A4', textDecoration: 'none', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span><BarChart3 size={14} /></span> Railway Project Dashboard
                  </a>
                )}
                {task.result?.project_name && (
                  <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant, #49454F)' }}>
                    🚂 Project: {task.result.project_name}
                  </span>
                )}
              </div>
            )}

            {/* Kubernetes-specific info */}
            {(task.deploy_target === 'kubernetes' || !task.deploy_target) && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--md-on-surface-variant, #49454F)' }}>
                {task.result?.argocd_synced ? (
                  <span style={{ color: '#386A20', fontWeight: 500 }}><CheckCircle2 size={14} /> ArgoCD synced</span>
                ) : task.result?.sync_triggered ? (
                  <span style={{ color: '#E8A317', fontWeight: 500 }}><Clock size={14} /> ArgoCD sync triggered</span>
                ) : (
                  <span style={{ color: 'var(--md-outline, #79747E)', fontStyle: 'italic' }}>ArgoCD status unknown</span>
                )}
              </div>
            )}

            {/* No deploy target */}
            {task.deploy_target === 'none' && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--md-outline, #79747E)', fontStyle: 'italic' }}>
                No deployment target configured
              </div>
            )}
          </div>

          {/* Merged PRs */}
          {task.pull_request_url?.length > 0 && (
            <div className="tdm-sidebar-card">
              <SectionLabel icon="🔀">Pull Requests</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(Array.isArray(task.pull_request_url) ? task.pull_request_url : [task.pull_request_url]).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{
                    color: '#6750A4', textDecoration: 'none', fontWeight: 500, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>🔀</span> {url.replace(/https:\/\/github\.com\//, '')}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'costs' && hasCosts && (
        <CostsTab metadata={task.metadata} />
      )}

      {activeTab === 'comments' && (
        <TaskComments taskId={task.id} />
      )}

      {activeTab === 'activity' && (
        <ActivityLog taskId={task.id} />
      )}

      {activeTab === 'metadata' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <MetaCell label="Status"><span style={{ color: STATUS_CONFIG[task.status]?.color || '#79747E', fontWeight: 600 }}>{task.status}</span></MetaCell>
            <MetaCell label="Type"><span style={{ color: typeColor, fontWeight: 600 }}>{task.type}</span></MetaCell>
            <MetaCell label="Priority"><span style={{ color: PRIORITY_CONFIG[task.priority]?.color || 'var(--md-outline)', fontWeight: 600 }}>{task.priority || 'normal'}</span></MetaCell>
            <MetaCell label="Stage">{task.stage || <span style={{ color: 'var(--md-outline)', fontStyle: 'italic' }}>None</span>}</MetaCell>
            <MetaCell label="Assigned Agent">{task.assigned_agent || <span style={{ color: 'var(--md-outline)', fontStyle: 'italic' }}>Unassigned</span>}</MetaCell>
            <MetaCell label="QA Agent">{task.qa_agent || <span style={{ color: 'var(--md-outline)', fontStyle: 'italic' }}>None</span>}</MetaCell>
            <MetaCell label="Owner">{task.dispatched_by || <span style={{ color: 'var(--md-outline)', fontStyle: 'italic' }}>None</span>}</MetaCell>
            <MetaCell label="Project">{task.project?.name || <span style={{ color: 'var(--md-outline)', fontStyle: 'italic' }}>None</span>}</MetaCell>
            <MetaCell label="App">{task.app?.name ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>📦 {task.app.name}</span> : <span style={{ color: 'var(--md-outline)', fontStyle: 'italic' }}>None</span>}</MetaCell>
            <MetaCell label="Created"><span title={task.created_at}>{formatDateShort(task.created_at)}</span></MetaCell>
            <MetaCell label="Updated"><span title={task.updated_at}>{formatDateShort(task.updated_at)}</span></MetaCell>
            {task.started_at && <MetaCell label="Started"><span title={task.started_at}>{formatDateShort(task.started_at)}</span></MetaCell>}
            {task.completed_at && <MetaCell label="Completed"><span title={task.completed_at}>{formatDateShort(task.completed_at)}</span></MetaCell>}
          </div>
          <div style={{ borderTop: '1px solid var(--md-surface-variant, #E7E0EC)', paddingTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <MetaCell label="Dispatch Retries">{task.dispatch_retries ?? 0}</MetaCell>
              <MetaCell label="QA Retries">{task.qa_retries ?? 0}</MetaCell>
              <MetaCell label="Idle Retries">{task.idle_retries ?? 0}</MetaCell>
              <MetaCell label="Last Failed Agent">{task.last_failed_agent || <span style={{ color: 'var(--md-outline)', fontStyle: 'italic' }}>None</span>}</MetaCell>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--md-surface-variant, #E7E0EC)', paddingTop: 10 }}>
            <MetaCell label="Task ID"><span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 11 }}>{task.id}</span></MetaCell>
          </div>
        </div>
      )}

      {activeTab === 'meta' && hasFilteredMetadata && (
        <div>
          <SectionLabel icon={<Wrench size={14} />}>Task Metadata</SectionLabel>
          <div style={{ position: 'relative' }}>
            <pre style={{ fontSize: 12, fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', overflowX: 'auto', maxWidth: '100%', wordBreak: 'break-word', padding: 14, background: 'var(--md-surface-container-low, #F7F2FA)', borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)', margin: 0, lineHeight: 1.6 }}>
              <JsonSyntax data={filteredMetadata} indent={0} />
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

        {/* ── Full-card loading overlay ───────────────────── */}
        {(actionProcessing || deploying || fieldSaving) && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 250,
            background: 'rgba(255,251,254,0.7)',
            backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: isMobile ? 0 : 16,
            gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, border: '3px solid var(--md-surface-variant, #E7E0EC)',
              borderTopColor: 'var(--md-primary, #6750A4)', borderRadius: '50%',
              animation: 'tdm-spin 0.7s linear infinite',
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface-variant, #49454F)', letterSpacing: '0.02em' }}>
              {deploying ? 'Deploying…' : fieldSaving ? 'Saving…' : 'Processing…'}
            </span>
          </div>
        )}

        {/* ── Deploy success indicator ─────────────────────── */}
        {deploySuccess && !deploying && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 260,
            background: '#00838F', color: '#fff', padding: '6px 14px',
            borderRadius: 100, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(0,131,143,0.3)',
            animation: 'tdm-overlay-in 0.2s ease-out',
          }}>
            ✓ Deployed
          </div>
        )}

        {/* ── Deploy error indicator ──────────────────────── */}
        {deployError && !deploying && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 260,
            background: '#B3261E', color: '#fff', padding: '6px 14px',
            borderRadius: 100, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(179,38,30,0.3)',
            animation: 'tdm-overlay-in 0.2s ease-out',
            maxWidth: '80%',
          }}>
            ⚠️ {deployError}
            <button onClick={() => setDeployError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 16, padding: "0 4px", lineHeight: 1, fontWeight: 700 }} title="Dismiss">×</button>
          </div>
        )}

        {/* ── Save success indicator ──────────────────────── */}
        {saveSuccess && !fieldSaving && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 260,
            background: '#386A20', color: '#fff', padding: '6px 14px',
            borderRadius: 100, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(56,106,32,0.3)',
            animation: 'tdm-overlay-in 0.2s ease-out',
          }}>
            ✓ Saved
          </div>
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
              {task.paused && <Badge label="Paused" color="#E65100" bg="#E6510020" />}
              <Badge label={task.type} color={typeColor} />
              {isActive && !isMobile && !useWideLayout && <DurationTicker task={task} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ActionsDropdown
                task={task}
                onStatusChange={onStatusChange}
                onClose={handleClose}
                handleDeploy={handleDeploy}
                deploying={deploying}
                deploySuccess={deploySuccess}
                deployConfirm={deployConfirm}
                handleRebase={handleRebase}
                rebasing={rebasing}
                rebaseSuccess={rebaseSuccess}
                rebaseError={rebaseError}
                handleDeprecate={handleDeprecate}
                deprecating={deprecating}
                deprecateConfirm={deprecateConfirm}
                isMobile={isMobile}
                dropUp={false}
                actionProcessing={actionProcessing}
                setActionProcessing={setActionProcessing}
              />
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
          flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0,
          padding: isMobile ? "14px 16px 80px" : "18px 24px 24px",
        }}>
          {useWideLayout ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>{tabContent}</div>
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
          {saveError && <span style={{ color: '#D32F2F', fontSize: 12, wordBreak: 'break-word' }}><AlertTriangle size={14} /> {saveError} <button onClick={() => setSaveError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D32F2F", fontSize: 16, padding: "0 2px", lineHeight: 1 }} title="Dismiss">×</button></span>}
          {mergeConflict && <span style={{ color: '#E65100', fontSize: 12, fontWeight: 600 }}><AlertTriangle size={14} /> PR has merge conflicts</span>}
          {deployError && <span style={{ color: '#D32F2F', fontSize: 12, wordBreak: 'break-word' }}><AlertTriangle size={14} /> {deployError} <button onClick={() => setDeployError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D32F2F", fontSize: 16, padding: "0 2px", lineHeight: 1 }} title="Dismiss">×</button></span>}
          {rebaseError && <span style={{ color: '#D32F2F', fontSize: 12, wordBreak: 'break-word' }}><AlertTriangle size={14} /> {rebaseError} <button onClick={() => setRebaseError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D32F2F", fontSize: 16, padding: "0 2px", lineHeight: 1 }} title="Dismiss">×</button></span>}
          {deprecateError && <span style={{color:"#D32F2F",fontSize:13}}>{deprecateError} <button onClick={() => setDeprecateError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D32F2F", fontSize: 16, padding: "0 2px", lineHeight: 1 }} title="Dismiss">×</button></span>}
          <div style={{ flex: 1 }} />
          {!isMobile && task.created_at && (
            <span style={{ fontSize: 10, color: 'var(--md-outline, #79747E)', fontFamily: "'Roboto Mono', monospace" }}>
              {timeAgo(task.updated_at || task.created_at)}
            </span>
          )}
          <button className="tdm-action-btn" onClick={handleClose}
            style={{ background: 'var(--md-surface-container-low, #F7F2FA)', color: 'var(--md-on-surface-variant, #49454F)', border: '1px solid var(--md-surface-variant, #E7E0EC)', minHeight: isMobile ? 42 : 36 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}