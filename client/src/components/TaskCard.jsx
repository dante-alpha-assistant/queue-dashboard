import { useState, useEffect } from 'react';

const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊" };
const AGENT_ROLES = { neo: "Builder", alpha: "Leader", beta: "QA", mu: "Builder", flow: "Orchestrator" };
const STATUS_COLORS = {
  todo: "#79747E", assigned: "#6750A4", in_progress: "#E8A317", running: "#E8A317",
  done: "#386A20", failed: "#BA1A1A", qa: "#5E35B1", qa_testing: "#5E35B1", completed: "#1B5E20",
};
const PRIORITY_BADGES = { urgent: "🔴", high: "🟠", normal: "", low: "⚪" };
const TYPE_COLORS = {
  coding: "#6750A4", research: "#0061A4", ops: "#7D5260", general: "#79747E", test: "#386A20",
};
const STAGE_COLORS = {
  refinery: "#E65100", foundry: "#1565C0", builder: "#2E7D32", inspector: "#6A1B9A", deployer: "#00838F",
};
const STAGES = ["refinery", "foundry", "builder", "inspector", "deployer"];
const STAGE_LABELS = { refinery: "REF", foundry: "FND", builder: "BLD", inspector: "INS", deployer: "DEP" };
const ACTIVE_STATUSES = new Set(["in_progress", "assigned", "running", "qa_testing"]);

const mono = "'JetBrains Mono', 'Fira Code', monospace";

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

function PipelineStepper({ stage }) {
  if (!stage) return null;
  const currentIdx = STAGES.indexOf(stage);
  if (currentIdx === -1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "8px 0 4px" }}>
      {STAGES.map((s, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        const color = isCurrent ? (STAGE_COLORS[s] || "#79747E") : isCompleted ? "#386A20" : "#BDBDBD";
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 28 }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%", border: `2px solid ${color}`,
                background: (isCompleted || isCurrent) ? color : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                animation: isCurrent ? "timeline-pulse 2s ease-in-out infinite" : "none",
              }}>
                {isCompleted && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: 8, fontFamily: mono, fontWeight: 600, marginTop: 2,
                color: isCurrent ? color : isCompleted ? "#386A20" : "#BDBDBD",
                letterSpacing: "0.5px",
              }}>{STAGE_LABELS[s]}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: isCompleted ? "#386A20" : "var(--md-surface-variant, #E0E0E0)",
                marginTop: -10, minWidth: 4,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DurationTicker({ updatedAt, active }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active || !updatedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, updatedAt]);

  if (!updatedAt) return <span style={{ fontFamily: mono, fontSize: 11 }}>—</span>;
  const elapsed = (active ? now : Date.now()) - new Date(updatedAt).getTime();
  return <span style={{ fontFamily: mono, fontSize: 11, color: active ? "#E8A317" : "var(--md-on-surface-variant)" }}>{formatDuration(elapsed)}</span>;
}

