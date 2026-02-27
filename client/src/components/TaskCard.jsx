function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return seconds + "s ago";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return "";
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
  return (ms / 60000).toFixed(1) + "m";
}

const typeBadgeColors = { code: "#aa55ff", exec: "#33ff00", query: "#3388ff", review: "#ffaa00" };
const statusBorderColors = { pending: "#3388ff", processing: "#ffaa00", completed: "#33ff00", failed: "#ff3333" };
const agentIcons = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠" };

function getAgentIcon(name) {
  if (!name) return "👤";
  const key = name.toLowerCase().split(/[^a-z]/)[0];
  return agentIcons[key] || "👤";
}

export default function TaskCard({ task, type, onRetry }) {
  const id = (task.id || task.taskId || "").slice(0, 8);
  const taskType = (task.type || "code").toLowerCase();
  const badgeColor = typeBadgeColors[taskType] || "#888";
  const leftBorder = statusBorderColors[type] || "#222";

  const fullPrompt = task.prompt || task.payload?.prompt || task.description || "";
  const taskName = task.name || fullPrompt.slice(0, 60) || "—";
  const promptPreview = fullPrompt.length > 80 ? fullPrompt.slice(0, 80) + "…" : fullPrompt;

  const agent = task.assignedTo || task.worker || task.consumer || task.dispatchedBy || "Unassigned";
  const isUnassigned = agent === "Unassigned";

  const timestamp = task.createdAt || task.dispatchedAt || task.startedAt || task.completedAt;

  return (
    <div style={{
      background: "#111",
      border: "1px solid #222",
      borderLeft: `3px solid ${leftBorder}`,
      padding: "10px 12px",
      fontSize: "12px",
    }}>
      {/* Row 1: Type badge + name + priority */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <span style={{
          background: badgeColor, color: "#000", padding: "1px 6px",
          fontSize: "10px", fontWeight: 700, textTransform: "uppercase", flexShrink: 0,
        }}>{taskType}</span>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {taskName}
        </span>
        {task.priority === "high" && (
          <span style={{
            background: "#ff3333", color: "#000", padding: "1px 6px",
            fontSize: "10px", fontWeight: 700, flexShrink: 0,
          }}>HIGH</span>
        )}
      </div>

      {/* Row 2: Agent · time · ID */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", opacity: 0.7, marginBottom: "4px" }}>
        <span style={{ color: isUnassigned ? "#555" : "inherit" }}>
          {getAgentIcon(isUnassigned ? null : agent)} {isUnassigned ? "Unassigned" : agent}
        </span>
        {timestamp && <span>⏱ {timeAgo(timestamp)}</span>}
        {id && <span style={{ fontSize: "10px", opacity: 0.5 }}>#{id}</span>}
      </div>

      {/* Row 3: Prompt preview */}
      {fullPrompt && (
        <div style={{ opacity: 0.6, fontSize: "11px", marginBottom: "4px" }} title={fullPrompt}>
          📝 {promptPreview || "—"}
        </div>
      )}

      {/* Processing: consumer + idle */}
      {type === "processing" && (
        <div style={{ fontSize: "10px", opacity: 0.6 }}>
          {task.consumer && <span>⚙ {task.consumer}</span>}
          {task.idle != null && <span style={{ marginLeft: "8px" }}>idle {formatDuration(task.idle)}</span>}
        </div>
      )}

      {/* Completed: worker + duration */}
      {type === "completed" && task.duration != null && (
        <div style={{ fontSize: "10px", opacity: 0.6 }}>
          {(task.worker || task.consumer) && <span>{getAgentIcon(task.worker || task.consumer)} {task.worker || task.consumer} · </span>}
          ✅ {formatDuration(task.duration)}
        </div>
      )}

      {/* Failed: error + retry */}
      {type === "failed" && (
        <div style={{ marginTop: "4px" }}>
          <div style={{ fontSize: "10px", color: "#ff3333" }}>
            ❌ {(task.error || "Unknown error").slice(0, 120)}
          </div>
          {task.retryCount != null && (
            <span style={{ fontSize: "10px", opacity: 0.5 }}>Retries: {task.retryCount}</span>
          )}
          {onRetry && (
            <button
              onClick={() => onRetry(task.id || task.taskId)}
              style={{
                background: "#ff3333", color: "#000", border: "none", fontWeight: 700,
                fontSize: "10px", padding: "2px 8px", marginTop: "4px", cursor: "pointer",
              }}
            >RETRY</button>
          )}
        </div>
      )}
    </div>
  );
}
