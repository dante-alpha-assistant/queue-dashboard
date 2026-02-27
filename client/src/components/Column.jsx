export default function Column({ title, color, count, children }) {
  return (
    <div style={{
      flex: "1 1 0", minWidth: 240, display: "flex", flexDirection: "column",
      background: "var(--md-surface-container)", borderRadius: 16,
      border: "1px solid var(--md-surface-variant)", overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid var(--md-surface-variant)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
        </div>
        <span style={{
          background: "var(--md-secondary-container)", color: "var(--md-on-secondary-container)",
          padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
        }}>{count}</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {children}
      </div>
    </div>
  );
}
