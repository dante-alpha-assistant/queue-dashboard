const ITEMS = [
  { key: "todo", label: "Todo", color: "#71717A" },
  { key: "in_progress", label: "Active", color: "#EAB308" },
  { key: "qa_testing", label: "QA", color: "#A78BFA" },
  { key: "completed", label: "Done", color: "#22C55E" },
  { key: "deploying", label: "Deploying", color: "#F97316" },
  { key: "deployed", label: "Deployed", color: "#14B8A6" },
  { key: "deploy_failed", label: "Dep. Failed", color: "#EF4444" },
  { key: "failed", label: "Failed", color: "#EF4444" },
];

export default function StatsBar({ stats, isTablet }) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, flexWrap: isTablet ? "wrap" : "nowrap",
    }}>
      <span style={{
        fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)",
        marginRight: 6, fontFamily: "'Inter', system-ui, sans-serif",
        letterSpacing: "-0.01em",
      }}>
        {total}
      </span>
      {ITEMS.map(({ key, label, color, merge }) => {
        const count = merge ? (stats[key] || 0) + (stats[merge] || 0) : (stats[key] || 0);
        if (count === 0) return null;
        return (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 6,
            background: `${color}12`, fontSize: 12,
            fontFamily: "'Inter', system-ui, sans-serif",
            border: `1px solid ${color}18`,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%", background: color,
              opacity: 0.9,
            }} />
            <span style={{ fontWeight: 600, color, fontSize: 11, letterSpacing: "-0.01em" }}>{count}</span>
            <span style={{ color: "var(--md-on-surface-variant)", fontSize: 11, fontWeight: 400 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