export default function TaskCard({ task, onStatusChange, onDelete, onCardClick, isMobile }) {
  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";
  const role = AGENT_ROLES[agent] || "Agent";
  const statusColor = STATUS_COLORS[task.status] || "#79747E";
  const isActive = ACTIVE_STATUSES.has(task.status);

  const resultText = task.result
    ? (typeof task.result === "string" ? task.result : (task.result.summary || JSON.stringify(task.result)))
    : null;
  const errorText = task.error || null;
  const consoleText = resultText || errorText;
  const consoleColor = resultText ? "#33ff00" : "#ff4444";
  const consolePrefix = resultText ? "✓" : "✕";

  const btnStyle = {
    fontSize: 11, border: "none", padding: isMobile ? "8px 14px" : "4px 10px",
    borderRadius: 4, cursor: "pointer", fontWeight: 600, fontFamily: mono,
    minHeight: isMobile ? 44 : "auto", textTransform: "uppercase", letterSpacing: "0.5px",
  };

  return (
    <div onClick={() => onCardClick?.(task)} style={{
      background: "var(--md-background)", borderRadius: 6,
      border: "1px solid var(--md-surface-variant)",
      borderLeft: `4px solid ${statusColor}`,
      marginBottom: 8, transition: "all 200ms ease", cursor: "pointer",
      overflow: "hidden",
    }}>
      {/* Header Bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: isMobile ? "8px 12px" : "6px 12px",
        borderBottom: "1px solid var(--md-surface-variant, #E0E0E0)",
        background: "var(--md-surface, #FAFAFA)",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: mono,
            color: statusColor, textTransform: "uppercase", letterSpacing: "1px",
          }}>{task.status.replace("_", " ")}</span>
          <span style={{
            fontSize: 9, fontWeight: 600, fontFamily: mono,
            color: TYPE_COLORS[task.type] || "#79747E", textTransform: "uppercase",
            opacity: 0.8,
          }}>{task.type}</span>
          {PRIORITY_BADGES[task.priority] && (
            <span title={task.priority} style={{ fontSize: 10 }}>{PRIORITY_BADGES[task.priority]}</span>
          )}
          {task.project && (
            <span style={{
              fontSize: 9, fontFamily: mono, color: "var(--md-on-surface-variant)",
              opacity: 0.7,
            }}>/{task.project.name}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <DurationTicker updatedAt={task.updated_at} active={isActive} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: isMobile ? "10px 12px" : "8px 12px" }}>
        {/* Title */}
        <div style={{
          fontWeight: 600, fontSize: 13, marginBottom: 4,
          color: "var(--md-on-background)", lineHeight: 1.3,
        }}>
          {task.title}
        </div>

        {/* Description preview */}
        {(task.description || task.prompt) && (
          <div style={{
            color: "var(--md-on-surface-variant)", fontSize: 11, marginBottom: 6,
            lineHeight: 1.4, opacity: 0.8,
          }}>
            {(task.description || task.prompt).slice(0, 100)}
            {(task.description || task.prompt).length > 100 ? "…" : ""}
          </div>
        )}

        {/* Pipeline Stepper */}
        <PipelineStepper stage={task.stage} />

        {/* Agent + Actions Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          {agent ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontFamily: mono, color: "var(--md-on-surface-variant)",
            }}>
              {icon} <span style={{ fontWeight: 600 }}>{agent}</span>
              <span style={{ opacity: 0.5 }}>—</span>
              <span style={{ opacity: 0.6, fontStyle: "italic" }}>{role}</span>
            </span>
          ) : (
            <span style={{ fontSize: 11, fontFamily: mono, color: "#BDBDBD" }}>unassigned</span>
          )}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{
              fontSize: 9, fontFamily: mono, color: "var(--md-on-surface-variant)",
              opacity: 0.5,
            }}>{formatTime(task.created_at)}</span>
            {task.status === "todo" && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange?.(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" }); }}
                style={{ ...btnStyle, background: "var(--md-primary)", color: "var(--md-on-primary)" }}
              >[ASSIGN]</button>
            )}
            {task.status === "failed" && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange?.(task.id, { status: "assigned" }); }}
                style={{ ...btnStyle, background: "#E8A317", color: "#fff" }}
              >[RETRY]</button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Console */}
      {consoleText && (
        <div style={{
          background: "#1a1a1a", padding: "6px 12px",
          fontFamily: mono, fontSize: 11, lineHeight: 1.4,
          color: consoleColor, borderTop: "1px solid #333",
        }}>
          <span style={{ opacity: 0.5 }}>{consolePrefix} </span>
          {(typeof consoleText === "string" ? consoleText : JSON.stringify(consoleText)).slice(0, 100)}
          {(typeof consoleText === "string" ? consoleText : JSON.stringify(consoleText)).length > 100 ? "…" : ""}
        </div>
      )}
    </div>
  );
}
