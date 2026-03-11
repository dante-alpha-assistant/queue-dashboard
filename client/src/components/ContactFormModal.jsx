import { useState, useEffect, useRef } from "react";
import { X, Upload, Loader2 } from "lucide-react";

export default function ContactFormModal({ contact, onClose, onSaved }) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    name: contact?.name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    company: contact?.company || "",
    role: contact?.role || "",
    tags: (contact?.tags || []).join(", "),
    notes: contact?.notes || "",
    source: contact?.source || "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(contact?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);
  const companyRef = useRef(null);

  useEffect(() => {
    fetch("/api/contacts/meta/companies")
      .then(r => r.json())
      .then(setCompanies)
      .catch(() => {});
  }, []);

  // Close on escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const body = { ...form, tags };

      const url = isEdit ? `/api/contacts/${contact.id}` : "/api/contacts";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json();
        setErrors({ _api: err.error || "Failed to save" });
        return;
      }
      const saved = await res.json();

      // Upload avatar if selected
      if (avatarFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          const b64 = reader.result.split(",")[1];
          await fetch(`/api/contacts/${saved.id}/avatar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: b64, mimeType: avatarFile.type }),
          });
          onSaved();
        };
        reader.readAsDataURL(avatarFile);
      } else {
        onSaved();
      }
    } catch (e) {
      setErrors({ _api: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatar: "Image must be under 5MB" }));
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const companySuggestions = companies.filter(
    c => c.toLowerCase().includes(form.company.toLowerCase()) && c.toLowerCase() !== form.company.toLowerCase()
  ).slice(0, 5);

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid var(--md-surface-variant)", background: "var(--md-surface-container, var(--md-surface))",
    color: "var(--md-on-background)", fontSize: 13,
    fontFamily: "'Inter', system-ui, sans-serif", outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)",
    marginBottom: 4, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-surface)", borderRadius: 16, padding: 0,
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--md-surface-variant)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: "var(--md-surface)", borderRadius: "16px 16px 0 0", zIndex: 1,
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--md-on-background)" }}>
            {isEdit ? "Edit Contact" : "New Contact"}
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--md-on-surface-variant)", padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          {errors._api && (
            <div style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 16,
              background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13,
            }}>
              {errors._api}
            </div>
          )}

          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                background: avatarPreview ? `url(${avatarPreview}) center/cover` : "var(--md-surface-variant)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", border: "2px dashed var(--md-surface-variant)",
                transition: "border-color 0.15s",
              }}
            >
              {!avatarPreview && <Upload size={20} style={{ color: "var(--md-on-surface-variant)", opacity: 0.5 }} />}
            </div>
            <div>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
                background: "transparent", color: "var(--md-on-background)", fontSize: 12,
                cursor: "pointer", fontWeight: 500,
              }}>
                Upload Photo
              </button>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                JPG, PNG, GIF or WebP. Max 5MB.
              </p>
              {errors.avatar && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ef4444" }}>{errors.avatar}</p>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
          </div>

          {/* Name (required) */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Name *</label>
            <input
              type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
              style={{ ...inputStyle, borderColor: errors.name ? "#ef4444" : undefined }}
              autoFocus
            />
            {errors.name && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ef4444" }}>{errors.name}</p>}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              style={{ ...inputStyle, borderColor: errors.email ? "#ef4444" : undefined }}
            />
            {errors.email && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ef4444" }}>{errors.email}</p>}
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Phone</label>
            <input
              type="tel" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
              style={inputStyle}
            />
          </div>

          {/* Company (with autocomplete) */}
          <div style={{ marginBottom: 14, position: "relative" }} ref={companyRef}>
            <label style={labelStyle}>Company</label>
            <input
              type="text" value={form.company}
              onChange={e => { setForm({ ...form, company: e.target.value }); setShowCompanySuggestions(true); }}
              onFocus={() => setShowCompanySuggestions(true)}
              onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 150)}
              placeholder="Company name"
              style={inputStyle}
            />
            {showCompanySuggestions && companySuggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)",
                borderRadius: 8, marginTop: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                maxHeight: 160, overflow: "auto",
              }}>
                {companySuggestions.map(c => (
                  <div
                    key={c}
                    onMouseDown={() => { setForm({ ...form, company: c }); setShowCompanySuggestions(false); }}
                    style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 13,
                      color: "var(--md-on-background)",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container, var(--md-surface-variant))"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Role */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Role / Title</label>
            <input
              type="text" value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              placeholder="e.g. CTO, Designer, Founder"
              style={inputStyle}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Tags</label>
            <input
              type="text" value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              placeholder="Comma-separated: client, vip, partner"
              style={inputStyle}
            />
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--md-on-surface-variant)" }}>
              Separate tags with commas
            </p>
          </div>

          {/* Source */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Source</label>
            <input
              type="text" value={form.source}
              onChange={e => setForm({ ...form, source: e.target.value })}
              placeholder="e.g. Referral, Website, Conference"
              style={inputStyle}
            />
          </div>

          {/* Notes (markdown) */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes (supports markdown)..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{
              padding: "10px 20px", borderRadius: 20, border: "1px solid var(--md-surface-variant)",
              background: "transparent", color: "var(--md-on-background)",
              cursor: "pointer", fontWeight: 600, fontSize: 13,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{
              padding: "10px 24px", borderRadius: 20, border: "none",
              background: "var(--md-primary)", color: "var(--md-on-primary)",
              cursor: saving ? "default" : "pointer", fontWeight: 600, fontSize: 13,
              fontFamily: "'Inter', system-ui, sans-serif", opacity: saving ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {isEdit ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
