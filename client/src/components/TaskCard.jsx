import { useState, useEffect } from 'react';

const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊", ifra: "🛠️" };
const AGENT_ROLES = { neo: "Builder", alpha: "Leader", beta: "QA", mu: "Builder", flow: "Orchestrator", ifra: "Ops" };
const STATUS_COLORS = {
  todo: "#79747E", assigned: "#6750A4", in_progress: "#E8A317", running: "#E8A317",
  done: "#386A20", failed: "#BA1A1A", qa: "#5E35B1", qa_testing: "#5E35B1",
  completed: "#1B5E20", deployed: "#00838F",
};
const STATUS_BG = {
  todo: "#79747E14", assigned: "#6750A414", in_progress: "#E8A31714", running: "#E8A31714",
  done: "#386A2014", failed: "#BA1A1A14", qa: "#5E35B114", qa_testing: "#5E35B114",
  completed: "#1B5E2014", deployed: "#00838F14",
};
const PRIORITY_MAP = {
  urgent: { color: "#D32F2F", bg: "#D32F2F14", label: "Urgent" },
  high: { color: "#E65100", bg: "#E6510014", label: "High" },
  normal: null,
  low: { color: "#757575", bg: "#75757514", label: "Low" },
};
const TYPE_COLORS = {
  coding: "#6750A4", research: "#0061A4", ops: "#7D5260", general: "#79747E", test: "#386A20",
};
const STAGE_COLORS = {
  refinery: "#E65100", foundry: "#1565C0", builder: "#2E7D32", inspector: "#6A1B9A", deployer: "#00838F",
};
const STAGES = ["refinery", "foundry", "builder", "inspector", "deployer"];
const STAGE_LABELS = { refinery: "Refine", foundry: "Found", builder: "Build", inspector: "Inspect", deployer: "Deploy" };
const STAGE_SHORT = { refinery: "REF", foundry: "FND", builder: "BLD", inspector: "INS", deployer: "DEP" };
const ACTIVE_STATUSES = new Set(["in_progress", "assigned", "running", "qa_testing"]);

function formatDuration(ms) {
  if (!ms || ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Pipeline Stepper ─────────────────────────────────────── */
function PipelineStepper({ stage, isMobile }) {
  if (!stage) return null;
  const currentIdx = STAGES.indexOf(stage);
  if (currentIdx === -1) return null;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 0,
      margin: "12px 0 4px", padding: "0 4px",
    }}>
      {STAGES.map((s, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        const color = isCurrent ? (STAGE_COLORS[s] || "#79747E") : isCompleted ? "#386A20" : "var(--md-outline-variant, #CAC4D0)";
        const label = isMobile ? STAGE_SHORT[s] : STAGE_LABELS[s];
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              minWidth: isMobile ? 28 : 40, gap: 4,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: `2px solid ${color}`,
                background: (isCompleted || isCurrent) ? color : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                animation: isCurrent ? "timeline-pulse 2s ease-in-out infinite" : "none",
                transition: "all 200ms ease",
              }}>
                {isCompleted && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: isMobile ? 9 : 10,
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? color : isCompleted ? "#386A20" : "var(--md-outline-variant, #CAC4D0)",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}>{label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 8,
                background: isCompleted ? "#386A20" : "var(--md-surface-variant, #E7E0EC)",
                marginTop: -12, borderRadius: 1,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Duration Ticker ──────────────────────────────────────── */
function DurationTicker({ updatedAt, active }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active || !updatedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, updatedAt]);

  if (!updatedAt) return null;
  const elapsed = (active ? now : Date.now()) - new Date(updatedAt).getTime();
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums",
      color: active ? "#E8A317" : "var(--md-on-surface-variant, #49454F)",
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
      {formatDuration(elapsed)}
    </span>
  );
}

/* ── Badge (pill) ─────────────────────────────────────────── */
function Badge({ label, color, bg, style: extraStyle }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
      background: bg || `${color}14`, color: color,
      textTransform: "uppercase", letterSpacing: "0.04em",
      lineHeight: 1.2, whiteSpace: "nowrap",
      fontFamily: "'Roboto', system-ui, sans-serif",
      ...extraStyle,
    }}>{label}</span>
  );
}

