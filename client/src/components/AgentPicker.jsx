import { useState, useEffect, useRef } from 'react';

const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊", ifra: "🛠️" };

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

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel?.();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  const dropdownStyle = {
    position: "absolute", zIndex: 100, bottom: "100%", right: 0, marginBottom: 4,
    background: "var(--md-surface, #FFFBFE)",
    border: "1px solid var(--md-surface-variant, #E7E0EC)",
    borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    minWidth: 220, maxHeight: 240, overflow: "auto",
    fontFamily: "'Roboto', system-ui, sans-serif",
    ...style,
  };

  return (
    <div ref={ref} style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ padding: "10px 12px 6px", fontSize: 11, fontWeight: 600, color: "var(--md-outline, #79747E)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Assign to agent
      </div>
      {loading && (
        <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "var(--md-outline, #79747E)" }}>
          <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 8 }}>⏳</span>
          Loading agents…
        </div>
      )}
      {error && (
        <div style={{ padding: "12px", fontSize: 12, color: "#BA1A1A" }}>
          {error}
        </div>
      )}
      {!loading && !error && agents.length === 0 && (
        <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--md-outline, #79747E)" }}>
          No agents online
        </div>
      )}
      {!loading && !error && agents.map((agent) => {
        const icon = agent.avatar || AGENT_ICONS[agent.name?.split("-")[0]] || "🤖";
        const load = `${agent.current_load ?? 0}/${agent.max_capacity ?? "?"}`;
        return (
          <button
            key={agent.id}
            onClick={(e) => { e.stopPropagation(); onSelect(agent.id); }}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, textAlign: "left",
              color: "var(--md-on-surface, #1C1B1F)",
              fontFamily: "'Roboto', system-ui, sans-serif",
              borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
              transition: "background 100ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--md-surface-container-low, #F7F2FA)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{
              fontSize: 16, width: 32, height: 32, borderRadius: "50%",
              background: "var(--md-surface-container-low, #F7F2FA)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>{icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, display: "block" }}>{agent.name || agent.id}</span>
              {agent.capabilities && (
                <span style={{ fontSize: 11, color: "var(--md-outline, #79747E)" }}>
                  {agent.capabilities.slice(0, 3).join(", ")}
                </span>
              )}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--md-outline, #79747E)",
              fontFamily: "'Roboto Mono', monospace", whiteSpace: "nowrap",
            }}>({load})</span>
          </button>
        );
      })}
    </div>
  );
}
