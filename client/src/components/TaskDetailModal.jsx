import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
const STATUS_STYLES = {
  todo: { bg: "#E8E8E8", color: "#49454F" },
  assigned: { bg: "#E8DEF8", color: "#4F378B" },
  in_progress: { bg: "#FFF3E0", color: "#E65100" },
  running: { bg: "#FFF3E0", color: "#E65100" },
  done: { bg: "#E8F5E9", color: "#2E7D32" },
  qa: { bg: "#EDE7F6", color: "#5E35B1" },
  completed: { bg: "#C8E6C9", color: "#1B5E20" },
  failed: { bg: "#FFDAD6", color: "#BA1A1A" },
};

const TIMELINE_STEPS = [
  { key: 'created', label: 'Created', statuses: ['todo', 'assigned', 'in_progress', 'running', 'done', 'completed', 'failed', 'qa'] },
  { key: 'assigned', label: 'Assigned', statuses: ['assigned', 'in_progress', 'running', 'done', 'completed', 'failed', 'qa'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress', 'running', 'done', 'completed', 'failed', 'qa'] },
  { key: 'done', label: 'Done', statuses: ['done', 'completed', 'failed', 'qa'] },
  { key: 'qa', label: 'QA', statuses: ['qa', 'completed'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
];

const PULSE_STYLE_ID = 'task-modal-pulse-style';
function ensurePulseStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes timeline-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.15); }
    }
    .timeline-pulse { animation: timeline-pulse 2s ease-in-out infinite; }
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
      borderLeft: '4px solid #2E7D32', background: 'rgba(46, 125, 50, 0.06)',
      fontFamily: 'monospace', fontSize: 13,
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
          <div key={i} style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--md-on-background)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
          </div>
        );
      })}
    </>
  );
}

function getStepTime(task, stepKey) {
  if (stepKey === 'created') return task.created_at;
  if (stepKey === 'completed' || stepKey === 'done') return task.completed_at;
  if (stepKey === 'assigned' || stepKey === 'in_progress' || stepKey === 'qa') return task.updated_at;
  return null;
}

