const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊" };
const STATUS_COLORS = {
  todo: "#79747E", assigned: "#6750A4", in_progress: "#E8A317", done: "#386A20", failed: "#BA1A1A",
};
const PRIORITY_BADGES = { urgent: "🔴", high: "🟠", normal: "", low: "⚪" };
const TYPE_COLORS = {
  coding: "#6750A4", research: "#0061A4", ops: "#7D5260", general: "#79747E", test: "#386A20",
};

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

export default function TaskCard({ task, onStatusChange, onDelete, onCardClick }) {
  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";

  return (
    <div onClick={() => onCardClick?.(task)} style={{
      background: "var(--md-background)", borderRadius: 12,
      border: "1px solid var(--md-surface-variant)", padding: 12,
      marginBottom: 8, transition: "all 200ms ease", cursor: "pointer",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            background: TYPE_COLORS[task.type] || "#79747E", color: "#fff",
            padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            {task.type}
          </span>
          {PRIORITY_BADGES[task.priority] && (
            <span title={task.priority} style={{ fontSize: 10 }}>{PRIORITY_BADGES[task.priority]}</span>
          )}
          {task.project && (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 8,
              background: "#E8DEF8", color: "#4F378B", fontWeight: 500,
            }}>
              {task.project.name}
            </span>
          )}
        </div>
        <span style={{ color: "var(--md-border)", fontSize: 11 }}>{timeAgo(task.created_at)}</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--md-on-background)" }}>
        {task.title}
      </div>

      {/* Description */}
      {(task.description || task.prompt) && (
        <div style={{ color: "var(--md-on-surface-variant)", fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>
          {(task.description || task.prompt).slice(0, 120)}
          {(task.description || task.prompt).length > 120 ? "…" : ""}
        </div>
      )}

      {/* Footer: agent + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {agent ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "var(--md-secondary-container)", padding: "2px 8px",
            borderRadius: 12, fontSize: 11, fontWeight: 500,
          }}>
            {icon} {agent}
          </span>
        ) : <span />}
        <div style={{ display: "flex", gap: 4 }}>
          {task.status === "todo" && (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange?.(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" }); }}
              style={{
                fontSize: 11, background: "var(--md-primary)", color: "var(--md-on-primary)",
                border: "none", padding: "4px 10px", borderRadius: 12, cursor: "pointer",
                fontWeight: 500,
              }}
            >Assign</button>
          )}
          {task.status === "failed" && (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange?.(task.id, { status: "assigned" }); }}
              style={{
                fontSize: 11, background: "#E8A317", color: "#fff",
                border: "none", padding: "4px 10px", borderRadius: 12, cursor: "pointer",
                fontWeight: 500,
              }}
            >Retry</button>
          )}
          {(task.status === "done" || task.status === "failed") && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(task.id); }}
              style={{
                fontSize: 11, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)",
                border: "none", padding: "4px 8px", borderRadius: 12, cursor: "pointer",
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* Result */}
      {task.status === "done" && task.result && (
        <div style={{
          marginTop: 8, fontSize: 11, color: "#386A20",
          borderTop: "1px solid var(--md-surface-variant)", paddingTop: 6,
        }}>
          ✅ {typeof task.result === "string" ? task.result.slice(0, 80) : JSON.stringify(task.result).slice(0, 80)}
        </div>
      )}

      {task.status === "failed" && task.error && (
        <div style={{
          marginTop: 8, fontSize: 11, color: "#BA1A1A",
          borderTop: "1px solid var(--md-surface-variant)", paddingTop: 6,
        }}>
          ❌ {task.error.slice(0, 80)}
        </div>
      )}
    </div>
  );
}
