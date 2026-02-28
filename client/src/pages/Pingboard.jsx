import { useState, useEffect } from "react";

const STATUS_COLORS = {
  online: "#33ff00",
  busy: "#ffa500",
  offline: "#666",
  disabled: "#ff4444",
};

const STATUS_FILTERS = ["all", "online", "busy", "offline", "disabled"];

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0a0a0a",
    fontFamily: "'JetBrains Mono', monospace",
    color: "#e0e0e0",
    padding: "24px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#33ff00",
    letterSpacing: "-0.02em",
  },
  count: {
    fontSize: 13,
    color: "#888",
    fontWeight: 400,
  },
  filters: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 20,
    alignItems: "center",
  },
  chip: (active) => ({
    padding: "6px 16px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    border: active ? "1px solid #33ff00" : "1px solid #333",
    background: active ? "#33ff0018" : "#1a1a1a",
    color: active ? "#33ff00" : "#888",
    cursor: "pointer",
    textTransform: "capitalize",
    fontFamily: "'JetBrains Mono', monospace",
    transition: "all 150ms",
  }),
  search: {
    padding: "6px 14px",
    borderRadius: 16,
    fontSize: 12,
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "#e0e0e0",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
    width: 200,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  card: (expanded) => ({
    background: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    cursor: "pointer",
    border: expanded ? "1px solid #33ff00" : "1px solid #2a2a2a",
    transition: "all 150ms",
  }),
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  emoji: {
    fontSize: 28,
  },
  name: {
    fontWeight: 700,
    fontSize: 15,
    color: "#fff",
  },
  desc: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
    lineHeight: 1.4,
  },
  statusDot: (status) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: STATUS_COLORS[status] || "#666",
    flexShrink: 0,
  }),
  badge: {
    fontSize: 11,
    background: "#33ff0018",
    color: "#33ff00",
    padding: "2px 8px",
    borderRadius: 8,
    fontWeight: 600,
    marginLeft: "auto",
  },
  detail: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid #2a2a2a",
    fontSize: 12,
    color: "#aaa",
  },
  detailLabel: {
    color: "#33ff00",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 10,
  },
  tierBadge: (tier) => ({
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
    background: tier === "core" ? "#33ff0025" : tier === "specialist" ? "#ffa50025" : "#66666625",
    color: tier === "core" ? "#33ff00" : tier === "specialist" ? "#ffa500" : "#888",
    textTransform: "uppercase",
  }),
  capList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  capChip: {
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 6,
    background: "#2a2a2a",
    color: "#ccc",
  },
};

export default function Pingboard() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const fetchAgents = async () => {
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
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const filtered = agents.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      const caps = Array.isArray(a.capabilities) ? a.capabilities.join(" ") : "";
      const skills = Array.isArray(a.skills) ? a.skills.join(" ") : "";
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        caps.toLowerCase().includes(q) ||
        skills.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
          <div style={{ fontSize: 13, color: "#33ff00" }}>Loading agents...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      <div style={styles.header}>
        <div>
          <div style={styles.title}>Agent Pingboard</div>
          <div style={styles.count}>{filtered.length} agent{filtered.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <div style={styles.filters}>
        {STATUS_FILTERS.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={styles.chip(statusFilter === s)}>
            {s === "all" ? "All" : s}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search capabilities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "#666", padding: 60, fontSize: 13 }}>No agents found</div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((agent) => {
            const isExpanded = expanded === agent.name;
            const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
            const metrics = agent.metrics || {};
            const load = agent.current_load || 0;

            return (
              <div
                key={agent.name}
                style={styles.card(isExpanded)}
                onClick={() => setExpanded(isExpanded ? null : agent.name)}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.emoji}>{agent.emoji || "🤖"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={styles.statusDot(agent.status)} />
                      <div style={styles.name}>{agent.name}</div>
                    </div>
                  </div>
                  {load > 0 && <span style={styles.badge}>{load} task{load !== 1 ? "s" : ""}</span>}
                </div>
                {agent.description && <div style={styles.desc}>{agent.description}</div>}

                {isExpanded && (
                  <div style={styles.detail}>
                    {agent.tier && (
                      <div>
                        <div style={styles.detailLabel}>Tier</div>
                        <span style={styles.tierBadge(agent.tier)}>{agent.tier}</span>
                      </div>
                    )}

                    {caps.length > 0 && (
                      <div>
                        <div style={styles.detailLabel}>Capabilities</div>
                        <div style={styles.capList}>
                          {caps.map((c, i) => (
                            <span key={i} style={styles.capChip}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(metrics.success_rate != null || metrics.avg_completion_time != null) && (
                      <div>
                        <div style={styles.detailLabel}>Metrics</div>
                        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                          {metrics.success_rate != null && (
                            <span>✅ {Math.round(metrics.success_rate * 100)}% success</span>
                          )}
                          {metrics.avg_completion_time != null && (
                            <span>⏱ {metrics.avg_completion_time}s avg</span>
                          )}
                        </div>
                      </div>
                    )}

                    {agent.max_capacity != null && (
                      <div>
                        <div style={styles.detailLabel}>Capacity</div>
                        <span>{load} / {agent.max_capacity}</span>
                      </div>
                    )}

                    {agent.parent_agent && (
                      <div>
                        <div style={styles.detailLabel}>Parent</div>
                        <span>{agent.parent_agent}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
