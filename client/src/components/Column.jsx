export default function Column({ title, color, count, children }) {
  return (
    <div style={{
      flex: "1 1 0", minWidth: 260, maxWidth: 340, display: "flex", flexDirection: "column",
      background: "var(--md-surface-container)", borderRadius: 16,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>{title}</span>
        </div>
        <span style={{
          background: `${color}20`, color,
          padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
        }}>{count}</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
        {children}
      </div>
    </div>
  );
}
