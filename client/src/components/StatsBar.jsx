const COLORS = {
  todo: "#79747E", assigned: "#6750A4", in_progress: "#E8A317", done: "#386A20",
  qa: "#7B5EA7", completed: "#1B5E20", failed: "#BA1A1A",
};
const LABELS = {
  todo: "Todo", assigned: "Assigned", in_progress: "Active", done: "Done",
  qa: "QA", completed: "Completed", failed: "Failed",
};

export default function StatsBar({ stats }) {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
      {Object.entries(LABELS).map(([key, label]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[key] }} />
          <span style={{ color: "var(--md-on-surface-variant)" }}>{label}</span>
          <span style={{ fontWeight: 600, color: COLORS[key] }}>{stats[key] || 0}</span>
        </div>
      ))}
    </div>
  );
}
