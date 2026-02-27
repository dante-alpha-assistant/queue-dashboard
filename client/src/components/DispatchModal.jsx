import { useState } from "react";

const AGENTS = ["neo", "mu", "beta", "flow"];
const TYPES = ["general", "coding", "research", "ops", "test"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function DispatchModal({ onClose, dispatch }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState("todo");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSending(true);
    try {
      await dispatch({
        title: title.trim(),
        description: description.trim() || null,
        type,
        priority,
        assigned_agent: agent || null,
        status: agent ? "assigned" : status,
      });
      onClose();
    } catch {
      setSending(false);
    }
  };

  const inputStyle = {
    background: "#111", border: "1px solid #333", color: "#eee",
    padding: "8px 10px", fontSize: 13, width: "100%", fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: "#0a0a0a", border: "1px solid #333", padding: 20,
        width: 420, maxHeight: "80vh", overflow: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#33ff00" }}>▓ NEW TASK</div>

        <input
          placeholder="Task title *"
          value={title} onChange={e => setTitle(e.target.value)}
          style={{ ...inputStyle, marginBottom: 8 }}
          autoFocus
        />

        <textarea
          placeholder="Description (optional)"
          value={description} onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, marginBottom: 8, resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <select value={agent} onChange={e => setAgent(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
          <option value="">Unassigned (todo)</option>
          {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "#222", color: "#888", border: "none",
            padding: "10px", cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={submit} disabled={!title.trim() || sending} style={{
            flex: 1, background: title.trim() ? "#33ff00" : "#222", color: "#000",
            border: "none", padding: "10px", fontWeight: 700, cursor: title.trim() ? "pointer" : "default",
            fontFamily: "inherit",
          }}>{sending ? "Creating..." : "Create Task"}</button>
        </div>
      </div>
    </div>
  );
}
