import { useState, useEffect, useRef } from "react";

export default function AgentMentionDropdown({ query, onSelect, onClose, inputRef }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (query === null || query === undefined) {
      setAgents([]);
      return;
    }

    setLoading(true);
    setSelectedIndex(0);

    const timer = setTimeout(async () => {
      try {
        const resp = await fetch("/api/agents?status=online");
        if (resp.ok) {
          let data = await resp.json();
          if (query) {
            const q = query.toLowerCase();
            data = data.filter(a => a.id.toLowerCase().includes(q) || (a.name || "").toLowerCase().includes(q));
          }
          setAgents(data.slice(0, 8));
        }
      } catch {
        setAgents([]);
      }
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!inputRef?.current) return;
    const el = inputRef.current;

    const handleKeyDown = (e) => {
      if (agents.length === 0 && !loading) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, agents.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (agents[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(agents[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    el.addEventListener("keydown", handleKeyDown, true);
    return () => el.removeEventListener("keydown", handleKeyDown, true);
  }, [agents, selectedIndex, onSelect, onClose, inputRef, loading]);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef?.current && !inputRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, inputRef]);

  if (query === null || query === undefined) return null;

  const AGENT_ICONS = {
    'neo-worker': '👓', 'beta-worker': '⚡', 'ifra-worker': '🔨',
    'research-worker': '🔬', 'neo-chat-worker': '💬',
    neo: '👓', beta: '⚡', mu: '🔧', alpha: '🧠', flow: '🌊', ifra: '🔨',
  };

  return (
    <div ref={dropdownRef} style={{
      position: "absolute", bottom: "100%", left: 0, right: 50,
      marginBottom: 4, maxHeight: 260, overflow: "auto",
      background: "var(--md-surface, #fff)",
      border: "1px solid var(--md-surface-variant)",
      borderRadius: 12, boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
      zIndex: 200,
    }}>
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid var(--md-surface-variant)",
        fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>🤖</span> Mention agent {query && <span style={{ fontWeight: 400 }}>— "{query}"</span>}
      </div>

      {loading && agents.length === 0 && (
        <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--md-on-surface-variant)", textAlign: "center" }}>
          Loading agents...
        </div>
      )}

      {!loading && agents.length === 0 && (
        <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--md-on-surface-variant)", textAlign: "center" }}>
          No online agents found
        </div>
      )}

      {agents.map((agent, i) => (
        <div
          key={agent.id}
          onClick={() => onSelect(agent)}
          onMouseEnter={() => setSelectedIndex(i)}
          style={{
            padding: "8px 12px", cursor: "pointer",
            background: i === selectedIndex ? "rgba(103, 80, 164, 0.08)" : "transparent",
            borderBottom: i < agents.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
            display: "flex", alignItems: "center", gap: 8,
            transition: "background 80ms",
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{AGENT_ICONS[agent.id] || "🤖"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 500, color: "var(--md-on-surface)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{agent.name || agent.id}</div>
            {agent.capabilities && (
              <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 1 }}>
                {agent.capabilities.slice(0, 4).join(", ")}
              </div>
            )}
          </div>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            background: agent.status === "online" ? "rgba(76,175,80,0.15)" : "rgba(158,158,158,0.15)",
            color: agent.status === "online" ? "#4CAF50" : "#9E9E9E",
            textTransform: "uppercase",
          }}>
            {agent.status}
          </span>
        </div>
      ))}

      <div style={{
        padding: "6px 12px", borderTop: "1px solid var(--md-surface-variant)",
        fontSize: 10, color: "var(--md-on-surface-variant)",
        display: "flex", gap: 12,
      }}>
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span>esc close</span>
      </div>
    </div>
  );
}
