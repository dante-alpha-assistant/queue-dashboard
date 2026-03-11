import { useState } from "react";
import { X } from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#64748b", "#dc2626",
];

export default function GroupFormModal({ group, onClose, onSaved }) {
  const isEdit = !!group;
  const [name, setName] = useState(group?.name || "");
  const [color, setColor] = useState(group?.color || "#6366f1");
  const [description, setDescription] = useState(group?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required");
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/groups/${group.id}` : "/api/groups";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color, description: description.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save group");
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-surface)", borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 420, maxHeight: "90vh", overflow: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-background)" }}>
            {isEdit ? "Edit Group" : "New Group"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 8, marginBottom: 16,
            background: "rgba(220,38,38,0.1)", color: "#ef4444", fontSize: 13,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", marginBottom: 6 }}>Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Investors, Friends, Mentors"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--md-surface-variant)", background: "var(--md-surface-container, var(--md-surface))",
                color: "var(--md-on-background)", fontSize: 13, outline: "none",
                fontFamily: "'Inter', system-ui, sans-serif", boxSizing: "border-box",
              }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", marginBottom: 6 }}>Color</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: c,
                    border: color === c ? "2px solid var(--md-on-background)" : "2px solid transparent",
                    cursor: "pointer", outline: "none", padding: 0,
                    boxShadow: color === c ? `0 0 0 2px ${c}40` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", marginBottom: 6 }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--md-surface-variant)", background: "var(--md-surface-container, var(--md-surface))",
                color: "var(--md-on-background)", fontSize: 13, outline: "none", resize: "vertical",
                fontFamily: "'Inter', system-ui, sans-serif", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{
              padding: "8px 20px", borderRadius: 20, border: "1px solid var(--md-surface-variant)",
              background: "transparent", color: "var(--md-on-background)", cursor: "pointer",
              fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: "8px 20px", borderRadius: 20, border: "none",
              background: color, color: "#fff", cursor: saving ? "default" : "pointer",
              fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
              opacity: saving ? 0.6 : 1,
            }}>{saving ? "Saving..." : isEdit ? "Save" : "Create Group"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
