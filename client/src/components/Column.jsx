export default function Column({ title, color, count, children, isTablet, collapsible, collapsed, onToggleCollapse }) {
  const isCollapsed = collapsible && collapsed;

  return (
    <div style={{
      flex: isCollapsed ? "0 0 52px" : (isTablet ? "0 0 280px" : "1 1 0"),
      minWidth: isCollapsed ? 52 : (isTablet ? 280 : 260),
      maxWidth: isCollapsed ? 52 : (isTablet ? 320 : 340),
      display: "flex", flexDirection: "column",
      background: "var(--md-surface-container)", borderRadius: 16,
      overflow: "hidden",
      transition: "flex 200ms ease, min-width 200ms ease, max-width 200ms ease",
    }}>
      <div
        onClick={collapsible ? onToggleCollapse : undefined}
        style={{
          padding: isCollapsed ? "14px 0" : "14px 16px",
          display: "flex",
          flexDirection: isCollapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          gap: isCollapsed ? 8 : 0,
          cursor: collapsible ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        {isCollapsed ? (
          <>
            <span style={{
              background: `${color}20`, color,
              padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
            }}>{count}</span>
            <span style={{
              writingMode: "vertical-rl", textOrientation: "mixed",
              fontWeight: 600, fontSize: 13, color: "var(--md-on-background)",
              letterSpacing: "0.02em",
            }}>{title}</span>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>{title}</span>
              {collapsible && (
                <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginLeft: 2 }}>▼</span>
              )}
            </div>
            <span style={{
              background: `${color}20`, color,
              padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
            }}>{count}</span>
          </>
        )}
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