function Timeline({ task }) {
  useEffect(() => { ensurePulseStyle(); }, []);

  const status = task.status || 'todo';
  const isFailed = status === 'failed';
  const steps = isFailed
    ? [...TIMELINE_STEPS.slice(0, -1), { key: 'failed', label: 'Failed', statuses: ['failed'] }]
    : TIMELINE_STEPS;

  const activeIdx = steps.reduce((last, s, i) => s.statuses.includes(status) ? i : last, -1);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 0', alignItems: 'flex-start' }}>
      {steps.map((step, i) => {
        const isCompleted = i < activeIdx;
        const isCurrent = i === activeIdx;
        const isFail = step.key === 'failed';
        const stepColor = isFail ? '#BA1A1A'
          : isCompleted ? '#2E7D32'
          : isCurrent ? (STATUS_STYLES[status]?.color || '#E65100')
          : '#BDBDBD';
        const stepTime = (isCompleted || isCurrent) ? getStepTime(task, step.key) : null;

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 70 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                className={isCurrent ? 'timeline-pulse' : undefined}
                style={{
                  width: 20, height: 20, borderRadius: '50%', border: `2px solid ${stepColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  backgroundColor: (isCompleted || isCurrent) ? stepColor : 'transparent',
                }}
              >
                {isCompleted && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isCurrent && !isCompleted && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                )}
              </div>
              <span style={{
                fontSize: 10, marginTop: 6, fontWeight: 500, textAlign: 'center', lineHeight: 1.2,
                color: isCurrent ? 'var(--md-on-background)' : isCompleted ? '#666' : '#BDBDBD',
              }}>{step.label}</span>
              {stepTime && (
                <span style={{ fontSize: 9, color: '#999', marginTop: 2, textAlign: 'center' }}>{formatShortDate(stepTime)}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 10, paddingLeft: 4, paddingRight: 4, minWidth: 12 }}>
                <div style={{ height: 2, width: '100%', borderRadius: 1, backgroundColor: isCompleted ? '#2E7D32' : '#E0E0E0' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function JsonSyntax({ data, indent = 0 }) {
  const pad = '\u00A0\u00A0'.repeat(indent);
  const padInner = '\u00A0\u00A0'.repeat(indent + 1);

  if (data === null) return <span style={{ color: '#BA1A1A' }}>null</span>;
  if (typeof data === 'boolean') return <span style={{ color: '#BA1A1A' }}>{String(data)}</span>;
  if (typeof data === 'number') return <span style={{ color: '#E65100' }}>{String(data)}</span>;
  if (typeof data === 'string') return <span style={{ color: '#2E7D32' }}>"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#757575' }}>[]</span>;
    return (
      <span>
        <span style={{ color: '#757575' }}>[</span>{'\n'}
        {data.map((item, i) => (
          <span key={i}>
            {padInner}<JsonSyntax data={item} indent={indent + 1} />
            {i < data.length - 1 ? <span style={{ color: '#757575' }}>,</span> : null}{'\n'}
          </span>
        ))}
        {pad}<span style={{ color: '#757575' }}>]</span>
      </span>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span style={{ color: '#757575' }}>{'{}'}</span>;
    return (
      <span>
        <span style={{ color: '#757575' }}>{'{'}</span>{'\n'}
        {entries.map(([key, val], i) => (
          <span key={key}>
            {padInner}<span style={{ color: '#1565C0' }}>"{key}"</span><span style={{ color: '#757575' }}>: </span><JsonSyntax data={val} indent={indent + 1} />
            {i < entries.length - 1 ? <span style={{ color: '#757575' }}>,</span> : null}{'\n'}
          </span>
        ))}
        {pad}<span style={{ color: '#757575' }}>{'}'}</span>
      </span>
    );
  }

  return <span>{String(data)}</span>;
}

function ResultDisplay({ result, bgColor, borderColor, textColor }) {
  if (!result) return <p style={{ fontSize: 14, color: '#999' }}>No result yet</p>;

  let parsed = result;
  if (typeof result === 'string') {
    try { parsed = JSON.parse(result); } catch {
      return <div style={{
        fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
        padding: 16, background: bgColor, borderRadius: 12,
        border: `1px solid ${borderColor}`, color: textColor,
      }}>{result}</div>;
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return <div style={{
      fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
      padding: 16, background: bgColor, borderRadius: 12,
      border: `1px solid ${borderColor}`, color: textColor,
    }}>{String(parsed)}</div>;
  }

  return (
    <pre style={{
      fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto',
      padding: 16, background: '#FAFAFA', borderRadius: 12,
      border: '1px solid #E0E0E0', margin: 0, lineHeight: 1.6,
    }}>
      <JsonSyntax data={parsed} indent={0} />
    </pre>
  );
}

export default function TaskDetailModal({ task, onClose, onStatusChange, onDelete, isMobile, isTablet }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!task) return null;

  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";
  const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.todo;

  const overlayStyle = isMobile ? {
    position: "fixed", inset: 0, background: "var(--md-background)", zIndex: 200,
    display: "flex", flexDirection: "column",
    animation: "slideUp 0.3s ease-out",
  } : {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    backdropFilter: "blur(4px)",
  };

  const panelStyle = isMobile ? {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
  } : {
    background: "var(--md-background)", borderRadius: 20, padding: 0,
    width: isTablet ? "90%" : 600, maxWidth: isTablet ? 600 : "none",
    maxHeight: "85vh", overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
  };

  const sectionLabelStyle = {
    fontSize: 12, fontWeight: 600, color: "#999",
    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6,
  };

  return (
    <div style={overlayStyle} onClick={isMobile ? undefined : onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--md-surface-variant)" }} />
          </div>
        )}

        <div style={{ padding: isMobile ? "12px 16px 12px" : "24px 24px 16px", borderBottom: "1px solid var(--md-surface-variant)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: statusStyle.bg, color: statusStyle.color,
                textTransform: "uppercase", letterSpacing: "0.5px",
              }}>{task.status.replace("_", " ")}</span>
              <span style={{
                padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                background: "#F3F3F3", color: "#666", textTransform: "uppercase",
              }}>{task.type}</span>
              {task.priority && task.priority !== "normal" && (
                <span style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  background: task.priority === "urgent" ? "#FFDAD6" : "#FFE0B2",
                  color: task.priority === "urgent" ? "#BA1A1A" : "#E65100",
                  textTransform: "uppercase",
                }}>{task.priority}</span>
              )}
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "var(--md-on-surface-variant)", padding: 8, lineHeight: 1,
              minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, lineHeight: 1.3, color: "var(--md-on-background)" }}>
            {task.title}
          </h2>
        </div>

        <div style={{ padding: isMobile ? "12px 16px 16px" : "16px 24px 24px", overflowY: "auto", flex: isMobile ? 1 : "none", maxHeight: isMobile ? "none" : "calc(85vh - 200px)" }}>
          <div style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12, marginBottom: 20,
          }}>
            {task.project && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Project</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{task.project.name}</div>
              </div>
            )}
            {agent && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Agent</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{icon} {agent}</div>
              </div>
            )}
            {task.dispatched_by && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Dispatched by</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{task.dispatched_by}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Created</div>
              <div style={{ fontSize: 14 }}>{formatDate(task.created_at)}</div>
            </div>
            {task.started_at && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Started</div>
                <div style={{ fontSize: 14 }}>{formatDate(task.started_at)}</div>
              </div>
            )}
            {task.completed_at && (task.status === "completed" || task.status === "done") && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Completed</div>
                <div style={{ fontSize: 14 }}>{formatDate(task.completed_at)}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Stage</div>
              <select
                value={task.stage || ""}
                onChange={e => onStatusChange(task.id, { stage: e.target.value || null })}
                onClick={e => e.stopPropagation()}
                style={{
                  padding: "4px 8px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: "1px solid var(--md-surface-variant)", background: "var(--md-surface)",
                  color: task.stage ? (STAGE_COLORS[task.stage] || "#666") : "#999",
                  cursor: "pointer", fontFamily: "'Roboto', system-ui, sans-serif", outline: "none",
                }}
              >
                <option value="">None</option>
                {VALID_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={sectionLabelStyle}>Timeline</div>
            <div style={{
              padding: isMobile ? 12 : 16, background: 'var(--md-surface)',
              borderRadius: 12, border: '1px solid var(--md-surface-variant)',
            }}>
              <Timeline task={task} />
            </div>
          </div>

          {task.description && (
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>Description</div>
              <div style={{
                padding: isMobile ? 12 : 16,
                background: "var(--md-surface)", borderRadius: 12,
                border: "1px solid var(--md-surface-variant)",
              }}>
                <MarkdownContent text={task.description} />
              </div>
            </div>
          )}

          {task.acceptance_criteria && (
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>Acceptance Criteria</div>
              <div style={{
                padding: isMobile ? 12 : 16, background: "#FFFDE7", borderRadius: 12,
                border: "1px solid #FFF9C4",
              }}>
                <MarkdownContent text={task.acceptance_criteria} />
              </div>
            </div>
          )}

          {task.result && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...sectionLabelStyle, color: "#2E7D32" }}>✓ Result</div>
              <ResultDisplay result={task.result} bgColor="#E8F5E9" borderColor="#C8E6C9" textColor="#1B5E20" />
            </div>
          )}

          {task.qa_result && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...sectionLabelStyle, color: task.qa_result.passed ? "#2E7D32" : "#BA1A1A" }}>
                {task.qa_result.passed ? "✓ QA Passed" : "✕ QA Failed"}
              </div>
              <ResultDisplay
                result={task.qa_result}
                bgColor={task.qa_result.passed ? "#E8F5E9" : "#FBE9E7"}
                borderColor={task.qa_result.passed ? "#C8E6C9" : "#FFCCBC"}
                textColor={task.qa_result.passed ? "#1B5E20" : "#BF360C"}
              />
            </div>
          )}

          {task.error && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...sectionLabelStyle, color: "#BA1A1A" }}>✕ Error</div>
              <div style={{
                fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                padding: isMobile ? 12 : 16, background: "#FBE9E7", borderRadius: 12,
                border: "1px solid #FFCCBC", color: "#BF360C",
              }}>{task.error}</div>
            </div>
          )}

          <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace", marginTop: 8 }}>
            {task.id}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {task.status === "todo" && (
              <button onClick={() => { onStatusChange(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" }); }} style={{
                flex: 1, background: "var(--md-primary)", color: "var(--md-on-primary)",
                border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer",
                minHeight: isMobile ? 48 : "auto",
              }}>Assign</button>
            )}
            {task.status === "failed" && (
              <button onClick={() => { onStatusChange(task.id, { status: "todo" }); }} style={{
                flex: 1, background: "#E8A317", color: "#fff",
                border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer",
                minHeight: isMobile ? 48 : "auto",
              }}>Retry</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
