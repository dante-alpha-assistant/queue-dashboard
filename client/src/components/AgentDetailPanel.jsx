import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS = {
  online: "#2E7D32",
  busy: "#E65100",
  offline: "#79747E",
  disabled: "#BA1A1A",
};

const STATUS_LABELS = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
  disabled: "Disabled",
};

const TASK_STATUS_COLORS = {
  completed: "#2E7D32",
  deployed: "#1565C0",
  failed: "#BA1A1A",
  in_progress: "#E65100",
  qa_testing: "#7B1FA2",
  assigned: "#0277BD",
};

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatUptime(seconds) {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function AgentAvatar({ agent, size = 48 }) {
  const initials = (agent.name || "?")
    .split("-")
    .map((w) => w[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#eab308", "#22c55e", "#14b8a6",
    "#06b6d4", "#3b82f6",
  ];
  const hash = (agent.name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = colors[hash % colors.length];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: agent.avatar ? `url(${agent.avatar}) center/cover` : bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.35,
        flexShrink: 0,
      }}
    >
      {!agent.avatar && initials}
    </div>
  );
}

function SectionHeader({ children, count }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      color: "var(--md-on-surface-variant)",
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}>
      {children}
      {count != null && (
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 7px",
          borderRadius: 8,
          background: "var(--md-primary-container)",
          color: "var(--md-on-primary-container)",
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "var(--md-surface)",
      borderRadius: 10,
      padding: "10px 12px",
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        color: color || "var(--md-on-background)",
        lineHeight: 1.2,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: "var(--md-on-surface-variant)",
        marginTop: 3,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 2, opacity: 0.7 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }) {
  const statusColor = TASK_STATUS_COLORS[task.status] || "#79747E";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 8,
      background: "var(--md-surface)",
      marginBottom: 6,
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: statusColor,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--md-on-background)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }} title={task.title}>
          {task.title}
        </div>
        <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 1 }}>
          {task.type && <span style={{ textTransform: "uppercase", marginRight: 6 }}>{task.type}</span>}
          {task.status === "in_progress" || task.status === "assigned" || task.status === "qa_testing"
            ? task.status.replace("_", " ")
            : timeAgo(task.completed_at)
          }
        </div>
      </div>
      {task.pull_request_url && (
        <a
          href={Array.isArray(task.pull_request_url) ? task.pull_request_url[0] : task.pull_request_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 14, textDecoration: "none", flexShrink: 0 }}
          title="View PR"
        >
          🔗
        </a>
      )}
    </div>
  );
}

