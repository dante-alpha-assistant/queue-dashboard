export default function StatsBar({ stats }) {
  const items = [
    { emoji: "📋", label: "Pending", value: stats.pending, color: "#3388ff" },
    { emoji: "⚙️", label: "Processing", value: stats.processing, color: "#ffaa00" },
    { emoji: "✅", label: "Completed", value: stats.completed, color: "#33ff00" },
    { emoji: "❌", label: "Failed", value: (stats.failed || 0) + (stats.dlq || 0), color: "#ff3333" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
      {items.map((it) => (
        <div key={it.label} className="p-4 text-center" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
          <div className="text-3xl font-bold" style={{ color: it.color }}>{it.value}</div>
          <div className="text-xs mt-1 opacity-60">{it.emoji} {it.label}</div>
        </div>
      ))}
    </div>
  );
}
