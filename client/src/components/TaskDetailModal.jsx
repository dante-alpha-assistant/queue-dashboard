import { useEffect, useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

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

const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊" };
const STAGE_COLORS = {
  refinery: "#E65100", foundry: "#1565C0", builder: "#2E7D32", inspector: "#6A1B9A", deployer: "#00838F",
};
const VALID_STAGES = ["refinery", "foundry", "builder", "inspector", "deployer"];

const STATUS_CONFIG = {
  todo:        { bg: "#F1F5F9", color: "#64748B", label: "Todo" },
  assigned:    { bg: "#EDE9FE", color: "#7C3AED", label: "Assigned" },
  in_progress: { bg: "#FEF3C7", color: "#D97706", label: "In Progress" },
  running:     { bg: "#FEF3C7", color: "#D97706", label: "Running" },
  done:        { bg: "#D1FAE5", color: "#059669", label: "Done" },
  qa:          { bg: "#DBEAFE", color: "#2563EB", label: "QA Testing" },
  completed:   { bg: "#BBF7D0", color: "#16A34A", label: "Completed" },
  failed:      { bg: "#FEE2E2", color: "#DC2626", label: "Failed" },
  deployed:    { bg: "#CCFBF1", color: "#0D9488", label: "Deployed" },
};

const PRIORITY_CONFIG = {
  urgent: { bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" },
  high:   { bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" },
  normal: { bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
  low:    { bg: "#F1F5F9", color: "#94A3B8", border: "#E2E8F0" },
};

const TIMELINE_STEPS = [
  { key: 'created', label: 'Created', statuses: ['todo', 'assigned', 'in_progress', 'running', 'done', 'completed', 'failed', 'qa', 'deployed'] },
  { key: 'assigned', label: 'Assigned', statuses: ['assigned', 'in_progress', 'running', 'done', 'completed', 'failed', 'qa', 'deployed'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress', 'running', 'done', 'completed', 'failed', 'qa', 'deployed'] },
  { key: 'done', label: 'Done', statuses: ['done', 'completed', 'failed', 'qa', 'deployed'] },
  { key: 'qa', label: 'QA', statuses: ['qa', 'completed', 'deployed'] },
  { key: 'completed', label: 'Completed', statuses: ['completed', 'deployed'] },
];

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

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modalSlideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .task-modal-overlay { animation: modalFadeIn 0.2s ease-out; }
    .task-modal-panel { animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

    .task-modal-md table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
      font-size: 13px;
    }
    .task-modal-md table th,
    .task-modal-md table td {
      border: 1px solid var(--md-surface-variant, #e2e8f0);
      padding: 6px 10px;
      text-align: left;
    }
    .task-modal-md table th {
      background: var(--md-surface-variant, #f1f5f9);
      font-weight: 600;
    }
    .task-modal-md table tr:nth-child(even) td {
      background: var(--md-surface, #f8fafc);
    }
    .task-modal-md blockquote {
      border-left: 3px solid var(--md-primary, #6366f1);
      background: var(--md-surface-container-low, #f8fafc);
      margin: 8px 0;
      padding: 8px 16px;
      border-radius: 0 8px 8px 0;
    }
    .task-modal-md a {
      color: var(--md-primary, #6366f1);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .task-modal-md a:hover { opacity: 0.8; }
    .task-modal-md pre {
      background: var(--md-surface-variant, #f1f5f9);
      border-radius: 8px;
      padding: 12px;
      overflow-x: auto;
      font-size: 13px;
    }
    .task-modal-md code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
    }
    .task-modal-md code:not(pre code) {
      background: var(--md-surface-variant, #f1f5f9);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .json-collapsible-toggle {
      cursor: pointer;
      user-select: none;
      opacity: 0.5;
      font-size: 10px;
      display: inline-block;
      width: 14px;
      text-align: center;
      margin-right: 2px;
      transition: transform 0.15s, opacity 0.15s;
    }
    .json-collapsible-toggle:hover { opacity: 1; }

    .json-copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--md-surface-variant, #f1f5f9);
      border: 1px solid var(--md-outline-variant, #e2e8f0);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .json-copy-btn:hover { opacity: 1 !important; }
    div:hover > .json-copy-btn { opacity: 0.7; }

    .stage-dropdown {
      appearance: none;
      -webkit-appearance: none;
      padding: 6px 28px 6px 10px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid var(--md-surface-variant, #e2e8f0);
      background-color: var(--md-surface, #fff);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      cursor: pointer;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .stage-dropdown:focus {
      border-color: var(--md-primary, #6366f1);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    .stage-dropdown:hover {
      border-color: var(--md-outline, #94a3b8);
    }

    .action-btn {
      border: none;
      padding: 10px 20px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.15s, opacity 0.15s;
      font-family: inherit;
    }
    .action-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .action-btn:active { transform: translateY(0); }

    .action-btn-primary {
      background: var(--md-primary, #6366f1);
      color: white;
    }
    .action-btn-danger {
      background: transparent;
      color: #DC2626;
      border: 1px solid #FECACA;
    }
    .action-btn-danger:hover { background: #FEF2F2; }
    .action-btn-secondary {
      background: var(--md-surface-variant, #f1f5f9);
      color: var(--md-on-surface-variant, #64748b);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
    }
    .meta-icon {
      font-size: 14px;
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }
    .meta-label {
      font-size: 12px;
      color: var(--md-on-surface-variant, #64748b);
      font-weight: 500;
      min-width: 70px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 500;
      color: var(--md-on-background, #1e293b);
    }
  `;
  document.head.appendChild(style);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
  if (!ms || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const rm = min % 60;
  return rm > 0 ? `${hr}h ${rm}m` : `${hr}h`;
}

function processGherkinText(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const result = [];
  let inGherkin = false;
  let gherkinBlock = [];

  function flushGherkin() {
    if (gherkinBlock.length > 0) {
      result.push('%%%GHERKIN_START%%%');
      gherkinBlock.forEach(l => result.push(l));
      result.push('%%%GHERKIN_END%%%');
      gherkinBlock = [];
    }
    inGherkin = false;
  }

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (GHERKIN_TEST.test(trimmed)) {
      inGherkin = true;
      gherkinBlock.push(line);
    } else if (inGherkin && (trimmed === '' || trimmed.startsWith('|') || trimmed.startsWith('#'))) {
      gherkinBlock.push(line);
    } else {
      flushGherkin();
      result.push(line);
    }
  }
  flushGherkin();
  return result.join('\n');
}

function GherkinBlock({ text }) {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  return (
    <div style={{
      borderRadius: 8, padding: '12px 16px', margin: '8px 0',
      borderLeft: '3px solid #2E7D32', background: 'rgba(46, 125, 50, 0.04)',
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", fontSize: 13,
    }}>
      {lines.map((line, i) => {
        for (const { pattern, style } of GHERKIN_KEYWORDS) {
          const m = line.match(pattern);
          if (m) {
            return (
              <div key={i} style={{ padding: '2px 0' }}>
                {m[1]}<span style={style}>{m[2]}</span><span style={{ color: '#5D4037' }}>{m[3]}</span>
              </div>
            );
          }
        }
        return <div key={i} style={{ padding: '2px 0', color: '#5D4037', paddingLeft: 16 }}>{line}</div>;
      })}
    </div>
  );
}

function MarkdownContent({ text }) {
  const processed = processGherkinText(text);
  const parts = processed.split(/(%%%GHERKIN_START%%%[\s\S]*?%%%GHERKIN_END%%%)/);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('%%%GHERKIN_START%%%')) {
          const inner = part
            .replace('%%%GHERKIN_START%%%\n', '').replace('\n%%%GHERKIN_END%%%', '')
            .replace('%%%GHERKIN_START%%%', '').replace('%%%GHERKIN_END%%%', '');
          return <GherkinBlock key={i} text={inner} />;
        }
        if (part.trim() === '') return null;
        return (
          <div key={i} className="task-modal-md" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--md-on-background, #1e293b)' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >{part}</ReactMarkdown>
          </div>
        );
      })}
    </>
  );
}

const HAS_MARKDOWN = /[#*`]/;

function getStepTime(task, stepKey) {
  if (stepKey === 'created') return task.created_at;
  if (stepKey === 'completed' || stepKey === 'done') return task.completed_at;
  if (stepKey === 'assigned' || stepKey === 'in_progress' || stepKey === 'qa') return task.updated_at;
  return null;
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FailedIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function Timeline({ task, isMobile }) {
  const status = task.status || 'todo';
  const isFailed = status === 'failed';
  const steps = isFailed
    ? [...TIMELINE_STEPS.slice(0, -1), { key: 'failed', label: 'Failed', statuses: ['failed'] }]
    : TIMELINE_STEPS;

  const activeIdx = steps.reduce((last, s, i) => s.statuses.includes(status) ? i : last, -1);

  function getDuration(prevStep, curStep) {
    const t1 = getStepTime(task, prevStep.key);
    const t2 = getStepTime(task, curStep.key);
    if (!t1 || !t2) return null;
    const ms = new Date(t2) - new Date(t1);
    return formatDuration(ms);
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '4px 0' }}>
        {steps.map((step, i) => {
          const isCompleted = i < activeIdx;
          const isCurrent = i === activeIdx;
          const isFail = step.key === 'failed';
          const stepColor = isFail ? '#DC2626'
            : isCompleted ? '#059669'
            : isCurrent ? (STATUS_CONFIG[status]?.color || '#D97706')
            : '#CBD5E1';
          const stepTime = (isCompleted || isCurrent) ? getStepTime(task, step.key) : null;
          const duration = i > 0 && (isCompleted || isCurrent) ? getDuration(steps[i - 1], step) : null;

          return (
            <div key={step.key}>
              {i > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 9 }}>
                  <div style={{
                    width: 2, height: duration ? 24 : 16,
                    backgroundColor: isCompleted ? '#059669' : '#E2E8F0',
                    borderRadius: 1,
                  }} />
                  {duration && (
                    <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 12, fontFamily: "'JetBrains Mono', monospace" }}>{duration}</span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  className={isCurrent && !isFail ? 'timeline-pulse' : undefined}
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    backgroundColor: (isCompleted || isCurrent) ? stepColor : 'transparent',
                    border: (isCompleted || isCurrent) ? 'none' : `2px solid ${stepColor}`,
                  }}
                >
                  {isCompleted && <CheckIcon />}
                  {isFail && isCurrent && <FailedIcon />}
                  {isCurrent && !isCompleted && !isFail && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: isCurrent ? 600 : 500,
                    color: isCurrent ? 'var(--md-on-background, #1e293b)' : isCompleted ? 'var(--md-on-surface-variant, #64748b)' : '#CBD5E1',
                  }}>{step.label}</span>
                  {stepTime && (
                    <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{formatShortDate(stepTime)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '4px 0' }}>
      {steps.map((step, i) => {
        const isCompleted = i < activeIdx;
        const isCurrent = i === activeIdx;
        const isFail = step.key === 'failed';
        const stepColor = isFail ? '#DC2626'
          : isCompleted ? '#059669'
          : isCurrent ? (STATUS_CONFIG[status]?.color || '#D97706')
          : '#CBD5E1';
        const stepTime = (isCompleted || isCurrent) ? getStepTime(task, step.key) : null;
        const duration = i > 0 && (isCompleted || isCurrent) ? getDuration(steps[i - 1], step) : null;

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20 }}>
              <div
                className={isCurrent && !isFail ? 'timeline-pulse' : undefined}
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  backgroundColor: (isCompleted || isCurrent) ? stepColor : 'transparent',
                  border: (isCompleted || isCurrent) ? 'none' : `2px solid ${stepColor}`,
                  transition: 'background-color 0.2s',
                }}
              >
                {isCompleted && <CheckIcon />}
                {isFail && isCurrent && <FailedIcon />}
                {isCurrent && !isCompleted && !isFail && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                )}
              </div>
              <span style={{
                fontSize: 10, marginTop: 6, fontWeight: isCurrent ? 600 : 500, textAlign: 'center', lineHeight: 1.2,
                color: isCurrent ? 'var(--md-on-background, #1e293b)' : isCompleted ? 'var(--md-on-surface-variant, #64748b)' : '#CBD5E1',
              }}>{step.label}</span>
              {stepTime && (
                <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 2, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{formatShortDate(stepTime)}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 9, paddingLeft: 4, paddingRight: 4, minWidth: 8 }}>
                <div style={{
                  height: 2, width: '100%', borderRadius: 1,
                  backgroundColor: isCompleted ? '#059669' : '#E2E8F0',
                  transition: 'background-color 0.2s',
                }} />
                {duration && (
                  <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{duration}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CollapsibleJson({ label, data, indent }) {
  const [expanded, setExpanded] = useState(true);
  const toggle = useCallback(() => setExpanded(e => !e), []);

  return (
    <span>
      <span className="json-collapsible-toggle" onClick={toggle} style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
      {label}
      {expanded ? (
        <JsonSyntax data={data} indent={indent} _skipBrace />
      ) : (
        <span style={{ color: '#94A3B8' }}>{Array.isArray(data) ? `[…${data.length}]` : `{…${Object.keys(data).length}}`}</span>
      )}
    </span>
  );
}

function JsonSyntax({ data, indent = 0, _skipBrace = false }) {
  const pad = '\u00A0\u00A0'.repeat(indent);
  const padInner = '\u00A0\u00A0'.repeat(indent + 1);

  if (data === null) return <span style={{ color: '#DC2626' }}>null</span>;
  if (typeof data === 'boolean') return <span style={{ color: '#DC2626' }}>{String(data)}</span>;
  if (typeof data === 'number') return <span style={{ color: '#D97706' }}>{String(data)}</span>;
  if (typeof data === 'string') return <span style={{ color: '#059669' }}>"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#94A3B8' }}>[]</span>;
    if (_skipBrace) {
      return (
        <span>
          <span style={{ color: '#94A3B8' }}>[</span>{'\n'}
          {data.map((item, i) => (
            <span key={i}>
              {padInner}
              {item && typeof item === 'object' ? (
                <CollapsibleJson label="" data={item} indent={indent + 1} />
              ) : (
                <JsonSyntax data={item} indent={indent + 1} />
              )}
              {i < data.length - 1 ? <span style={{ color: '#94A3B8' }}>,</span> : null}{'\n'}
            </span>
          ))}
          {pad}<span style={{ color: '#94A3B8' }}>]</span>
        </span>
      );
    }
    return <CollapsibleJson label="" data={data} indent={indent} />;
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span style={{ color: '#94A3B8' }}>{'{}'}</span>;
    if (_skipBrace) {
      return (
        <span>
          <span style={{ color: '#94A3B8' }}>{'{'}</span>{'\n'}
          {entries.map(([key, val], i) => (
            <span key={key}>
              {padInner}<span style={{ color: '#2563EB' }}>"{key}"</span><span style={{ color: '#94A3B8' }}>: </span>
              {val && typeof val === 'object' ? (
                <CollapsibleJson label="" data={val} indent={indent + 1} />
              ) : (
                <JsonSyntax data={val} indent={indent + 1} />
              )}
              {i < entries.length - 1 ? <span style={{ color: '#94A3B8' }}>,</span> : null}{'\n'}
            </span>
          ))}
          {pad}<span style={{ color: '#94A3B8' }}>{'}'}</span>
        </span>
      );
    }
    return <CollapsibleJson label="" data={data} indent={indent} />;
  }

  return <span>{String(data)}</span>;
}

function ResultDisplay({ result, bgColor, borderColor, textColor }) {
  const [copied, setCopied] = useState(false);

  if (!result) return <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant, #94a3b8)' }}>No result yet</p>;

  let parsed = result;
  if (typeof result === 'string') {
    try { parsed = JSON.parse(result); } catch {
      if (HAS_MARKDOWN.test(result)) {
        return (
          <div className="task-modal-md" style={{
            padding: 16, background: bgColor, borderRadius: 12,
            border: `1px solid ${borderColor}`, color: textColor,
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{result}</ReactMarkdown>
          </div>
        );
      }
      return <div style={{
        fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
        padding: 16, background: bgColor, borderRadius: 12,
        border: `1px solid ${borderColor}`, color: textColor,
      }}>{result}</div>;
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return <div style={{
      fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
      padding: 16, background: bgColor, borderRadius: 12,
      border: `1px solid ${borderColor}`, color: textColor,
    }}>{String(parsed)}</div>;
  }

  const summaryMd = parsed.summary && typeof parsed.summary === 'string' && HAS_MARKDOWN.test(parsed.summary);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(parsed, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <>
      {summaryMd && (
        <div className="task-modal-md" style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.7, color: 'var(--md-on-background, #1e293b)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{parsed.summary}</ReactMarkdown>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <button className="json-copy-btn" onClick={handleCopy}>
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
        <pre style={{
          fontSize: 12, fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", whiteSpace: 'pre-wrap', overflowX: 'auto',
          padding: 16, paddingTop: 32, background: 'var(--md-surface, #f8fafc)', borderRadius: 12,
          border: '1px solid var(--md-surface-variant, #e2e8f0)', margin: 0, lineHeight: 1.6,
        }}>
          <JsonSyntax data={parsed} indent={0} />
        </pre>
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.todo;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: config.bg, color: config.color,
      letterSpacing: '0.02em', lineHeight: '18px', display: 'inline-block',
    }}>{config.label || status.replace("_", " ")}</span>
  );
}

function PriorityBadge({ priority }) {
  if (!priority || priority === 'normal') return null;
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  const isUrgentOrHigh = priority === 'urgent' || priority === 'high';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: config.bg, color: config.color,
      border: `1px solid ${config.border}`,
      letterSpacing: '0.02em', lineHeight: '18px', display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {isUrgentOrHigh && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
        </svg>
      )}
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
      background: 'var(--md-surface-variant, #f1f5f9)', color: 'var(--md-on-surface-variant, #64748b)',
      letterSpacing: '0.02em', lineHeight: '18px', display: 'inline-block',
    }}>{type}</span>
  );
}

function MetaItem({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="meta-item">
      <span className="meta-icon">{icon}</span>
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'var(--md-on-surface-variant, #64748b)',
      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
    }}>{children}</div>
  );
}

export default function TaskDetailModal({ task, onClose, onStatusChange, onDelete, isMobile, isTablet }) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);

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

  if (!task) return null;

  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";

  const overlayStyle = isMobile ? {
    position: "fixed", inset: 0, background: "var(--md-background, #fff)", zIndex: 200,
    display: "flex", flexDirection: "column",
    opacity: closing ? 0 : 1, transition: 'opacity 0.2s',
  } : {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    opacity: closing ? 0 : 1, transition: 'opacity 0.2s',
  };

  const panelStyle = isMobile ? {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
  } : {
    background: "var(--md-background, #fff)", borderRadius: 16, padding: 0,
    width: 720, maxWidth: "90vw",
    maxHeight: "85vh", overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
    transform: closing ? 'translateY(8px) scale(0.98)' : 'none',
    transition: 'transform 0.2s',
  };

  return (
    <div className={isMobile ? undefined : 'task-modal-overlay'} style={overlayStyle} onClick={isMobile ? undefined : handleClose}>
      <div ref={panelRef} className={isMobile ? undefined : 'task-modal-panel'} style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--md-surface-variant, #e2e8f0)" }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          padding: isMobile ? "16px 16px 16px" : "28px 32px 20px",
          borderBottom: "1px solid var(--md-surface-variant, #e2e8f0)",
        }}>
          {/* Close button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={task.status} />
              <TypeBadge type={task.type} />
              <PriorityBadge priority={task.priority} />
            </div>
            <button onClick={handleClose} style={{
              background: "var(--md-surface-variant, #f1f5f9)", border: "none", cursor: "pointer",
              fontSize: 14, color: "var(--md-on-surface-variant, #64748b)", padding: 0, lineHeight: 1,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.target.style.background = 'var(--md-surface-variant, #e2e8f0)'}
            onMouseLeave={e => e.target.style.background = 'var(--md-surface-variant, #f1f5f9)'}
            >✕</button>
          </div>

          {/* Title */}
          <h2 style={{
            margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, lineHeight: 1.35,
            color: "var(--md-on-background, #0f172a)", letterSpacing: '-0.01em',
          }}>
            {task.title}
          </h2>
        </div>

        {/* Scrollable body */}
        <div style={{
          padding: isMobile ? "16px 16px 100px" : "20px 32px 100px",
          overflowY: "auto", flex: isMobile ? 1 : "none",
          maxHeight: isMobile ? "none" : "calc(85vh - 220px)",
        }}>
          {/* Metadata grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 0,
            marginBottom: 24,
            padding: '4px 0',
            borderBottom: '1px solid var(--md-surface-variant, #e2e8f0)',
          }}>
            {task.project && <MetaItem icon="📁" label="Project" value={task.project.name} />}
            {agent && <MetaItem icon="🤖" label="Agent" value={`${icon} ${agent}`} />}
            {task.dispatched_by && <MetaItem icon="👤" label="Dispatched" value={task.dispatched_by} />}
            <MetaItem icon="📅" label="Created" value={formatDate(task.created_at)} />
            {task.started_at && <MetaItem icon="▶️" label="Started" value={formatDate(task.started_at)} />}
            {task.completed_at && (task.status === "completed" || task.status === "done") && (
              <MetaItem icon="✅" label="Completed" value={formatDate(task.completed_at)} />
            )}
            <div className="meta-item">
              <span className="meta-icon">🏷️</span>
              <span className="meta-label">Stage</span>
              <select
                className="stage-dropdown"
                value={task.stage || ""}
                onChange={e => onStatusChange(task.id, { stage: e.target.value || null })}
                onClick={e => e.stopPropagation()}
                style={{
                  color: task.stage ? (STAGE_COLORS[task.stage] || 'var(--md-on-surface-variant, #64748b)') : 'var(--md-on-surface-variant, #64748b)',
                }}
              >
                <option value="">None</option>
                {VALID_STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ marginBottom: 24 }}>
            <SectionHeader>Timeline</SectionHeader>
            <div style={{
              padding: isMobile ? 12 : 16,
              background: 'var(--md-surface, #f8fafc)',
              borderRadius: 12,
              border: '1px solid var(--md-surface-variant, #e2e8f0)',
            }}>
              <Timeline task={task} isMobile={isMobile} />
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Description</SectionHeader>
              <div style={{
                padding: isMobile ? 14 : 20,
                background: "var(--md-surface, #f8fafc)", borderRadius: 12,
                border: "1px solid var(--md-surface-variant, #e2e8f0)",
              }}>
                <MarkdownContent text={task.description} />
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          {task.acceptance_criteria && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>Acceptance Criteria</SectionHeader>
              <div style={{
                padding: isMobile ? 14 : 20,
                background: "var(--md-warning-container, #FFFBEB)",
                borderRadius: 12,
                border: "1px solid var(--md-outline-variant, #FDE68A)",
              }}>
                <MarkdownContent text={task.acceptance_criteria} />
              </div>
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>
                <span style={{ color: "#059669" }}>✓ Result</span>
              </SectionHeader>
              <ResultDisplay result={task.result} bgColor="var(--md-success-container, #ECFDF5)" borderColor="var(--md-outline-variant, #A7F3D0)" textColor="var(--md-on-success-container, #065F46)" />
            </div>
          )}

          {/* QA Result */}
          {task.qa_result && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>
                <span style={{ color: task.qa_result.passed ? "#059669" : "#DC2626" }}>
                  {task.qa_result.passed ? "✓ QA Passed" : "✕ QA Failed"}
                </span>
              </SectionHeader>
              <ResultDisplay
                result={task.qa_result}
                bgColor={task.qa_result.passed ? "#ECFDF5" : "#FEF2F2"}
                borderColor={task.qa_result.passed ? "#A7F3D0" : "#FECACA"}
                textColor={task.qa_result.passed ? "#065F46" : "#991B1B"}
              />
            </div>
          )}

          {/* Error */}
          {task.error && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader>
                <span style={{ color: "#DC2626" }}>✕ Error</span>
              </SectionHeader>
              <div style={{
                fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                padding: isMobile ? 14 : 20, background: "#FEF2F2", borderRadius: 12,
                border: "1px solid #FECACA", color: "#991B1B",
              }}>{task.error}</div>
            </div>
          )}

          {/* Task ID */}
          <div style={{
            fontSize: 11, color: '#94A3B8', marginTop: 8,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {task.id}
          </div>
        </div>

        {/* Sticky action footer */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: isMobile ? '12px 16px' : '12px 32px',
          background: 'var(--md-background, #fff)',
          borderTop: '1px solid var(--md-surface-variant, #e2e8f0)',
          display: 'flex', gap: 8, alignItems: 'center',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          {task.status === "todo" && (
            <button className="action-btn action-btn-primary" onClick={() => {
              onStatusChange(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" });
            }} style={{ minHeight: isMobile ? 44 : 36 }}>
              Assign
            </button>
          )}
          {task.status === "failed" && (
            <button className="action-btn" onClick={() => {
              onStatusChange(task.id, { status: "todo" });
            }} style={{ background: '#D97706', color: 'white', minHeight: isMobile ? 44 : 36 }}>
              Retry
            </button>
          )}
          {(task.status === "done" || task.status === "completed") && (
            <button className="action-btn action-btn-secondary" onClick={() => {
              onStatusChange(task.id, { status: "todo" });
            }} style={{ minHeight: isMobile ? 44 : 36 }}>
              Reopen
            </button>
          )}
          <div style={{ flex: 1 }} />
          {onDelete && (
            <button className="action-btn action-btn-danger" onClick={() => {
              if (window.confirm('Delete this task?')) onDelete(task.id);
            }} style={{ minHeight: isMobile ? 44 : 36 }}>
              Delete
            </button>
          )}
          <button className="action-btn action-btn-secondary" onClick={handleClose}
            style={{ minHeight: isMobile ? 44 : 36 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
