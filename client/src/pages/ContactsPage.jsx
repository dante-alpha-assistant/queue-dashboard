import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Upload, Mail, Phone, Building2, Tag, XCircle, User, ChevronLeft, ChevronRight } from "lucide-react";
import ContactFormModal from "../components/ContactFormModal";
import ImportContactsModal from "../components/ImportContactsModal";

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const PAGE_SIZE = 25;

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/contacts?${params}`);
      const json = await res.json();
      setContacts(json.data || []);
      setTotal(json.total || 0);
    } catch (e) {
      console.error("Failed to fetch contacts:", e);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleCreate = () => {
    setEditingContact(null);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingContact(null);
    fetchContacts();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"];
  const getColor = (name) => COLORS[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];

  return (
    <div style={{ padding: "0 24px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 16px", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--md-on-background)" }}>Contacts</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            {total} contact{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowImport(true)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 20px", borderRadius: 20,
            background: "var(--md-surface-container, var(--md-surface-variant))",
            color: "var(--md-on-surface)",
            border: "1px solid var(--md-surface-variant)", cursor: "pointer", fontWeight: 600, fontSize: 13,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <Upload size={16} /> Import
          </button>
          <button onClick={handleCreate} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 20px", borderRadius: 20,
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16, maxWidth: 400 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--md-on-surface-variant)", pointerEvents: "none" }} />
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{
            width: "100%", padding: "10px 12px 10px 36px", borderRadius: 12,
            border: "1px solid var(--md-surface-variant)", background: "var(--md-surface)",
            color: "var(--md-on-background)", fontSize: 13,
            fontFamily: "'Inter', system-ui, sans-serif", outline: "none",
            boxSizing: "border-box",
          }}
        />
        {search && (
          <button onClick={() => { setSearch(""); setPage(0); }} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)",
            padding: 0, display: "flex",
          }}>
            <XCircle size={14} />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--md-on-surface-variant)", fontSize: 14 }}>Loading...</div>
      ) : contacts.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60, color: "var(--md-on-surface-variant)",
          background: "var(--md-surface)", borderRadius: 16, border: "1px solid var(--md-surface-variant)",
        }}>
          <User size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            {search ? "No contacts match your search" : "No contacts yet. Add your first contact!"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 1fr",
            padding: "8px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.5px", color: "var(--md-on-surface-variant)",
            borderBottom: "1px solid var(--md-surface-variant)",
          }}>
            <span>Name</span>
            <span>Email</span>
            <span>Company</span>
            <span>Phone</span>
            <span>Tags</span>
          </div>

          {contacts.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/contacts/${c.id}`)}
              style={{
                display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 1fr",
                alignItems: "center", padding: "12px 16px", borderRadius: 10,
                cursor: "pointer", transition: "background 0.15s",
                background: "var(--md-surface)",
                border: "1px solid transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--md-surface-container)"; e.currentTarget.style.borderColor = "var(--md-surface-variant)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--md-surface)"; e.currentTarget.style.borderColor = "transparent"; }}
            >
              {/* Name + Avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: getColor(c.name),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>
                    {getInitials(c.name)}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>{c.name}</div>
                  {c.role && <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{c.role}</div>}
                </div>
              </div>

              {/* Email */}
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
                {c.email && <><Mail size={12} /> {c.email}</>}
              </div>

              {/* Company */}
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
                {c.company && <><Building2 size={12} /> {c.company}</>}
              </div>

              {/* Phone */}
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
                {c.phone && <><Phone size={12} /> {c.phone}</>}
              </div>

              {/* Tags */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(c.tags || []).slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                    background: "var(--md-primary-container, rgba(99,102,241,0.15))",
                    color: "var(--md-on-primary-container, #6366f1)",
                  }}>
                    {tag}
                  </span>
                ))}
                {(c.tags || []).length > 3 && (
                  <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>+{c.tags.length - 3}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
              background: "var(--md-surface)", color: "var(--md-on-background)",
              cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1,
              display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
              background: "var(--md-surface)", color: "var(--md-on-background)",
              cursor: page >= totalPages - 1 ? "default" : "pointer", opacity: page >= totalPages - 1 ? 0.4 : 1,
              display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => { setShowForm(false); setEditingContact(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportContactsModal
          onClose={() => setShowImport(false)}
          onImported={() => { fetchContacts(); }}
        />
      )}
    </div>
  );
}
