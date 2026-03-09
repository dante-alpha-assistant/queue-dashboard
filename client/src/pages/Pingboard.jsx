import SpeedLoader from "../components/SpeedLoader";
import AgentDetailPanel from "../components/AgentDetailPanel";
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

const STATUS_FILTERS = ["all", "online", "busy", "offline"];

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

/* ─── Org Chart: Dante (Human) Card ─── */
function HumanCard({ agent, replicas }) {
  const load = agent.current_load || 0;
  const maxCap = agent.max_capacity || 0;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        borderRadius: 20,
        padding: 24,
        border: "2px solid #ffd700",
        boxShadow: "0 0 20px rgba(255, 215, 0, 0.15), 0 8px 32px rgba(0,0,0,0.2)",
        textAlign: "center",
        minWidth: 220,
        maxWidth: 280,
        position: "relative",
      }}
    >
      {/* Crown icon */}
      <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 28 }}>
        👑
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
        <div style={{ position: "relative" }}>
          <AgentAvatar agent={agent} size={64} />
          <div style={{
            position: "absolute", bottom: 0, right: -4,
            width: 16, height: 16, borderRadius: "50%",
            background: STATUS_COLORS[agent.status] || "#79747E",
            border: "2px solid #1a1a2e",
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#ffd700", letterSpacing: "0.5px" }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 12, color: "#e0e0e0", fontWeight: 500, marginTop: 2 }}>
            {agent.role || "Human"}
          </div>
          <div style={{
            fontSize: 10, color: "#ffd700", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "1px", marginTop: 4,
            opacity: 0.8,
          }}>
            {STATUS_LABELS[agent.status] || agent.status}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Org Chart: Manager Card ─── */
function ManagerCard({ agent, replicas }) {
  const load = agent.current_load || 0;
  const maxCap = agent.max_capacity || 0;
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--md-surface-container) 0%, var(--md-surface) 100%)",
        borderRadius: 18,
        padding: 20,
        border: "2px solid #7c4dff",
        boxShadow: "0 0 12px rgba(124, 77, 255, 0.1), 0 6px 24px rgba(0,0,0,0.1)",
        textAlign: "center",
        minWidth: 200,
        maxWidth: 260,
        position: "relative",
      }}
    >
      {/* Manager badge */}
      <div style={{
        position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
        fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: 10,
        background: "#7c4dff", color: "#fff",
        textTransform: "uppercase", letterSpacing: "1px",
      }}>
        Manager
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div style={{ position: "relative" }}>
          <AgentAvatar agent={agent} size={56} />
          <div style={{
            position: "absolute", bottom: 0, right: -4,
            width: 14, height: 14, borderRadius: "50%",
            background: STATUS_COLORS[agent.status] || "#79747E",
            border: "2px solid var(--md-surface-container)",
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--md-on-background)" }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 11, color: "#7c4dff", fontWeight: 600, marginTop: 2 }}>
            {agent.role || "Engineering Manager"}
          </div>
        </div>

        {/* Capacity */}
        {maxCap > 0 && (
          <div style={{
            fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 500,
            padding: "3px 10px", borderRadius: 8,
            background: "var(--md-surface-variant)",
          }}>
            {load}/{maxCap} {load >= maxCap ? "busy" : "available"}
          </div>
        )}

        {/* Capabilities */}
        {caps.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", marginTop: 2 }}>
            {caps.slice(0, 4).map((c, i) => (
              <span key={i} style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 6,
                background: "rgba(124, 77, 255, 0.1)", color: "#7c4dff",
                fontWeight: 600,
              }}>
                {c}
              </span>
            ))}
            {caps.length > 4 && (
              <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 6, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
                +{caps.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Org Chart: Worker Card ─── */
function WorkerCard({ agent }) {
  const load = agent.current_load || 0;
  const maxCap = agent.max_capacity || 0;
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const statusColor = STATUS_COLORS[agent.status] || "#79747E";

  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        borderRadius: 14,
        padding: 16,
        border: `1px solid var(--md-surface-variant)`,
        borderLeft: `3px solid ${statusColor}`,
        textAlign: "center",
        width: 180,
        position: "relative",
        transition: "all 200ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ position: "relative" }}>
          <AgentAvatar agent={agent} size={40} />
          <div style={{
            position: "absolute", bottom: -1, right: -3,
            width: 12, height: 12, borderRadius: "50%",
            background: statusColor,
            border: "2px solid var(--md-surface-container)",
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", fontWeight: 500, marginTop: 1 }}>
            {agent.role || "Worker"}
          </div>
        </div>

        {/* Capacity indicator */}
        {maxCap > 0 && (
          <div style={{
            fontSize: 10, fontWeight: 600,
            padding: "2px 8px", borderRadius: 6,
            background: load >= maxCap ? "rgba(230, 81, 0, 0.1)" : "rgba(46, 125, 50, 0.1)",
            color: load >= maxCap ? "#E65100" : "#2E7D32",
          }}>
            {load}/{maxCap} {load >= maxCap ? "busy" : "available"}
          </div>
        )}

        {/* Capabilities as tags */}
        {caps.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", marginTop: 2 }}>
            {caps.slice(0, 3).map((c, i) => (
              <span key={i} style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 5,
                background: "var(--md-surface-variant)",
                color: "var(--md-on-surface-variant)",
                fontWeight: 500,
              }}>
                {c}
              </span>
            ))}
            {caps.length > 3 && (
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 5, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)" }}>
                +{caps.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Styled connector line (vertical) ─── */
function VerticalConnector({ height = 32, color = "var(--md-surface-variant)", dashed = false }) {
  return (
    <div style={{
      width: 0,
      height,
      borderLeft: `2px ${dashed ? "dashed" : "solid"} ${color}`,
      margin: "0 auto",
    }} />
  );
}

/* ─── Org Chart Tree View ─── */
function OrgChartTree({ agents, allReplicas, loading: replicasLoading, onAgentClick }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Build hierarchy: filter out disabled/manually_disabled
  const activeAgents = agents.filter(a =>
    a.status !== "disabled" && !a.manually_disabled
  );

  const agentMap = {};
  activeAgents.forEach(a => { agentMap[a.id || a.name] = a; });

  // Find roots (no parent or parent not in active set)
  const roots = [];
  const childrenMap = {};

  activeAgents.forEach(a => {
    const id = a.id || a.name;
    const parentId = a.parent_agent;
    if (parentId && agentMap[parentId]) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(a);
    } else {
      roots.push(a);
    }
  });

  // Determine card type: "human" for tier=0 or name contains "dante", "manager" for has children, else "worker"
  function getCardType(agent) {
    const id = agent.id || agent.name;
    const hasKids = (childrenMap[id] || []).length > 0;
    const name = (agent.name || "").toLowerCase();
    // Dante = human (top of tree)
    if (agent.tier === "human" || agent.tier === 0 || name === "dante") return "human";
    // Has children = manager
    if (hasKids) return "manager";
    return "worker";
  }

  function renderCard(agent) {
    const type = getCardType(agent);
    const card = (() => {
      switch (type) {
        case "human": return <HumanCard agent={agent} replicas={allReplicas[agent.id || agent.name]} />;
        case "manager": return <ManagerCard agent={agent} replicas={allReplicas[agent.id || agent.name]} />;
        default: return <WorkerCard agent={agent} />;
      }
    })();
    return (
      <div
        onClick={() => onAgentClick && onAgentClick(agent)}
        style={{ cursor: "pointer" }}
      >
        {card}
      </div>
    );
  }

  // Sort roots: human first, then managers, then workers
  const sortedRoots = [...roots].sort((a, b) => {
    const typeOrder = { human: 0, manager: 1, worker: 2 };
    return (typeOrder[getCardType(a)] || 2) - (typeOrder[getCardType(b)] || 2);
  });

  // Recursive tree render (desktop)
  function renderTree(agent, depth = 0) {
    const id = agent.id || agent.name;
    const kids = childrenMap[id] || [];

    return (
      <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {renderCard(agent)}

        {kids.length > 0 && (
          <>
            {/* Connector from parent down */}
            <VerticalConnector height={28} color={getCardType(agent) === "human" ? "#ffd700" : "#7c4dff"} />

            {/* Horizontal bar spanning all children */}
            {kids.length > 1 && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: `calc(50% / ${kids.length})`,
                  right: `calc(50% / ${kids.length})`,
                  height: 0,
                  borderTop: `2px solid ${getCardType(agent) === "human" ? "#ffd70060" : "#7c4dff40"}`,
                }} />
              </div>
            )}

            {/* Children row */}
            <div style={{
              display: "flex",
              gap: 20,
              justifyContent: "center",
              flexWrap: "nowrap",
              position: "relative",
            }}>
              {kids.map((child, i) => {
                const connColor = getCardType(agent) === "human" ? "#ffd70060" : "#7c4dff40";
                return (
                  <div key={child.id || child.name} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <VerticalConnector height={20} color={connColor} />
                    {renderTree(child, depth + 1)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Mobile: vertical list grouped by manager
  function renderMobileList() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {sortedRoots.map(root => {
          const rootId = root.id || root.name;
          const kids = childrenMap[rootId] || [];
          return (
            <div key={rootId}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: kids.length > 0 ? 12 : 0 }}>
                {renderCard(root)}
              </div>
              {kids.length > 0 && (
                <div style={{
                  marginLeft: 20,
                  paddingLeft: 16,
                  borderLeft: `2px solid ${getCardType(root) === "human" ? "#ffd70040" : "#7c4dff30"}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}>
                  {kids.map(child => {
                    const childId = child.id || child.name;
                    const grandKids = childrenMap[childId] || [];
                    return (
                      <div key={childId}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: grandKids.length > 0 ? 12 : 0 }}>
                          {renderCard(child)}
                        </div>
                        {grandKids.length > 0 && (
                          <div style={{
                            marginLeft: 20,
                            paddingLeft: 16,
                            borderLeft: "2px solid var(--md-surface-variant)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            marginTop: 8,
                          }}>
                            {grandKids.map(gk => (
                              <div key={gk.id || gk.name} style={{ display: "flex", justifyContent: "center" }}>
                                {renderCard(gk)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (replicasLoading && Object.keys(allReplicas).length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)" }}>
        Loading org chart...
      </div>
    );
  }

  if (activeAgents.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)" }}>
        No active agents found.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ padding: "16px 0" }}>
        {renderMobileList()}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", padding: "30px 0" }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: "fit-content",
        gap: 0,
      }}>
        {sortedRoots.map(root => renderTree(root))}
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
        {agent.role && (
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 500, marginBottom: 2 }}>
            {agent.role}
          </div>
        )}
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
  const [viewMode, setViewMode] = useState("orgchart"); // default to org chart
  const [allReplicas, setAllReplicas] = useState({});
  const [allReplicasLoading, setAllReplicasLoading] = useState(false);

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

  useEffect(() => {
    if (viewMode === "orgchart") {
      fetchAllReplicas();
      const interval = setInterval(fetchAllReplicas, 15000);
      return () => clearInterval(interval);
    }
  }, [viewMode, fetchAllReplicas]);

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

          {/* View mode toggle */}
          <div style={{ display: "flex", gap: 4, background: "var(--md-surface-container)", borderRadius: 12, padding: 3 }}>
            {[
              { key: "orgchart", label: "🏢 Org Chart" },
              { key: "grid", label: "⊞ Grid" },
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
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {viewMode === "orgchart" ? (
              <OrgChartTree
                agents={filtered}
                allReplicas={allReplicas}
                loading={allReplicasLoading}
                onAgentClick={handleSelectAgent}
              />
            ) : (
              /* Grid view */
              filtered.length === 0 ? (
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
              )
            )}
          </div>

          {/* Agent Detail Panel */}
          {selectedAgent && (
            <AgentDetailPanel
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
