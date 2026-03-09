import SpeedLoader from "../components/SpeedLoader";
import SkillsModal from "../components/SkillsModal";
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

function ReplicaCard({ pod, activeTasks }) {
  const podTasks = activeTasks || [];
  const statusColor = pod.ready ? "#2E7D32" : pod.status === "Running" ? "#E65100" : "#BA1A1A";

  return (
    <div
      style={{
        background: "var(--md-surface)",
        borderRadius: 12,
        padding: 14,
        border: "1px solid var(--md-surface-variant)",
        transition: "all 150ms",
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

/* ─── Org Chart: mini replica card (employee card) ─── */
function OrgReplicaCard({ pod, activeTasks }) {
  const podTasks = activeTasks || [];
  const statusColor = pod.ready ? "#2E7D32" : pod.status === "Running" ? "#E65100" : "#BA1A1A";
  const shortName = pod.name || "unknown";

  return (
    <div
      style={{
        background: "var(--md-surface)",
        borderRadius: 12,
        padding: 12,
        border: `1px solid ${statusColor}30`,
        borderLeft: `3px solid ${statusColor}`,
        width: 220,
        fontSize: 12,
        transition: "all 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: `${statusColor}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {pod.ready ? "✅" : "⚠️"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--md-on-background)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={shortName}
          >
            {shortName}
          </div>
          <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>
            {pod.ready ? "Ready" : pod.status || "Unknown"}
            {pod.restarts > 0 && ` · ${pod.restarts}↻`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--md-on-surface-variant)", marginBottom: podTasks.length > 0 ? 6 : 0 }}>
        <span>⏱ {formatUptime(pod.uptime)}</span>
        {(pod.resources?.requests?.memory || pod.resources?.limits?.memory) && (
          <span>💾 {pod.resources.requests?.memory || pod.resources.limits?.memory}</span>
        )}
        {(pod.resources?.requests?.cpu || pod.resources?.limits?.cpu) && (
          <span>⚡ {pod.resources.requests?.cpu || pod.resources.limits?.cpu}</span>
        )}
      </div>

      {podTasks.length > 0 && (
        <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--md-surface-variant)" }}>
          {podTasks.slice(0, 2).map((t) => (
            <div
              key={t.id}
              style={{
                fontSize: 10,
                padding: "3px 6px",
                borderRadius: 4,
                background: "var(--md-primary-container)",
                color: "var(--md-on-primary-container)",
                marginBottom: 3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={t.title}
            >
              🔧 {t.title}
            </div>
          ))}
          {podTasks.length > 2 && (
            <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", opacity: 0.7 }}>
              +{podTasks.length - 2} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Org Chart: Agent node with expandable replicas ─── */
function OrgAgentNode({ agent, replicas, children, isRoot }) {
  const [expanded, setExpanded] = useState(false);
  const pods = replicas?.pods || [];
  const activeTasks = replicas?.activeTasks || [];
  const statusColor = STATUS_COLORS[agent.status] || "#79747E";
  const hasChildren = (children && children.length > 0) || pods.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Agent card */}
      <div
        style={{
          background: "var(--md-surface-container)",
          borderRadius: 16,
          padding: isRoot ? 20 : 16,
          border: `2px solid ${statusColor}40`,
          textAlign: "center",
          minWidth: isRoot ? 200 : 170,
          maxWidth: 240,
          position: "relative",
          cursor: hasChildren ? "pointer" : "default",
          transition: "all 200ms",
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <StatusDot status={agent.status} />
        </div>
        {agent.current_load > 0 && (
          <div style={{
            position: "absolute", top: 8, left: 10,
            fontSize: 9, fontWeight: 700, padding: "2px 6px",
            borderRadius: 8, background: "var(--md-primary-container)",
            color: "var(--md-on-primary-container)",
          }}>
            {agent.current_load} task{agent.current_load !== 1 ? "s" : ""}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <AgentAvatar agent={agent} size={isRoot ? 52 : 44} />
          <div>
            <div style={{ fontWeight: 700, fontSize: isRoot ? 15 : 13, color: "var(--md-on-background)" }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 10, color: statusColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {STATUS_LABELS[agent.status] || agent.status}
            </div>
            {agent.description && (
              <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 4, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={agent.description}>
                {agent.description}
              </div>
            )}
          </div>
        </div>

        {/* Replica toggle */}
        {pods.length > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: "4px 10px",
              borderRadius: 10,
              background: expanded ? "var(--md-primary-container)" : "var(--md-surface-variant)",
              color: expanded ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
              fontSize: 11,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            <span>{pods.length} replica{pods.length !== 1 ? "s" : ""}</span>
            <span style={{ fontSize: 9, transition: "transform 200ms", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
          </div>
        )}
      </div>

      {/* Connector line down */}
      {hasChildren && expanded && (
        <div style={{ width: 2, height: 20, background: "var(--md-surface-variant)" }} />
      )}

      {/* Expanded children: replicas + child agents */}
      {expanded && hasChildren && (
        <div style={{ position: "relative" }}>
          {/* Horizontal connector bar */}
          {(pods.length + (children?.length || 0)) > 1 && (
            <div style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: 2,
              background: "var(--md-surface-variant)",
            }} />
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", paddingTop: 0 }}>
            {/* Replica employee cards */}
            {pods.map((pod) => (
              <div key={pod.name} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 2, height: 16, background: "var(--md-surface-variant)" }} />
                <OrgReplicaCard pod={pod} activeTasks={activeTasks} />
              </div>
            ))}

            {/* Child agent nodes (recursive) */}
            {children?.map((child) => (
              <div key={child.agent.id || child.agent.name} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 2, height: 16, background: "var(--md-surface-variant)" }} />
                <OrgAgentNode
                  agent={child.agent}
                  replicas={child.replicas}
                  children={child.children}
                  isRoot={false}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Org Chart View ─── */
function OrgChartView({ agents, allReplicas, loading: replicasLoading }) {
  // Build hierarchy tree from parent_agent relationships
  const agentMap = {};
  agents.forEach(a => { agentMap[a.id || a.name] = a; });

  const roots = [];
  const childrenMap = {};

  agents.forEach(a => {
    const id = a.id || a.name;
    const parentId = a.parent_agent;
    if (parentId && agentMap[parentId]) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(a);
    } else {
      roots.push(a);
    }
  });

  function buildTree(agent) {
    const id = agent.id || agent.name;
    const kids = (childrenMap[id] || []).map(buildTree);
    return {
      agent,
      replicas: allReplicas[id] || { pods: [], activeTasks: [] },
      children: kids,
    };
  }

  const tree = roots.map(buildTree);

  if (replicasLoading && Object.keys(allReplicas).length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)" }}>
        Loading org chart...
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", padding: "20px 0" }}>
      <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap", minWidth: "fit-content" }}>
        {tree.map((node) => (
          <OrgAgentNode
            key={node.agent.id || node.agent.name}
            agent={node.agent}
            replicas={node.replicas}
            children={node.children}
            isRoot={true}
          />
        ))}
      </div>
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
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <StatusDot status={agent.status} />
      </div>

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
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--md-on-background)", marginBottom: 2 }}>
          {agent.name}
        </div>
        <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {STATUS_LABELS[agent.status] || agent.status}
        </div>
      </div>

      {caps.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 4 }}>
          {caps.slice(0, 3).map((c, i) => (
            <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
              {c}
            </span>
          ))}
          {caps.length > 3 && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
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
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "orgchart"
  const [allReplicas, setAllReplicas] = useState({});
  const [allReplicasLoading, setAllReplicasLoading] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);

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
        setReplicas(data);
      }
    } catch (e) {
      console.error("Failed to fetch replicas:", e);
      setReplicas({ agent: agentName, pods: [], activeTasks: [] });
    } finally {
      setReplicasLoading(false);
    }
  }, []);

  const fetchAllReplicas = useCallback(async () => {
    setAllReplicasLoading(true);
    try {
      const res = await fetch("/api/agents/all-replicas");
      if (res.ok) {
        const data = await res.json();
        setAllReplicas(data);
      }
    } catch (e) {
      console.error("Failed to fetch all replicas:", e);
    } finally {
      setAllReplicasLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  // Fetch all replicas when in org chart mode
  useEffect(() => {
    if (viewMode === "orgchart") {
      fetchAllReplicas();
      const interval = setInterval(fetchAllReplicas, 15000);
      return () => clearInterval(interval);
    }
  }, [viewMode, fetchAllReplicas]);

  useEffect(() => {
    if (selectedAgent && viewMode === "grid") {
      fetchReplicas(selectedAgent.name || selectedAgent.id);
      const interval = setInterval(() => fetchReplicas(selectedAgent.name || selectedAgent.id), 15000);
      return () => clearInterval(interval);
    } else {
      setReplicas(null);
    }
  }, [selectedAgent, fetchReplicas, viewMode]);

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
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--md-on-background)" }}>
              🤖 Agent Pingboard
            </div>
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", fontWeight: 400, marginTop: 4 }}>
              {agents.length} agent{agents.length !== 1 ? "s" : ""} registered
              {statusCounts.online ? ` · ${statusCounts.online} online` : ""}
              {statusCounts.busy ? ` · ${statusCounts.busy} busy` : ""}
            </div>
          </div>

          {/* View mode toggle + Skills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setSkillsOpen(true)}
            style={{
              padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
              border: "1px solid var(--md-surface-variant)",
              background: "var(--md-surface)", color: "var(--md-on-surface-variant)",
              cursor: "pointer", fontFamily: "'Roboto', system-ui, sans-serif",
              transition: "all 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--md-primary-container)"; e.currentTarget.style.color = "var(--md-on-primary-container)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--md-surface)"; e.currentTarget.style.color = "var(--md-on-surface-variant)"; }}
          >
            🧩 Skills
          </button>
          <div style={{ display: "flex", gap: 4, background: "var(--md-surface-container)", borderRadius: 12, padding: 3 }}>
            {[
              { key: "grid", label: "⊞ Grid" },
              { key: "orgchart", label: "🏢 Org Chart" },
            ].map((mode) => (
              <button
                key={mode.key}
                onClick={() => { setViewMode(mode.key); setSelectedAgent(null); }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  background: viewMode === mode.key ? "var(--md-primary)" : "transparent",
                  color: viewMode === mode.key ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
                  cursor: "pointer",
                  fontFamily: "'Roboto', system-ui, sans-serif",
                  transition: "all 150ms",
                }}
              >
                {mode.label}
              </button>
            ))}
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
                  border: isActive ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
                  background: isActive ? "var(--md-primary-container)" : "var(--md-surface)",
                  color: isActive ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
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

        {/* View content */}
        {viewMode === "orgchart" ? (
          <OrgChartView agents={filtered} allReplicas={allReplicas} loading={allReplicasLoading} />
        ) : (
          /* Grid view (existing) */
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--md-on-surface-variant)", padding: 60, fontSize: 14 }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <AgentAvatar agent={selectedAgent} size={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--md-on-background)" }}>
                      {selectedAgent.name}
                    </div>
                    <div style={{ fontSize: 12, color: STATUS_COLORS[selectedAgent.status], fontWeight: 600 }}>
                      {STATUS_LABELS[selectedAgent.status] || selectedAgent.status}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAgent(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--md-on-surface-variant)", padding: 4 }}
                  >
                    ✕
                  </button>
                </div>

                {selectedAgent.description && (
                  <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginBottom: 16, lineHeight: 1.5 }}>
                    {selectedAgent.description}
                  </div>
                )}

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
                          fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 8,
                          background: selectedAgent.tier === "core" ? "rgba(46,125,50,0.1)" : selectedAgent.tier === "specialist" ? "rgba(230,81,0,0.1)" : "rgba(121,116,126,0.1)",
                          color: selectedAgent.tier === "core" ? "#2E7D32" : selectedAgent.tier === "specialist" ? "#E65100" : "#79747E",
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

                {Array.isArray(selectedAgent.capabilities) && selectedAgent.capabilities.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>
                      Capabilities
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {selectedAgent.capabilities.map((c, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(selectedAgent.skills) && selectedAgent.skills.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>
                      🧩 Skills
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {selectedAgent.skills.map((s, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: "var(--md-primary-container)", color: "var(--md-on-primary-container)", fontWeight: 500 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Pod Replicas</span>
                    {replicas && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--md-primary-container)", color: "var(--md-on-primary-container)" }}>
                        {replicas.pods.length}
                      </span>
                    )}
                  </div>

                  {replicasLoading && !replicas ? (
                    <div style={{ textAlign: "center", padding: 20, color: "var(--md-on-surface-variant)", fontSize: 13 }}>
                      Loading replicas...
                    </div>
                  ) : replicas && replicas.pods.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {replicas.pods.map((pod) => (
                        <ReplicaCard key={pod.name} pod={pod} activeTasks={replicas.activeTasks} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: 20, color: "var(--md-on-surface-variant)", fontSize: 13, background: "var(--md-surface)", borderRadius: 12, border: "1px dashed var(--md-surface-variant)" }}>
                      No K8s pods found for this agent.
                      <br />
                      <span style={{ fontSize: 11, opacity: 0.7 }}>Agent may not be K8s-deployed.</span>
                    </div>
                  )}
                </div>

                {selectedAgent.metrics &&
                  (selectedAgent.metrics.success_rate != null || selectedAgent.metrics.avg_completion_time != null) && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--md-surface-variant)" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>
                        Performance
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                        {selectedAgent.metrics.success_rate != null && (
                          <span>✅ {Math.round(selectedAgent.metrics.success_rate * 100)}% success</span>
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
        )}
      </div>
      <SkillsModal open={skillsOpen} onClose={() => setSkillsOpen(false)} />
    </div>
  );
}
