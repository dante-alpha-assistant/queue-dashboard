import SpeedLoader from "../components/SpeedLoader";
import { useState, useEffect } from "react";

const STATUS_COLORS = {
  online: "#2E7D32",
  busy: "#E65100",
  offline: "#79747E",
  disabled: "#BA1A1A",
};

const STATUS_BG = {
  online: "rgba(46,125,50,0.08)",
  busy: "rgba(230,81,0,0.08)",
  offline: "rgba(121,116,126,0.08)",
  disabled: "rgba(186,26,26,0.08)",
};

const STATUS_FILTERS = ["all", "online", "busy", "offline", "disabled"];

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
    return <SpeedLoader text="Loading agents..." />;
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--md-background)",
      fontFamily: "'Roboto', system-ui, sans-serif",
      color: "var(--md-on-background)", padding: 24,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--md-on-background)" }}>
            Agent Pingboard
          </div>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", fontWeight: 400, marginTop: 2 }}>
            {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        {STATUS_FILTERS.map((s) => {
          const isActive = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: isActive ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
              background: isActive ? "var(--md-primary-container)" : "var(--md-surface)",
              color: isActive ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
              cursor: "pointer", textTransform: "capitalize",
              fontFamily: "'Roboto', system-ui, sans-serif",
              transition: "all 150ms",
            }}>
              {s === "all" ? "All" : s}
            </button>
          );
        })}
        <input
          type="text"
          placeholder="Search capabilities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 16px", borderRadius: 12, fontSize: 13,
            border: "1px solid var(--md-surface-variant)",
            background: "var(--md-surface)", color: "var(--md-on-background)",
            fontFamily: "'Roboto', system-ui, sans-serif",
            outline: "none", width: 220,
          }}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--md-on-surface-variant)", padding: 60, fontSize: 14 }}>
          No agents found
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16,
        }}>
          {filtered.map((agent) => {
            const isExpanded = expanded === agent.name;
            const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
            const metrics = agent.metrics || {};
            const load = agent.current_load || 0;
            const statusColor = STATUS_COLORS[agent.status] || "#79747E";

            return (
              <div
                key={agent.name}
                onClick={() => setExpanded(isExpanded ? null : agent.name)}
                style={{
                  background: "var(--md-surface-container)", borderRadius: 16,
                  padding: 16, cursor: "pointer",
                  border: isExpanded ? `2px solid var(--md-primary)` : "1px solid var(--md-surface-variant)",
                  transition: "all 150ms",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{agent.emoji || "🤖"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0,
                      }} />
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--md-on-background)" }}>
                        {agent.name}
                      </div>
                    </div>
                  </div>
                  {load > 0 && (
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 12,
                      background: "var(--md-primary-container)",
                      color: "var(--md-on-primary-container)",
                    }}>
                      {load} task{load !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {agent.description && (
                  <div style={{
                    fontSize: 13, color: "var(--md-on-surface-variant)", marginTop: 8, lineHeight: 1.4,
                  }}>
                    {agent.description}
                  </div>
                )}

                {isExpanded && (
                  <div style={{
                    marginTop: 14, paddingTop: 14,
                    borderTop: "1px solid var(--md-surface-variant)",
                    fontSize: 13, color: "var(--md-on-surface-variant)",
                  }}>
                    {agent.tier && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
                          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                        }}>Tier</div>
                        <span style={{
                          display: "inline-block", fontSize: 11, fontWeight: 600,
                          padding: "3px 10px", borderRadius: 8,
                          background: agent.tier === "core" ? "rgba(46,125,50,0.1)"
                            : agent.tier === "specialist" ? "rgba(230,81,0,0.1)" : "rgba(121,116,126,0.1)",
                          color: agent.tier === "core" ? "#2E7D32"
                            : agent.tier === "specialist" ? "#E65100" : "#79747E",
                          textTransform: "uppercase",
                        }}>{agent.tier}</span>
                      </div>
                    )}

                    {caps.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
                          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                        }}>Capabilities</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {caps.map((c, i) => (
                            <span key={i} style={{
                              fontSize: 11, padding: "3px 10px", borderRadius: 8,
                              background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)",
                              fontWeight: 500,
                            }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(metrics.success_rate != null || metrics.avg_completion_time != null) && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
                          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                        }}>Metrics</div>
                        <div style={{ display: "flex", gap: 16 }}>
                          {metrics.success_rate != null && (
                            <span style={{ fontSize: 13 }}>✅ {Math.round(metrics.success_rate * 100)}% success</span>
                          )}
                          {metrics.avg_completion_time != null && (
                            <span style={{ fontSize: 13 }}>⏱ {metrics.avg_completion_time}s avg</span>
                          )}
                        </div>
                      </div>
                    )}

                    {agent.max_capacity != null && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
                          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                        }}>Capacity</div>
                        <span style={{ fontSize: 13 }}>{load} / {agent.max_capacity}</span>
                      </div>
                    )}

                    {agent.parent_agent && (
                      <div>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
                          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                        }}>Parent</div>
                        <span style={{ fontSize: 13 }}>{agent.parent_agent}</span>
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
