export default function Column({ title, color, count, children }) {
  return (
    <div className="flex flex-col min-w-0 flex-1" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <div style={{ borderTop: "4px solid " + color, padding: "12px 16px" }}>
        <span className="text-sm font-bold" style={{ color }}>{title}</span>
        <span className="text-xs ml-2 opacity-50">({count})</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {children}
      </div>
    </div>
  );
}
