export default function StatsBar({ stats }) {
  const items = [
    { label: "Todo", value: stats.todo, color: "#666" },
    { label: "Assigned", value: stats.assigned, color: "#3388ff" },
    { label: "In Progress", value: stats.in_progress, color: "#ffaa00" },
    { label: "Done", value: stats.done, color: "#33ff00" },
    { label: "Failed", value: stats.failed, color: "#ff3333" },
  ];

  return (
    <div className="flex gap-2 px-2 pb-2 text-xs">
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-1">
          <span style={{ color: s.color }}>●</span>
          <span style={{ opacity: 0.6 }}>{s.label}:</span>
          <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}