function PodCard({ pod }) {
  const statusColor = pod.ready ? "#2E7D32" : pod.status === "Running" ? "#E65100" : "#BA1A1A";
  return (
    <div style={{
      background: "var(--md-surface)",
      borderRadius: 10,
      padding: 12,
      borderLeft: `3px solid ${statusColor}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--md-on-background)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "70%",
        }} title={pod.name}>
          {pod.name}
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 6px",
          borderRadius: 6,
          background: `${statusColor}15`,
          color: statusColor,
        }}>
          {pod.ready ? "Ready" : pod.status || "Unknown"}
        </span>
      </div>
      <div style={{
        display: "flex",
        gap: 12,
        marginTop: 8,
        fontSize: 11,
        color: "var(--md-on-surface-variant)",
      }}>
        <span>⏱ {formatUptime(pod.uptime)}</span>
        {pod.restarts > 0 && <span>🔄 {pod.restarts} restart{pod.restarts !== 1 ? "s" : ""}</span>}
        {pod.node && <span title={pod.node}>📍 {pod.node.length > 12 ? pod.node.slice(0, 12) + "…" : pod.node}</span>}
      </div>
    </div>
  );
}

export default function AgentDetailPanel({ agent, onClose }) {
  const [stats, setStats] = useState(null);
  const [replicas, setReplicas] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const name = agent.name || agent.id;
    try {
      const [statsRes, replicasRes] = await Promise.all([
        fetch(`/api/agents/${name}/stats`),
        fetch(`/api/agents/${name}/replicas`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (replicasRes.ok) setReplicas(await replicasRes.json());
    } catch (e) {
      console.error("Failed to fetch agent detail:", e);
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    setLoading(true);
    setStats(null);
    setReplicas(null);
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const skills = Array.isArray(agent.skills) ? agent.skills : [];
  const statusColor = STATUS_COLORS[agent.status] || "#79747E";

  return (
    <div
      style={{
        width: 420,
        flexShrink: 0,
        background: "var(--md-surface-container)",
        borderRadius: 16,
        border: "1px solid var(--md-surface-variant)",
        padding: 20,
        alignSelf: "flex-start",
        position: "sticky",
        top: 66,
        maxHeight: "calc(100vh - 90px)",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <AgentAvatar agent={agent} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--md-on-background)" }}>
            {agent.name}
          </div>
          {agent.role && (
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 500, marginTop: 1 }}>
              {agent.role}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: statusColor,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: statusColor,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {STATUS_LABELS[agent.status] || agent.status}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "var(--md-surface)",
            border: "1px solid var(--md-surface-variant)",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            color: "var(--md-on-surface-variant)",
            padding: "4px 8px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {agent.description && (
        <div style={{
          fontSize: 13,
          color: "var(--md-on-surface-variant)",
          marginBottom: 16,
          lineHeight: 1.5,
          paddingBottom: 16,
          borderBottom: "1px solid var(--md-surface-variant)",
        }}>
          {agent.description}
        </div>
      )}

      {/* Capabilities */}
      {caps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader>Capabilities</SectionHeader>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {caps.map((c, i) => (
              <span key={i} style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 8,
                background: "rgba(99, 102, 241, 0.1)",
                color: "#6366f1",
                fontWeight: 600,
              }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats?.stats && (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader>Performance</SectionHeader>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            <StatCard
              label="Completed"
              value={stats.stats.completed_all_time}
              sub={`${stats.stats.completed_last_7_days} last 7d`}
              color="#2E7D32"
            />
            <StatCard
              label="Success Rate"
              value={stats.stats.success_rate != null
                ? `${Math.round(stats.stats.success_rate * 100)}%`
                : "—"
              }
              sub={`${stats.stats.failed_all_time} failed`}
              color={stats.stats.success_rate >= 0.8 ? "#2E7D32" : stats.stats.success_rate >= 0.5 ? "#E65100" : "#BA1A1A"}
            />
            <StatCard
              label="Avg Duration"
              value={formatDuration(stats.stats.avg_duration_seconds)}
            />
            <StatCard
              label="Current Load"
              value={`${agent.current_load || 0}/${agent.max_capacity || 0}`}
              color={(agent.current_load || 0) >= (agent.max_capacity || 1) ? "#E65100" : "#2E7D32"}
            />
          </div>
        </div>
      )}

      {/* Current Work */}
      {stats?.current_work && stats.current_work.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader count={stats.current_work.length}>Current Work</SectionHeader>
          {stats.current_work.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}

      {/* Recent History */}
      {stats?.recent_history && stats.recent_history.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader>Recent History</SectionHeader>
          {stats.recent_history.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}

      {/* Pod Replicas */}
      <div style={{ marginBottom: 16 }}>
        <SectionHeader count={replicas?.pods?.length}>Pod Replicas</SectionHeader>
        {loading && !replicas ? (
          <div style={{ textAlign: "center", padding: 16, color: "var(--md-on-surface-variant)", fontSize: 12 }}>
            Loading...
          </div>
        ) : replicas?.pods?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {replicas.pods.map(pod => <PodCard key={pod.name} pod={pod} />)}
          </div>
        ) : (
          <div style={{
            textAlign: "center",
            padding: 16,
            color: "var(--md-on-surface-variant)",
            fontSize: 12,
            background: "var(--md-surface)",
            borderRadius: 10,
            border: "1px dashed var(--md-surface-variant)",
          }}>
            No K8s pods found
          </div>
        )}
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionHeader>Skills</SectionHeader>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {skills.map((s, i) => (
              <span key={i} style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 8,
                background: "rgba(34, 197, 94, 0.1)",
                color: "#22c55e",
                fontWeight: 600,
              }}>
                {typeof s === "string" ? s : s.name || s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
