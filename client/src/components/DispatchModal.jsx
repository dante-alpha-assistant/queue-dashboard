import { useState } from "react";

const inputStyle = {
  background: "#1a1a1a", border: "1px solid #333", color: "#e0e0e0",
  padding: "8px", width: "100%", fontSize: "13px", fontFamily: "'JetBrains Mono', monospace",
};

export default function DispatchModal({ onClose, dispatch }) {
  const [form, setForm] = useState({
    type: "code", prompt: "", priority: "normal",
    dispatchedBy: "manual", maxRetries: 3, timeoutMs: 300000,
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await dispatch({ ...form, maxRetries: Number(form.maxRetries), timeoutMs: Number(form.timeoutMs) });
      onClose();
    } catch { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-md p-6 space-y-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
        <div className="text-sm font-bold" style={{ color: "#33ff00" }}>DISPATCH TASK</div>
        <label className="block text-xs opacity-60">Type
          <select value={form.type} onChange={set("type")} style={inputStyle}>
            <option value="code">code</option><option value="exec">exec</option>
            <option value="query">query</option><option value="review">review</option>
          </select>
        </label>
        <label className="block text-xs opacity-60">Prompt
          <textarea value={form.prompt} onChange={set("prompt")} rows={3} required style={inputStyle} />
        </label>
        <label className="block text-xs opacity-60">Priority
          <select value={form.priority} onChange={set("priority")} style={inputStyle}>
            <option value="normal">normal</option><option value="high">high</option>
          </select>
        </label>
        <label className="block text-xs opacity-60">Dispatched By
          <input value={form.dispatchedBy} onChange={set("dispatchedBy")} style={inputStyle} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs opacity-60">Max Retries
            <input type="number" value={form.maxRetries} onChange={set("maxRetries")} style={inputStyle} />
          </label>
          <label className="block text-xs opacity-60">Timeout (ms)
            <input type="number" value={form.timeoutMs} onChange={set("timeoutMs")} style={inputStyle} />
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="flex-1 py-2 text-sm font-bold cursor-pointer" style={{ background: "#33ff00", color: "#000", border: "none" }}>
            {submitting ? "..." : "DISPATCH"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 py-2 text-sm cursor-pointer" style={{ background: "#1a1a1a", color: "#888", border: "1px solid #333" }}>CANCEL</button>
        </div>
      </form>
    </div>
  );
}
