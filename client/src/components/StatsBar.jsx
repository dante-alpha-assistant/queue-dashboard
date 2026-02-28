const ITEMS = [
  { key: "todo", label: "Todo", color: "#79747E" },
  { key: "in_progress", label: "Active", color: "#E8A317" },
  { key: "qa", label: "QA", color: "#7B5EA7", merge: "done" },
  { key: "completed", label: "Done", color: "#1B5E20" },
  { key: "failed", label: "Failed", color: "#BA1A1A" },
];

export default function StatsBar({ stats }) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", marginRight: 4 }}>
        {total} tasks
      </span>
      {ITEMS.map(({ key, label, color, merge }) => {
        const count = merge ? (stats[key] || 0) + (stats[merge] || 0) : (stats[key] || 0);
        if (count === 0) return null;
        return (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 10px", borderRadius: 12,
            background: `${color}15`, fontSize: 12,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
            <span style={{ fontWeight: 500, color }}>{count}</span>
            <span style={{ color: "var(--md-on-surface-variant)", fontSize: 11 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
