import { useState, useRef, useEffect } from "react";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

// Map preset keys to server response keys
const KEY_MAP = {
  today: "today",
  "24h": "last_24h",
  "7d": "last_7d",
  "30d": "last_30d",
  all: "all",
};

export function getRange(key, customFrom, customTo) {
  const now = new Date();
  switch (key) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: null };
    }
    case "24h": return { from: new Date(now - 24 * 60 * 60 * 1000), to: null };
    case "7d": return { from: new Date(now - 7 * 24 * 60 * 60 * 1000), to: null };
    case "30d": return { from: new Date(now - 30 * 24 * 60 * 60 * 1000), to: null };
    case "all": return { from: null, to: null };
    case "custom": return {
      from: customFrom ? new Date(customFrom + "T00:00:00") : null,
      to: customTo ? new Date(customTo + "T23:59:59.999") : null,
    };
    default: return { from: null, to: null };
  }
}

const ACTIVE_STATUSES = new Set(["todo", "in_progress", "qa", "qa_testing"]);

export function filterTasksByTime(tasks, timeRange, customFrom, customTo) {
  const { from, to } = getRange(timeRange, customFrom, customTo);
  if (!from && !to) return tasks; // all time
  return tasks.filter(t => {
    if (ACTIVE_STATUSES.has(t.status)) return true;
    const d = new Date(t.updated_at || t.completed_at || t.created_at);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

const LS_KEY = "task-dashboard-time-filter";

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { range: "today", customFrom: "", customTo: "" };
}

function save(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

export default function TimeFilter({ value, onChange, isMobile, projectId, counts: countsProp }) {
  const [saved] = useState(loadSaved);
  const [range, setRange] = useState(value?.range || saved.range || "today");
  const [customFrom, setCustomFrom] = useState(value?.customFrom || saved.customFrom || "");
  const [customTo, setCustomTo] = useState(value?.customTo || saved.customTo || "");
  const [showCustom, setShowCustom] = useState(range === "custom");
  const counts = countsProp || null;
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      onChange({ range, customFrom, customTo });
      return;
    }
  }, []);

  const handleSelect = (key) => {
    setRange(key);
    if (key === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const state = { range: key, customFrom: "", customTo: "" };
    save(state);
    onChange(state);
  };

  const applyCustom = () => {
    const state = { range: "custom", customFrom, customTo };
    save(state);
    onChange(state);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{
        fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)",
        textTransform: "uppercase", letterSpacing: "0.5px",
      }}>Time</span>
      {PRESETS.map(p => {
        const isActive = range === p.key;
        const serverKey = KEY_MAP[p.key];
        const count = p.key === "custom" ? null : (counts ? counts[serverKey] : null);
        return (
          <button key={p.key} onClick={() => handleSelect(p.key)} style={{
            padding: isMobile ? "6px 12px" : "4px 12px",
            borderRadius: 16, fontSize: 12, fontWeight: 500,
            minHeight: isMobile ? 36 : "auto",
            border: isActive ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
            background: isActive ? "var(--md-primary-container)" : "var(--md-surface)",
            color: isActive ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
            cursor: "pointer", fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            transition: "all 150ms", display: "flex", alignItems: "center", gap: 4,
          }}>
            {p.label}
            {count !== null && (
              <span style={{
                fontSize: 10, fontWeight: 700, opacity: 0.7,
                background: isActive ? "var(--md-primary)" : "var(--md-surface-variant)",
                color: isActive ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
                padding: "1px 6px", borderRadius: 8, minWidth: 18, textAlign: "center",
              }}>{count}</span>
            )}
          </button>
        );
      })}
      {showCustom && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{
            padding: "4px 8px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
            background: "var(--md-surface)", color: "var(--md-on-background)", fontSize: 12,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif", outline: "none",
          }} />
          <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{
            padding: "4px 8px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
            background: "var(--md-surface)", color: "var(--md-on-background)", fontSize: 12,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif", outline: "none",
          }} />
          <button onClick={applyCustom} style={{
            padding: "4px 12px", borderRadius: 8, border: "none",
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          }}>Apply</button>
        </div>
      )}
    </div>
  );
}