/* ── Action Bar ───────────────────────────────────────────── */
function ActionBar({ task, onStatusChange, onDelete, isMobile }) {
  const btnBase = {
    fontSize: 12, border: "none", padding: isMobile ? "8px 18px" : "6px 16px",
    borderRadius: 100, cursor: "pointer", fontWeight: 600,
    fontFamily: "'Roboto', system-ui, sans-serif",
    minHeight: isMobile ? 44 : 32, letterSpacing: "0.02em",
    transition: "all 150ms ease",
    display: "inline-flex", alignItems: "center", gap: 6,
  };

  const actions = [];

  if (task.status === "failed") {
    actions.push(
      <button
        key="retry"
        onClick={(e) => { e.stopPropagation(); onStatusChange?.(task.id, { status: "assigned" }); }}
        style={{ ...btnBase, background: "#E65100", color: "#fff" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 105.64-12.48L1 10" />
        </svg>
        Retry
      </button>
    );
  }

  if (task.status === "todo") {
    actions.push(
      <button
        key="assign"
        onClick={(e) => { e.stopPropagation(); onStatusChange?.(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" }); }}
        style={{ ...btnBase, background: "var(--md-primary, #6750A4)", color: "var(--md-on-primary, #fff)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
        </svg>
        Assign
      </button>
    );
  }

  // View button always available
  actions.push(
    <button
      key="view"
      onClick={(e) => { e.stopPropagation(); /* handled by card click */ }}
      style={{ ...btnBase, background: "var(--md-surface-variant, #E7E0EC)", color: "var(--md-on-surface-variant, #49454F)" }}
    >
      View
    </button>
  );

  if (actions.length === 0) return null;

  return (
    <div style={{
      display: "flex", gap: 8, padding: "8px 16px 12px",
      justifyContent: "flex-end", alignItems: "center",
      borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
    }}>
      {actions}
    </div>
  );
}

/* ── Task Card ────────────────────────────────────────────── */
export default function TaskCard({ task, onStatusChange, onDelete, onCardClick, isMobile }) {
  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";
  const role = AGENT_ROLES[agent] || "Agent";
  const statusColor = STATUS_COLORS[task.status] || "#79747E";
  const isActive = ACTIVE_STATUSES.has(task.status);
  const priority = PRIORITY_MAP[task.priority];
  const typeColor = TYPE_COLORS[task.type] || "#79747E";

  const resultText = task.result
    ? (typeof task.result === "string" ? task.result : (task.result.summary || JSON.stringify(task.result)))
    : null;
  const errorText = task.error || null;
  const consoleText = resultText || errorText;
  const isError = !resultText && !!errorText;

  return (
    <div onClick={() => onCardClick?.(task)} style={{
      background: "var(--md-surface, #FFFBFE)",
      borderRadius: 16,
      border: "1px solid var(--md-surface-variant, #E7E0EC)",
      borderLeft: `4px solid ${statusColor}`,
      marginBottom: 12,
      transition: "box-shadow 200ms ease, transform 100ms ease",
      cursor: "pointer",
      overflow: "hidden",
      fontFamily: "'Roboto', system-ui, -apple-system, sans-serif",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px 8px",
      }}>
        {/* Badges row */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge
            label={task.status.replace("_", " ")}
            color={statusColor}
            bg={STATUS_BG[task.status] || `${statusColor}14`}
          />
          <Badge label={task.type} color={typeColor} />
          {priority && (
            <Badge label={priority.label} color={priority.color} bg={priority.bg} />
          )}
        </div>
        {/* Duration */}
        <DurationTicker updatedAt={task.updated_at} active={isActive} />
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div style={{ padding: "4px 16px 12px" }}>
        {/* Title */}
        <div style={{
          fontWeight: 600, fontSize: 14, lineHeight: 1.4,
          color: "var(--md-on-surface, #1C1B1F)",
          marginBottom: 4,
        }}>
          {task.title}
        </div>

        {/* Description preview */}
        {(task.description || task.prompt) && (
          <div style={{
            color: "var(--md-on-surface-variant, #49454F)",
            fontSize: 13, lineHeight: 1.5,
            marginBottom: 8, opacity: 0.75,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {(task.description || task.prompt).slice(0, 120)}
            {(task.description || task.prompt).length > 120 ? "…" : ""}
          </div>
        )}

        {/* Pipeline Stepper */}
        <PipelineStepper stage={task.stage} isMobile={isMobile} />

        {/* Agent info + date */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 8, gap: 12,
        }}>
          {agent ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "var(--md-on-surface-variant, #49454F)",
            }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
              <span style={{ fontWeight: 600 }}>{agent}</span>
              <span style={{ color: "var(--md-outline, #79747E)", fontSize: 12 }}>·</span>
              <span style={{
                color: "var(--md-outline, #79747E)", fontSize: 12,
                fontStyle: "italic",
              }}>{role}</span>
            </div>
          ) : (
            <span style={{
              fontSize: 12, color: "var(--md-outline, #79747E)",
              fontStyle: "italic",
            }}>Unassigned</span>
          )}
          <span style={{
            fontSize: 11, color: "var(--md-outline, #79747E)",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>{formatTime(task.created_at)}</span>
        </div>

        {task.project && (
          <div style={{
            fontSize: 11, color: "var(--md-outline, #79747E)",
            marginTop: 4, fontWeight: 500,
          }}>
            📁 {task.project.name}
          </div>
        )}
      </div>

      {/* ── Error / Result Banner ───────────────────────── */}
      {consoleText && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 16px",
          background: isError ? "#FDECEA" : "#E8F5E9",
          borderTop: `1px solid ${isError ? "#F5C6CB" : "#C8E6C9"}`,
          fontSize: 12, lineHeight: 1.5,
          color: isError ? "#B71C1C" : "#1B5E20",
        }}>
          <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
            {isError ? "⚠️" : "✅"}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, display: "block", marginBottom: 2 }}>
              {isError ? "Error" : "Result"}
            </span>
            {(typeof consoleText === "string" ? consoleText : JSON.stringify(consoleText)).slice(0, 140)}
            {(typeof consoleText === "string" ? consoleText : JSON.stringify(consoleText)).length > 140 ? "…" : ""}
          </span>
        </div>
      )}

      {/* ── Action Bar ──────────────────────────────────── */}
      {(task.status === "failed" || task.status === "todo") && (
        <ActionBar
          task={task}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
