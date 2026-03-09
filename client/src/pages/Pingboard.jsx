import SpeedLoader from "../components/SpeedLoader";
import { useState, useEffect, useCallback, useRef } from "react";

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

const STATUS_FILTERS = ["all", "online", "busy", "offline", "disabled"];

function formatUptime(seconds) {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function AgentAvatar({ agent, size = 64 }) {
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
        letterSpacing: "0.5px",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {!agent.avatar && initials}
      {agent.emoji && (
        <span
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            fontSize: size * 0.3,
            background: "var(--md-surface-container)",
            borderRadius: "50%",
            padding: 2,
            lineHeight: 1,
          }}
        >
          {agent.emoji}
        </span>
      )}
    </div>
  );
}

function StatusDot({ status, size = 10 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: STATUS_COLORS[status] || "#79747E",
        border: "2px solid var(--md-surface-container)",
        flexShrink: 0,
      }}
    />
  );
}

// CSS keyframes injected once
const ANIMATION_STYLES_ID = "pingboard-animations";
if (typeof document !== "undefined" && !document.getElementById(ANIMATION_STYLES_ID)) {
  const style = document.createElement("style");
  style.id = ANIMATION_STYLES_ID;
  style.textContent = `
    @keyframes pb-slide-in {
      from { opacity: 0; transform: translateY(20px) scale(0.95); max-height: 0; }
      to { opacity: 1; transform: translateY(0) scale(1); max-height: 400px; }
    }
    @keyframes pb-fade-out {
      from { opacity: 1; transform: scale(1); max-height: 400px; }
      to { opacity: 0; transform: scale(0.9); max-height: 0; padding: 0; margin: 0; }
    }
    @keyframes pb-pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
      50% { box-shadow: 0 0 12px 4px rgba(99, 102, 241, 0.25); }
    }
    @keyframes pb-status-flash {
      0% { background-color: rgba(99, 102, 241, 0.2); }
      100% { background-color: transparent; }
    }
  `;
  document.head.appendChild(style);
}

