import { useState, useEffect } from "react";
import { X, Tag, Plus } from "lucide-react";

export default function BulkTagModal({ contactIds, onClose, onDone }) {
  const [existingTags, setExistingTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/contacts/meta/tags").then(r => r.json()).then(data => {
      setExistingTags(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addNewTag = () => {
    const tag = newTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
      if (!existingTags.includes(tag)) setExistingTags(prev => [...prev, tag]);
    }
    setNewTag("");
  };

  const handleSubmit = async () => {
    if (selectedTags.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: contactIds, action: "add_tags", tags: selectedTags }),
      });
      if (res.ok) onDone();
    } catch (e) {
      console.error("Failed to add tags:", e);
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
        width: "100%", maxWidth: 400,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--md-on-background)" }}>
            Add tags to {contactIds.length} contact{contactIds.length !== 1 ? "s" : ""}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* New tag input */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addNewTag())}
            placeholder="Type a new tag..."
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 10,
              border: "1px solid var(--md-surface-variant)", background: "var(--md-surface-container, var(--md-surface))",
              color: "var(--md-on-background)", fontSize: 13, outline: "none",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          />
          <button onClick={addNewTag} disabled={!newTag.trim()} style={{
            padding: "8px 12px", borderRadius: 10, border: "none",
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            cursor: newTag.trim() ? "pointer" : "default", opacity: newTag.trim() ? 1 : 0.5,
            display: "flex", alignItems: "center",
          }}>
            <Plus size={14} />
          </button>
        </div>

        {/* Existing tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, maxHeight: 200, overflow: "auto" }}>
          {existingTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: "5px 12px", borderRadius: 14, fontSize: 12, fontWeight: 600,
                border: selectedTags.includes(tag) ? "2px solid var(--md-primary)" : "2px solid transparent",
                background: selectedTags.includes(tag)
                  ? "var(--md-primary-container, rgba(99,102,241,0.2))"
                  : "var(--md-surface-container, rgba(255,255,255,0.05))",
                color: selectedTags.includes(tag)
                  ? "var(--md-on-primary-container, #6366f1)"
                  : "var(--md-on-surface-variant)",
                cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {selectedTags.length > 0 && (
          <div style={{ marginBottom: 16, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            Selected: {selectedTags.join(", ")}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 20, border: "1px solid var(--md-surface-variant)",
            background: "transparent", color: "var(--md-on-background)", cursor: "pointer",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={selectedTags.length === 0 || saving} style={{
            padding: "8px 20px", borderRadius: 20, border: "none",
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            cursor: selectedTags.length === 0 || saving ? "default" : "pointer",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
            opacity: selectedTags.length === 0 || saving ? 0.5 : 1,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Tag size={14} />
            {saving ? "Adding..." : "Add Tags"}
          </button>
        </div>
      </div>
    </div>
  );
}
