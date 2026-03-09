import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Bot, Brain, Glasses, Hammer, User, Waves, Wrench, Zap } from 'lucide-react';

const AGENT_ICONS = {
  neo: Glasses, mu: Wrench, beta: Zap, alpha: Brain, flow: Waves, ifra: Hammer,
  "neo-worker": Glasses, "ifra-worker": Hammer, "beta-worker": Zap,
};

const STATUS_DOT = {
  online: '#4CAF50',
  degraded: '#FF9800',
  offline: '#9E9E9E',
  busy: '#D97706',
};

export default function AgentPicker({ onSelect, onCancel, style }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents/discover");
        if (!res.ok) throw new Error("Failed to fetch agents");
        const data = await res.json();
        if (!cancelled) setAgents(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel?.();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div ref={ref} style={{
      background: "var(--md-surface, #FFFBFE)",
      border: "1px solid var(--md-surface-variant, #E7E0EC)",
      borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      minWidth: 280, maxWidth: 340, maxHeight: 360, overflow: "auto",
      fontFamily: "'Roboto', system-ui, sans-serif",
      ...style,
    }} onClick={(e) => e.stopPropagation()}>
      <div style={{
        padding: "12px 16px 8px", fontSize: 13, fontWeight: 600,
        color: "var(--md-on-surface, #1C1B1F)",
        borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
      }}>
        <User size={14} /> Assign to agent
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--md-outline, #79747E)" }}>
          Loading agents…
        </div>
      )}

      {error && (
        <div style={{ padding: 16, fontSize: 12, color: "#BA1A1A" }}><AlertTriangle size={14} /> {error}</div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div style={{ padding: 16, fontSize: 13, color: "var(--md-outline, #79747E)", textAlign: "center" }}>
          No agents available
        </div>
      )}

      {!loading && !error && (
        <div style={{ padding: "4px 0" }}>
          {agents.map((agent) => {
            const icon = agent.avatar || AGENT_ICONS[agent.name] || Bot;
            const statusColor = STATUS_DOT[agent.status] || '#9E9E9E';
            const isAvailable = agent.status === 'online';
            const types = (agent.task_types || agent.capabilities || []).slice(0, 4);

            return (
              <button
                key={agent.id}
                onClick={(e) => { e.stopPropagation(); onSelect(agent.name); }}
                disabled={!isAvailable}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "10px 16px", border: "none", background: "transparent",
                  cursor: isAvailable ? "pointer" : "not-allowed",
                  fontSize: 13, textAlign: "left",
                  color: isAvailable ? "var(--md-on-surface, #1C1B1F)" : "var(--md-outline, #79747E)",
                  opacity: isAvailable ? 1 : 0.5,
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) => { if (isAvailable) e.currentTarget.style.background = "var(--md-surface-container-low, #F7F2FA)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Avatar + status dot */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <span style={{
                    fontSize: 18, width: 36, height: 36, borderRadius: "50%",
                    background: "var(--md-surface-container-low, #F7F2FA)",
                    border: "1px solid var(--md-surface-variant, #E7E0EC)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{icon}</span>
                  <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 10, height: 10, borderRadius: "50%",
                    background: statusColor,
                    border: "2px solid var(--md-surface, #FFFBFE)",
                  }} />
                </div>

                {/* Name + capabilities */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
                    {agent.name}
                  </div>
                  {types.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--md-outline, #79747E)", marginTop: 1 }}>
                      {types.join(" · ")}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                  background: `${statusColor}18`,
                  color: statusColor,
                  textTransform: "uppercase", letterSpacing: "0.03em",
                  flexShrink: 0,
                }}>
                  {agent.status}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
