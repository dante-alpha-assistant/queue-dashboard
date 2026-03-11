import { useState, useEffect } from "react";
import { X, FolderPlus, Check } from "lucide-react";

export default function AddToGroupModal({ contactIds, onClose, onDone }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/groups").then(r => r.json()).then(data => {
      setGroups(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!selectedGroup) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${selectedGroup}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: contactIds }),
      });
      if (res.ok) onDone();
    } catch (e) {
      console.error("Failed to add to group:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1001,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-surface)", borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 380,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--md-on-background)" }}>
            Add {contactIds.length} contact{contactIds.length !== 1 ? "s" : ""} to group
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>Loading groups...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
            No groups yet. Create a group first.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16, maxHeight: 300, overflow: "auto" }}>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 10, border: selectedGroup === g.id ? `2px solid ${g.color}` : "2px solid transparent",
                  background: selectedGroup === g.id ? `${g.color}15` : "var(--md-surface-container, var(--md-surface))",
                  cursor: "pointer", textAlign: "left", fontFamily: "'Inter', system-ui, sans-serif",
                  color: "var(--md-on-background)",
                }}
              >
                <div style={{
                  width: 12, height: 12, borderRadius: "50%", background: g.color, flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{g.member_count} member{g.member_count !== 1 ? "s" : ""}</div>
                </div>
                {selectedGroup === g.id && <Check size={16} style={{ color: g.color }} />}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 20, border: "1px solid var(--md-surface-variant)",
            background: "transparent", color: "var(--md-on-background)", cursor: "pointer",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
          }}>Cancel</button>
          <button onClick={handleAdd} disabled={!selectedGroup || saving} style={{
            padding: "8px 20px", borderRadius: 20, border: "none",
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            cursor: !selectedGroup || saving ? "default" : "pointer",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
            opacity: !selectedGroup || saving ? 0.5 : 1,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <FolderPlus size={14} />
            {saving ? "Adding..." : "Add to Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