function ReplicaCard({ pod, activeTasks, animState, hasActiveTasks }) {
  const podTasks = activeTasks || [];
  const statusColor = pod.ready ? "#2E7D32" : pod.status === "Running" ? "#E65100" : "#BA1A1A";
  const isWorking = hasActiveTasks || podTasks.length > 0;

  const animStyle = animState === "entering"
    ? { animation: "pb-slide-in 400ms ease-out forwards" }
    : animState === "exiting"
    ? { animation: "pb-fade-out 400ms ease-in forwards", pointerEvents: "none" }
    : animState === "status-changed"
    ? { animation: "pb-status-flash 800ms ease-out" }
    : {};

  return (
    <div
      style={{
        background: "var(--md-surface)",
        borderRadius: 12,
        padding: 14,
        border: "1px solid var(--md-surface-variant)",
        transition: "all 150ms",
        overflow: "hidden",
        ...(isWorking && !animState ? { animation: "pb-pulse-glow 2s ease-in-out infinite" } : {}),
        ...animStyle,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: `${statusColor}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          {pod.ready ? "✅" : "⚠️"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--md-on-background)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={pod.name}
          >
            {pod.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
            {pod.ready ? "Ready" : pod.status || "Unknown"}
            {pod.restarts > 0 && ` · ${pod.restarts} restart${pod.restarts !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 16px",
          fontSize: 12,
          color: "var(--md-on-surface-variant)",
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>
            Uptime
          </div>
          <div style={{ fontWeight: 500, color: "var(--md-on-background)" }}>
            {formatUptime(pod.uptime)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>
            Node
          </div>
          <div style={{ fontWeight: 500, color: "var(--md-on-background)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pod.node}>
            {pod.node || "—"}
          </div>
        </div>
        {(pod.resources?.requests?.cpu || pod.resources?.limits?.cpu) && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>
              CPU
            </div>
            <div style={{ fontWeight: 500, color: "var(--md-on-background)" }}>
              {pod.resources.requests?.cpu || "—"} / {pod.resources.limits?.cpu || "—"}
            </div>
          </div>
        )}
        {(pod.resources?.requests?.memory || pod.resources?.limits?.memory) && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>
              Memory
            </div>
            <div style={{ fontWeight: 500, color: "var(--md-on-background)" }}>
              {pod.resources.requests?.memory || "—"} / {pod.resources.limits?.memory || "—"}
            </div>
          </div>
        )}
      </div>

      {podTasks.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--md-surface-variant)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, opacity: 0.7, color: "var(--md-on-surface-variant)" }}>
            Active Tasks
          </div>
          {podTasks.map((t) => (
            <div
              key={t.id}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 6,
                background: "var(--md-surface-container)",
                marginBottom: 4,
                color: "var(--md-on-background)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={t.title}
            >
              <span style={{ opacity: 0.6 }}>{t.type || "task"}</span> · {t.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentTile({ agent, isSelected, onClick }) {
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const load = agent.current_load || 0;
  const statusColor = STATUS_COLORS[agent.status] || "#79747E";

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--md-surface-container)",
        borderRadius: 16,
        padding: 20,
        cursor: "pointer",
        border: isSelected
          ? `2px solid var(--md-primary)`
          : "1px solid var(--md-surface-variant)",
        transition: "all 200ms ease",
        textAlign: "center",
        position: "relative",
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.border = "1px solid var(--md-primary)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.border = "1px solid var(--md-surface-variant)";
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Status indicator */}
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <StatusDot status={agent.status} />
      </div>

      {/* Load badge */}
      {load > 0 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 12,
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 10,
            background: "var(--md-primary-container)",
            color: "var(--md-on-primary-container)",
          }}
        >
          {load} task{load !== 1 ? "s" : ""}
        </div>
      )}

      <AgentAvatar agent={agent} size={56} />

      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: "var(--md-on-background)",
            marginBottom: 2,
          }}
        >
          {agent.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: statusColor,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {STATUS_LABELS[agent.status] || agent.status}
        </div>
      </div>

      {caps.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          {caps.slice(0, 3).map((c, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 8,
                background: "var(--md-surface-variant)",
                color: "var(--md-on-surface-variant)",
                fontWeight: 500,
              }}
            >
              {c}
            </span>
          ))}
          {caps.length > 3 && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 8,
                background: "var(--md-surface-variant)",
                color: "var(--md-on-surface-variant)",
                fontWeight: 500,
              }}
            >
              +{caps.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Pingboard() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [replicas, setReplicas] = useState(null);
  const [replicasLoading, setReplicasLoading] = useState(false);
  const prevPodsRef = useRef([]);
  const [animatingPods, setAnimatingPods] = useState(new Map()); // podName -> "entering"|"exiting"|"status-changed"
  const exitingPodsRef = useRef([]); // pods that are fading out

  const fetchAgents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/agents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : data.agents || []);
      }
    } catch (e) {
      console.error("Failed to fetch agents:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchReplicas = useCallback(async (agentName) => {
    setReplicasLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentName}/replicas`);
      if (res.ok) {
        const data = await res.json();
        const prevPods = prevPodsRef.current;
        const newPods = data.pods || [];
        const prevNames = new Set(prevPods.map(p => p.name));
        const newNames = new Set(newPods.map(p => p.name));
        const newAnims = new Map();

        // Detect new pods (scale up)
        for (const pod of newPods) {
          if (!prevNames.has(pod.name) && prevPods.length > 0) {
            newAnims.set(pod.name, "entering");
          }
        }

        // Detect status changes
        for (const pod of newPods) {
          if (prevNames.has(pod.name) && !newAnims.has(pod.name)) {
            const prev = prevPods.find(p => p.name === pod.name);
            if (prev && (prev.ready !== pod.ready || prev.status !== pod.status)) {
              newAnims.set(pod.name, "status-changed");
            }
          }
        }

        // Detect removed pods (scale down) — keep them temporarily for fade-out
        const exiting = [];
        for (const pod of prevPods) {
          if (!newNames.has(pod.name)) {
            exiting.push({ ...pod, _exiting: true });
            newAnims.set(pod.name, "exiting");
          }
        }

        exitingPodsRef.current = exiting;
        setAnimatingPods(newAnims);
        setReplicas(data);
        prevPodsRef.current = newPods;

        // Clear animations after they complete
        if (newAnims.size > 0) {
          setTimeout(() => {
            exitingPodsRef.current = [];
            setAnimatingPods(new Map());
          }, 450);
        }
      }
    } catch (e) {
      console.error("Failed to fetch replicas:", e);
      setReplicas({ agent: agentName, pods: [], activeTasks: [] });
    } finally {
      setReplicasLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  useEffect(() => {
    if (selectedAgent) {
      prevPodsRef.current = [];
      exitingPodsRef.current = [];
      setAnimatingPods(new Map());
      fetchReplicas(selectedAgent.name || selectedAgent.id);
      const interval = setInterval(() => fetchReplicas(selectedAgent.name || selectedAgent.id), 12000);
      return () => clearInterval(interval);
    } else {
      setReplicas(null);
      prevPodsRef.current = [];
    }
  }, [selectedAgent, fetchReplicas]);

  const filtered = agents.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      const caps = Array.isArray(a.capabilities) ? a.capabilities.join(" ") : "";
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        caps.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectAgent = (agent) => {
    if (selectedAgent?.name === agent.name) {
      setSelectedAgent(null);
    } else {
      setSelectedAgent(agent);
    }
  };

  if (loading) {
    return <SpeedLoader text="Loading agents..." />;
  }

  const statusCounts = agents.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--md-background)",
        fontFamily: "'Roboto', system-ui, sans-serif",
        color: "var(--md-on-background)",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--md-on-background)",
              }}
            >
              🤖 Agent Pingboard
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--md-on-surface-variant)",
                fontWeight: 400,
                marginTop: 4,
              }}
            >
              {agents.length} agent{agents.length !== 1 ? "s" : ""} registered
              {statusCounts.online ? ` · ${statusCounts.online} online` : ""}
              {statusCounts.busy ? ` · ${statusCounts.busy} busy` : ""}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
            alignItems: "center",
          }}
        >
          {STATUS_FILTERS.map((s) => {
            const isActive = statusFilter === s;
            const count = s === "all" ? agents.length : statusCounts[s] || 0;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                  border: isActive
                    ? "2px solid var(--md-primary)"
                    : "1px solid var(--md-surface-variant)",
                  background: isActive
                    ? "var(--md-primary-container)"
                    : "var(--md-surface)",
                  color: isActive
                    ? "var(--md-on-primary-container)"
                    : "var(--md-on-surface-variant)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  fontFamily: "'Roboto', system-ui, sans-serif",
                  transition: "all 150ms",
                }}
              >
                {s === "all" ? "All" : s}{" "}
                <span style={{ opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <input
            type="text"
            placeholder="🔍 Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              fontSize: 13,
              border: "1px solid var(--md-surface-variant)",
              background: "var(--md-surface)",
              color: "var(--md-on-background)",
              fontFamily: "'Roboto', system-ui, sans-serif",
              outline: "none",
              width: 240,
            }}
          />
        </div>

        {/* Main content: grid + detail panel */}
        <div style={{ display: "flex", gap: 24 }}>
          {/* Agent grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--md-on-surface-variant)",
                  padding: 60,
                  fontSize: 14,
                }}
              >
                No agents found
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: selectedAgent
                    ? "repeat(auto-fill, minmax(180px, 1fr))"
                    : "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16,
                  transition: "all 200ms",
                }}
              >
                {filtered.map((agent) => (
                  <AgentTile
                    key={agent.name}
                    agent={agent}
                    isSelected={selectedAgent?.name === agent.name}
                    onClick={() => handleSelectAgent(agent)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail / Replicas panel */}
          {selectedAgent && (
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
              {/* Agent header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <AgentAvatar agent={selectedAgent} size={48} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--md-on-background)" }}>
                    {selectedAgent.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: STATUS_COLORS[selectedAgent.status],
                      fontWeight: 600,
                    }}
                  >
                    {STATUS_LABELS[selectedAgent.status] || selectedAgent.status}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                    color: "var(--md-on-surface-variant)",
                    padding: 4,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Description */}
              {selectedAgent.description && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--md-on-surface-variant)",
                    marginBottom: 16,
                    lineHeight: 1.5,
                  }}
                >
                  {selectedAgent.description}
                </div>
              )}

              {/* Agent details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px 20px",
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--md-surface-variant)",
                }}
              >
                {selectedAgent.tier && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>
                      Tier
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 8,
                        background:
                          selectedAgent.tier === "core"
                            ? "rgba(46,125,50,0.1)"
                            : selectedAgent.tier === "specialist"
                            ? "rgba(230,81,0,0.1)"
                            : "rgba(121,116,126,0.1)",
                        color:
                          selectedAgent.tier === "core"
                            ? "#2E7D32"
                            : selectedAgent.tier === "specialist"
                            ? "#E65100"
                            : "#79747E",
                        textTransform: "uppercase",
                      }}
                    >
                      {selectedAgent.tier}
                    </span>
                  </div>
                )}
                {selectedAgent.max_capacity != null && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>
                      Capacity
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-background)" }}>
                      {selectedAgent.current_load || 0} / {selectedAgent.max_capacity}
                    </div>
                  </div>
                )}
                {selectedAgent.parent_agent && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>
                      Parent
                    </div>
                    <div style={{ fontSize: 13, color: "var(--md-on-background)" }}>
                      {selectedAgent.parent_agent}
                    </div>
                  </div>
                )}
              </div>

              {/* Capabilities */}
              {Array.isArray(selectedAgent.capabilities) && selectedAgent.capabilities.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>
                    Capabilities
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selectedAgent.capabilities.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          borderRadius: 8,
                          background: "var(--md-surface-variant)",
                          color: "var(--md-on-surface-variant)",
                          fontWeight: 500,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Replicas section */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--md-on-surface-variant)",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Pod Replicas
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#2E7D32",
                      display: "inline-block",
                      animation: "pb-pulse-glow 2s ease-in-out infinite",
                    }} title="Auto-refreshing every 12s" />
                  </span>
                  {replicas && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--md-primary-container)",
                        color: "var(--md-on-primary-container)",
                      }}
                    >
                      {replicas.pods.length}
                    </span>
                  )}
                </div>

                {replicasLoading && !replicas ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 20,
                      color: "var(--md-on-surface-variant)",
                      fontSize: 13,
                    }}
                  >
                    Loading replicas...
                  </div>
                ) : replicas && (replicas.pods.length > 0 || exitingPodsRef.current.length > 0) ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...replicas.pods, ...exitingPodsRef.current].map((pod) => (
                      <ReplicaCard
                        key={pod.name}
                        pod={pod}
                        activeTasks={replicas.activeTasks}
                        animState={animatingPods.get(pod.name) || null}
                        hasActiveTasks={
                          (replicas.activeTasks || []).some(t =>
                            t.assigned_agent === (selectedAgent?.name || selectedAgent?.id)
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 20,
                      color: "var(--md-on-surface-variant)",
                      fontSize: 13,
                      background: "var(--md-surface)",
                      borderRadius: 12,
                      border: "1px dashed var(--md-surface-variant)",
                    }}
                  >
                    No K8s pods found for this agent.
                    <br />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                      Agent may not be K8s-deployed.
                    </span>
                  </div>
                )}
              </div>

              {/* Metrics */}
              {selectedAgent.metrics &&
                (selectedAgent.metrics.success_rate != null ||
                  selectedAgent.metrics.avg_completion_time != null) && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "1px solid var(--md-surface-variant)",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>
                      Performance
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                      {selectedAgent.metrics.success_rate != null && (
                        <span>
                          ✅ {Math.round(selectedAgent.metrics.success_rate * 100)}% success
                        </span>
                      )}
                      {selectedAgent.metrics.avg_completion_time != null && (
                        <span>⏱ {selectedAgent.metrics.avg_completion_time}s avg</span>
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
