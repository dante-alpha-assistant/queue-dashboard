import { useState } from "react";

const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊" };
const STATUS_COLORS = {
  todo: "#79747E", assigned: "#6750A4", in_progress: "#E8A317",
  done: "#386A20", qa: "#7B5EA7", completed: "#1B5E20", failed: "#BA1A1A",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function TaskDetailModal({ task, onClose, onStatusChange, onDelete }) {
  if (!task) return null;

  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";

  const sectionStyle = {
    marginBottom: 16, padding: 12, background: "var(--md-surface)",
    borderRadius: 12, border: "1px solid var(--md-surface-variant)",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-background)", borderRadius: 24, padding: 24,
        width: 560, maxHeight: "85vh", overflow: "auto",
        border: "1px solid var(--md-surface-variant)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span style={{
                background: STATUS_COLORS[task.status] || "#79747E", color: "#fff",
                padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                textTransform: "uppercase",
              }}>{task.status.replace("_", " ")}</span>
              <span style={{
                background: "#E8DEF8", color: "#4F378B",
                padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 500,
              }}>{task.type}</span>
              {task.priority !== "normal" && (
                <span style={{
                  padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 500,
                  background: task.priority === "urgent" ? "#FFDAD6" : task.priority === "high" ? "#FFE0B2" : "#E8E8E8",
                  color: task.priority === "urgent" ? "#BA1A1A" : task.priority === "high" ? "#E65100" : "#666",
                }}>{task.priority}</span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--md-on-background)" }}>
              {task.title}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: "var(--md-surface-variant)", border: "none", borderRadius: 12,
            width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "var(--md-on-surface-variant)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Project & Agent */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {task.project && (
            <div style={{ ...sectionStyle, flex: 1, marginBottom: 0 }}>
              <div style={labelStyle}>Project</div>
              <div style={{ fontWeight: 500 }}>{task.project.name}</div>
            </div>
          )}
          {agent && (
            <div style={{ ...sectionStyle, flex: 1, marginBottom: 0 }}>
              <div style={labelStyle}>Assigned To</div>
              <div style={{ fontWeight: 500 }}>{icon} {agent}</div>
            </div>
          )}
          {task.dispatched_by && (
            <div style={{ ...sectionStyle, flex: 1, marginBottom: 0 }}>
              <div style={labelStyle}>Dispatched By</div>
              <div style={{ fontWeight: 500 }}>{task.dispatched_by}</div>
            </div>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div style={sectionStyle}>
            <div style={labelStyle}>Description</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--md-on-background)" }}>
              {task.description}
            </div>
          </div>
        )}

        {/* Acceptance Criteria */}
        {task.acceptance_criteria && (
          <div style={sectionStyle}>
            <div style={labelStyle}>Acceptance Criteria</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--md-on-background)" }}>
              {task.acceptance_criteria}
            </div>
          </div>
        )}

        {/* Result */}
        {task.result && (
          <div style={{ ...sectionStyle, borderColor: "#C8E6C9" }}>
            <div style={labelStyle}>Result</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "#386A20" }}>
              {typeof task.result === "string" ? task.result : JSON.stringify(task.result, null, 2)}
            </div>
          </div>
        )}

        {/* QA Result */}
        {task.qa_result && (
          <div style={{ ...sectionStyle, borderColor: task.qa_result.passed ? "#C8E6C9" : "#FFDAD6" }}>
            <div style={labelStyle}>QA Result</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", color: task.qa_result.passed ? "#386A20" : "#BA1A1A" }}>
              {typeof task.qa_result === "string" ? task.qa_result : JSON.stringify(task.qa_result, null, 2)}
            </div>
          </div>
        )}

        {/* Error */}
        {task.error && (
          <div style={{ ...sectionStyle, borderColor: "#FFDAD6" }}>
            <div style={labelStyle}>Error</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "#BA1A1A" }}>
              {task.error}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Timeline</div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            <span>Created: {formatDate(task.created_at)}</span>
            {task.started_at && <span>Started: {formatDate(task.started_at)}</span>}
            {task.completed_at && <span>Completed: {formatDate(task.completed_at)}</span>}
          </div>
        </div>

        {/* Task ID */}
        <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "monospace" }}>
          ID: {task.id}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          {task.status === "todo" && (
            <button onClick={() => { onStatusChange(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" }); onClose(); }} style={{
              flex: 1, background: "var(--md-primary)", color: "var(--md-on-primary)",
              border: "none", padding: 12, borderRadius: 20, fontWeight: 500, cursor: "pointer",
            }}>Assign</button>
          )}
          {task.status === "failed" && (
            <button onClick={() => { onStatusChange(task.id, { status: "assigned" }); onClose(); }} style={{
              flex: 1, background: "#E8A317", color: "#fff",
              border: "none", padding: 12, borderRadius: 20, fontWeight: 500, cursor: "pointer",
            }}>Retry</button>
          )}
          {(task.status === "done" || task.status === "completed" || task.status === "failed") && (
            <button onClick={() => { onDelete(task.id); onClose(); }} style={{
              background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)",
              border: "none", padding: "12px 24px", borderRadius: 20, fontWeight: 500, cursor: "pointer",
            }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
