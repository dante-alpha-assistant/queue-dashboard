function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return seconds + "s ago";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

const typeBadgeColors = { code: "#aa55ff", exec: "#33ff00", query: "#3388ff", review: "#ffaa00" };

export default function TaskCard({ task, type, onRetry }) {
  const id = (task.id || task.taskId || "").slice(0, 8);
  const taskType = task.type || "code";
  const prompt = (task.prompt || task.description || "").slice(0, 60);
  const badgeColor = typeBadgeColors[taskType] || "#888";

  return (
    <div style={{ background: "#111", border: "1px solid #1a1a1a", padding: "10px 12px", fontSize: "12px" }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ background: badgeColor, color: "#000", padding: "1px 6px", fontSize: "10px", fontWeight: 700 }}>{taskType}</span>
        {task.priority === "high" && (
          <span style={{ background: "#ff3333", color: "#000", padding: "1px 6px", fontSize: "10px", fontWeight: 700 }}>HIGH</span>
        )}
        <span className="ml-auto opacity-40" style={{ fontSize: "10px" }}>{id}</span>
      </div>
      <div className="opacity-80 mb-1 break-words">{prompt || "\u2014"}</div>
      <div className="flex items-center justify-between opacity-50" style={{ fontSize: "10px" }}>
        <span>{type === "processing" && task.consumer ? "\u2699 " + task.consumer : task.dispatchedBy || ""}</span>
        <span>
          {type === "processing" && task.idle != null
            ? "idle " + task.idle + "ms"
            : type === "completed" && task.duration != null
            ? task.duration + "ms"
            : timeAgo(task.dispatchedAt || task.timestamp)}
        </span>
      </div>
      {type === "failed" && (
        <div className="mt-2">
          <div className="mb-1" style={{ fontSize: "10px", color: "#ff3333" }}>
            {(task.error || "Unknown error").slice(0, 80)}
          </div>
          {onRetry && (
            <button
              onClick={() => onRetry(task.id || task.taskId)}
              className="cursor-pointer"
              style={{ background: "#ff3333", color: "#000", border: "none", fontWeight: 700, fontSize: "10px", padding: "2px 8px" }}
            >RETRY</button>
          )}
        </div>
      )}
    </div>
  );
}
