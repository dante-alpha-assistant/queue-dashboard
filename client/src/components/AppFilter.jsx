import { useState, useRef, useEffect } from "react";

// Deterministic color palette for app dots
const DOT_COLORS = [
  "#7C3AED", // purple
  "#2563EB", // blue
  "#059669", // green
  "#D97706", // amber
  "#DC2626", // red
  "#0891B2", // cyan
  "#7C3AED", // violet
  "#DB2777", // pink
  "#65A30D", // lime
  "#EA580C", // orange
];

function getAppColor(app) {
  if (app.color) return app.color;
  let hash = 0;
  for (let i = 0; i < app.name.length; i++) {
    hash = (hash * 31 + app.name.charCodeAt(i)) & 0xffff;
  }
  return DOT_COLORS[hash % DOT_COLORS.length];
}

function ColorDot({ color, size = 8 }) {
  return (
    <span style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      flexShrink: 0,
    }} />
  );
}

export default function AppFilter({ apps = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const selectedApp = apps.find(a => a.id === value) || null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const handleToggle = () => {
    setOpen(o => !o);
    if (open) setSearch("");
  };

  const handleSelect = (appId) => {
    onChange(appId);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  const filtered = apps.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const isActive = !!value;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Trigger button */}
      <button
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px 4px 10px",
          borderRadius: 16,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          border: isActive
            ? "2px solid var(--md-primary)"
            : "1px solid var(--md-surface-variant)",
          background: isActive
            ? "var(--md-primary-container)"
            : "var(--md-surface)",
          color: isActive
            ? "var(--md-on-primary-container)"
            : "var(--md-on-surface-variant)",
          cursor: "pointer",
          transition: "all 150ms",
          outline: open ? "2px solid var(--md-primary)" : "none",
          outlineOffset: 2,
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {selectedApp ? (
          <>
            <ColorDot color={getAppColor(selectedApp)} />
            <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedApp.icon ? `${selectedApp.icon} ` : ""}{selectedApp.name}
            </span>
            {/* Clear × */}
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleClear(e); }}
              style={{
                marginLeft: 2,
                lineHeight: 1,
                fontSize: 14,
                color: "var(--md-primary)",
                opacity: 0.8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Clear app filter"
            >×</span>
          </>
        ) : (
          <>
            <span style={{ opacity: 0.7 }}>All Apps</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              style={{
                opacity: 0.6,
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms",
              }}
            >
              <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Filter by app"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            width: 240,
            maxHeight: 320,
            display: "flex",
            flexDirection: "column",
            background: "var(--md-surface, #1e1e2e)",
            border: "1px solid var(--md-surface-variant, #2a2a3a)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
            overflow: "hidden",
            animation: "appfilter-in 120ms ease-out",
          }}
        >
          <style>{`
            @keyframes appfilter-in {
              from { opacity: 0; transform: translateY(-4px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .appfilter-option:hover {
              background: var(--md-surface-variant, #2a2a3a) !important;
            }
          `}</style>

          {/* Search input */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--md-surface-variant, #2a2a3a)" }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search apps…"
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--md-surface-variant, #2a2a3a)",
                background: "rgba(255,255,255,0.05)",
                color: "var(--md-on-background, #e0e0e0)",
                fontSize: 12,
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {/* "All" option */}
            {!search && (
              <div
                role="option"
                aria-selected={!value}
                className="appfilter-option"
                onClick={() => handleSelect("")}
                onKeyDown={e => { if (e.key === "Enter") handleSelect(""); }}
                tabIndex={0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: !value ? 600 : 400,
                  color: !value
                    ? "var(--md-primary, #7C3AED)"
                    : "var(--md-on-surface-variant, #a0a0b0)",
                  background: !value ? "rgba(124,58,237,0.08)" : "transparent",
                  transition: "background 100ms",
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: "1.5px solid var(--md-surface-variant, #2a2a3a)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "var(--md-on-surface-variant, #a0a0b0)",
                  flexShrink: 0,
                }}>∗</span>
                <span>All Apps</span>
                {!value && (
                  <span style={{ marginLeft: "auto", color: "var(--md-primary, #7C3AED)", fontSize: 14, fontWeight: 700 }}>✓</span>
                )}
              </div>
            )}

            {filtered.length === 0 && (
              <div style={{
                padding: "16px 14px",
                fontSize: 12,
                color: "var(--md-on-surface-variant, #a0a0b0)",
                textAlign: "center",
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}>
                No apps found
              </div>
            )}

            {filtered.map(app => {
              const isSelected = value === app.id;
              const dotColor = getAppColor(app);
              return (
                <div
                  key={app.id}
                  role="option"
                  aria-selected={isSelected}
                  className="appfilter-option"
                  onClick={() => handleSelect(app.id)}
                  onKeyDown={e => { if (e.key === "Enter") handleSelect(app.id); }}
                  tabIndex={0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected
                      ? "var(--md-on-background, #e0e0e0)"
                      : "var(--md-on-surface-variant, #a0a0b0)",
                    background: isSelected ? "rgba(124,58,237,0.08)" : "transparent",
                    transition: "background 100ms",
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  }}
                >
                  <ColorDot color={dotColor} size={8} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {app.icon ? `${app.icon} ` : ""}{app.name}
                  </span>
                  {isSelected && (
                    <span style={{ color: "var(--md-primary, #7C3AED)", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
