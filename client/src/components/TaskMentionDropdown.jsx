import { useState, useEffect, useRef, useCallback } from "react";

const STATUS_COLORS = {
  todo: { bg: "rgba(158,158,158,0.15)", color: "#9E9E9E" },
  in_progress: { bg: "rgba(33,150,243,0.15)", color: "#2196F3" },
  blocked: { bg: "rgba(255,152,0,0.15)", color: "#FF9800" },
  qa_testing: { bg: "rgba(156,39,176,0.15)", color: "#9C27B0" },
  completed: { bg: "rgba(76,175,80,0.15)", color: "#4CAF50" },
  deployed: { bg: "rgba(0,150,136,0.15)", color: "#009688" },
  failed: { bg: "rgba(244,67,54,0.15)", color: "#F44336" },
};

const TYPE_ICONS = {
  coding: "💻",
  ops: "⚙️",
  general: "📋",
  review: "👁️",
  research: "🔬",
  qa: "🧪",
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.todo;
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
      background: s.bg, color: s.color, textTransform: "uppercase",
      letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      {(status || "todo").replace(/_/g, " ")}
    </span>
  );
}

export default function TaskMentionDropdown({ query, onSelect, onClose, inputRef, cursorPosition }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const fetchTimer = useRef(null);

  // Debounced search
  useEffect(() => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);

    if (query === null || query === undefined) {
      setResults([]);
      return;
    }

    setLoading(true);
    setSelectedIndex(0);

    fetchTimer.current = setTimeout(async () => {
      try {
        const searchParam = query ? `&search=${encodeURIComponent(query)}` : "";
        const resp = await fetch(`/api/tasks?limit=8${searchParam}`);
        if (resp.ok) {
          const data = await resp.json();
          setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 150);

    return () => { if (fetchTimer.current) clearTimeout(fetchTimer.current); };
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!inputRef?.current) return;
    const el = inputRef.current;

    const handleKeyDown = (e) => {
      if (results.length === 0 && !loading) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (results[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(results[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    el.addEventListener("keydown", handleKeyDown, true);
    return () => el.removeEventListener("keydown", handleKeyDown, true);
  }, [results, selectedIndex, onSelect, onClose, inputRef, loading]);

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

  return (
    <div ref={dropdownRef} style={{
      position: "absolute", bottom: "100%", left: 46, right: 50,
      marginBottom: 4, maxHeight: 300, overflow: "auto",
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
        <span>📌</span> Task mention {query && <span style={{ fontWeight: 400 }}>— "{query}"</span>}
      </div>

      {loading && results.length === 0 && (
        <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--md-on-surface-variant)", textAlign: "center" }}>
          Searching...
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--md-on-surface-variant)", textAlign: "center" }}>
          No tasks found
        </div>
      )}

      {results.map((task, i) => (
        <div
          key={task.id}
          onClick={() => onSelect(task)}
          onMouseEnter={() => setSelectedIndex(i)}
          style={{
            padding: "8px 12px", cursor: "pointer",
            background: i === selectedIndex ? "rgba(103, 80, 164, 0.08)" : "transparent",
            borderBottom: i < results.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
            display: "flex", alignItems: "center", gap: 8,
            transition: "background 80ms",
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{TYPE_ICONS[task.type] || "📋"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 500, color: "var(--md-on-surface)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{task.title}</div>
            <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
              {task.id.slice(0, 8)}…
            </div>
          </div>
          <StatusBadge status={task.status} />
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
