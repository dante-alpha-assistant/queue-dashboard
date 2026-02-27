const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊" };
const STATUS_COLORS = {
  todo: "#666", assigned: "#3388ff", in_progress: "#ffaa00", done: "#33ff00", failed: "#ff3333",
};
const PRIORITY_BADGES = { urgent: "🔴", high: "🟠", normal: "", low: "⚪" };

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

export default function TaskCard({ task, onStatusChange, onDelete }) {
  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";
  const borderColor = STATUS_COLORS[task.status] || "#333";

  return (
    <div
      style={{
        background: "#111", border: `1px solid ${borderColor}`, padding: 10,
        marginBottom: 6, fontSize: 12, borderLeft: `3px solid ${borderColor}`,
      }}
    >
      {/* Header: type badge + priority */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{
            background: borderColor, color: "#000", padding: "1px 6px",
            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          }}>
            {task.type}
          </span>
          {PRIORITY_BADGES[task.priority] && (
            <span title={task.priority}>{PRIORITY_BADGES[task.priority]}</span>
          )}
        </div>
        <span style={{ opacity: 0.4, fontSize: 10 }}>{timeAgo(task.created_at)}</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 600, marginBottom: 4, color: "#eee" }}>
        {task.title}
      </div>

      {/* Description/prompt preview */}
      {(task.description || task.prompt) && (
        <div style={{ opacity: 0.6, fontSize: 11, marginBottom: 4, lineHeight: 1.3 }}>
          {(task.description || task.prompt).slice(0, 120)}
          {(task.description || task.prompt).length > 120 ? "…" : ""}
        </div>
      )}

      {/* Agent + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {agent && (
            <span style={{ fontSize: 11 }}>
              {icon} <span style={{ opacity: 0.6 }}>{agent}</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {task.status === "todo" && (
            <button
              onClick={() => onStatusChange?.(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" })}
              style={{ fontSize: 10, background: "#3388ff", color: "#fff", border: "none", padding: "2px 6px", cursor: "pointer" }}
            >Assign</button>
          )}
          {task.status === "failed" && (
            <button
              onClick={() => onStatusChange?.(task.id, { status: "assigned" })}
              style={{ fontSize: 10, background: "#ffaa00", color: "#000", border: "none", padding: "2px 6px", cursor: "pointer" }}
            >Retry</button>
          )}
          {(task.status === "done" || task.status === "failed") && (
            <button
              onClick={() => onDelete?.(task.id)}
              style={{ fontSize: 10, background: "#333", color: "#888", border: "none", padding: "2px 6px", cursor: "pointer" }}
            >×</button>
          )}
        </div>
      </div>

      {/* Result preview for done tasks */}
      {task.status === "done" && task.result && (
        <div style={{ marginTop: 4, fontSize: 10, opacity: 0.5, borderTop: "1px solid #222", paddingTop: 4 }}>
          ✅ {typeof task.result === "string" ? task.result.slice(0, 80) : JSON.stringify(task.result).slice(0, 80)}
        </div>
      )}

      {/* Error for failed tasks */}
      {task.status === "failed" && task.error && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#ff6666", borderTop: "1px solid #222", paddingTop: 4 }}>
          ❌ {task.error.slice(0, 80)}
        </div>
      )}
    </div>
  );
}
