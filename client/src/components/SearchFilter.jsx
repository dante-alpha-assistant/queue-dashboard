import { useState, useEffect, useRef, useCallback } from "react";

export default function SearchFilter({ value, onChange, isMobile }) {
  const [local, setLocal] = useState(value || "");
  const timerRef = useRef(null);

  // Sync external value changes
  useEffect(() => { setLocal(value || ""); }, [value]);

  const debounced = useCallback((val) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), 300);
  }, [onChange]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    debounced(v);
  };

  const handleClear = () => {
    setLocal("");
    clearTimeout(timerRef.current);
    onChange("");
  };

  return (
    <div style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      minWidth: isMobile ? undefined : 200,
      maxWidth: isMobile ? undefined : 280,
      width: isMobile ? "100%" : undefined,
    }}>
      {/* Magnifying glass icon */}
      <span style={{
        position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
        fontSize: 14, color: "var(--md-on-surface-variant)", pointerEvents: "none",
        lineHeight: 1,
      }}>🔍</span>
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder="Search tasks…"
        style={{
          width: "100%",
          padding: isMobile ? "8px 36px 8px 32px" : "6px 32px 6px 32px",
          borderRadius: 8,
          border: "1px solid var(--md-surface-variant)",
          background: "var(--md-surface)",
          color: "var(--md-on-background)",
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "'Roboto', system-ui, sans-serif",
          outline: "none",
          minHeight: isMobile ? 44 : undefined,
          transition: "border-color 150ms",
        }}
        onFocus={(e) => e.target.style.borderColor = "var(--md-primary)"}
        onBlur={(e) => e.target.style.borderColor = ""}
      />
      {local && (
        <button
          onClick={handleClear}
          style={{
            position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--md-on-surface-variant)", fontSize: 16, padding: 4,
            lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
          }}
          title="Clear search"
        >✕</button>
      )}
    </div>
  );
}
