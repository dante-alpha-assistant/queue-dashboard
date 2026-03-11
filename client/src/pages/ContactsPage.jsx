import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Mail, Phone, Building2, Tag, XCircle, User, ChevronLeft, ChevronRight, FolderPlus, Trash2, Users, CheckSquare, Square } from "lucide-react";
import ContactFormModal from "../components/ContactFormModal";
import GroupFormModal from "../components/GroupFormModal";
import AddToGroupModal from "../components/AddToGroupModal";
import BulkTagModal from "../components/BulkTagModal";

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const PAGE_SIZE = 25;

  // Groups
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null); // null = all contacts
  const [showGroupForm, setShowGroupForm] = useState(false);

  // Multi-select & bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddToGroup, setShowAddToGroup] = useState(false);
  const [showBulkTag, setShowBulkTag] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch groups:", e);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      if (activeGroup) {
        // Fetch group detail with members
        const res = await fetch(`/api/groups/${activeGroup}`);
        const data = await res.json();
        const members = data.members || [];
        // Apply client-side search
        const filtered = search.trim()
          ? members.filter(c =>
              c.name?.toLowerCase().includes(search.toLowerCase()) ||
              c.email?.toLowerCase().includes(search.toLowerCase()) ||
              c.company?.toLowerCase().includes(search.toLowerCase())
            )
          : members;
        setContacts(filtered);
        setTotal(filtered.length);
      } else {
        const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/contacts?${params}`);
        const json = await res.json();
        setContacts(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (e) {
      console.error("Failed to fetch contacts:", e);
    } finally {
      setLoading(false);
    }
  }, [search, page, activeGroup]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleCreate = () => {
    setEditingContact(null);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingContact(null);
    fetchContacts();
    fetchGroups();
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} contact(s)? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: [...selectedIds], action: "delete" }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchContacts();
        fetchGroups();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totalPages = activeGroup ? 1 : Math.ceil(total / PAGE_SIZE);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"];
  const getColor = (name) => COLORS[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];

  const selArray = [...selectedIds];

  return (
    <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto", padding: "0 24px 24px", gap: 20 }}>
      {/* Groups Sidebar */}
      <div style={{
        width: 220, flexShrink: 0, paddingTop: 20,
        borderRight: "1px solid var(--md-surface-variant)", paddingRight: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)" }}>Groups</span>
          <button onClick={() => setShowGroupForm(true)} style={{
            background: "none", border: "none", cursor: "pointer", color: "var(--md-primary)",
            padding: 2, display: "flex",
          }} title="New Group">
            <Plus size={16} />
          </button>
        </div>

        {/* All contacts */}
        <button
          onClick={() => { setActiveGroup(null); setPage(0); setSelectedIds(new Set()); }}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px",
            borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
            background: activeGroup === null ? "var(--md-primary-container, rgba(99,102,241,0.15))" : "transparent",
            color: activeGroup === null ? "var(--md-on-primary-container, var(--md-primary))" : "var(--md-on-surface-variant)",
            fontWeight: activeGroup === null ? 700 : 500, fontSize: 13,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <Users size={14} /> All Contacts
        </button>

        {/* Group list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => { setActiveGroup(g.id); setPage(0); setSelectedIds(new Set()); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px",
                borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                background: activeGroup === g.id ? `${g.color}20` : "transparent",
                color: activeGroup === g.id ? g.color : "var(--md-on-surface-variant)",
                fontWeight: activeGroup === g.id ? 700 : 500, fontSize: 13,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>{g.member_count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 16px", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--md-on-background)" }}>
              {activeGroup ? groups.find(g => g.id === activeGroup)?.name || "Group" : "Contacts"}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--md-on-surface-variant)" }}>
              {total} contact{total !== 1 ? "s" : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {activeGroup && (
              <button onClick={() => navigate(`/groups/${activeGroup}`)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 20,
                border: "1px solid var(--md-surface-variant)", background: "transparent",
                color: "var(--md-on-background)", cursor: "pointer", fontWeight: 600, fontSize: 13,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                Manage Group →
              </button>
            )}
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

        {/* Search + Bulk actions bar */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
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

          {selectedIds.size > 0 && (
            <div style={{
              display: "flex", gap: 6, alignItems: "center", padding: "6px 12px",
              background: "var(--md-surface-container, var(--md-surface))", borderRadius: 12,
              border: "1px solid var(--md-surface-variant)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--md-primary)" }}>
                {selectedIds.size} selected
              </span>
              <button onClick={() => setShowAddToGroup(true)} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 14,
                border: "none", background: "var(--md-primary)", color: "var(--md-on-primary)",
                cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                <FolderPlus size={12} /> Add to Group
              </button>
              <button onClick={() => setShowBulkTag(true)} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 14,
                border: "none", background: "#8b5cf6", color: "#fff",
                cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                <Tag size={12} /> Add Tags
              </button>
              <button onClick={handleBulkDelete} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 14,
                border: "none", background: "#ef4444", color: "#fff",
                cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                <Trash2 size={12} /> Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())} style={{
                background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)",
                padding: 4, display: "flex",
              }}>
                <XCircle size={14} />
              </button>
            </div>
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
              {search ? "No contacts match your search" : activeGroup ? "No contacts in this group" : "No contacts yet. Add your first contact!"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "36px 2fr 2fr 1.5fr 1.5fr 1fr",
              padding: "8px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.5px", color: "var(--md-on-surface-variant)",
              borderBottom: "1px solid var(--md-surface-variant)",
            }}>
              <button onClick={toggleSelectAll} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center",
              }}>
                {selectedIds.size === contacts.length && contacts.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <span>Name</span>
              <span>Email</span>
              <span>Company</span>
              <span>Phone</span>
              <span>Tags</span>
            </div>

            {contacts.map(c => (
              <div
                key={c.id}
                style={{
                  display: "grid", gridTemplateColumns: "36px 2fr 2fr 1.5fr 1.5fr 1fr",
                  alignItems: "center", padding: "12px 16px", borderRadius: 10,
                  cursor: "pointer", transition: "background 0.15s",
                  background: selectedIds.has(c.id) ? "var(--md-primary-container, rgba(99,102,241,0.1))" : "var(--md-surface)",
                  border: selectedIds.has(c.id) ? "1px solid var(--md-primary, #6366f1)" : "1px solid transparent",
                }}
                onMouseEnter={e => { if (!selectedIds.has(c.id)) { e.currentTarget.style.background = "var(--md-surface-container)"; e.currentTarget.style.borderColor = "var(--md-surface-variant)"; } }}
                onMouseLeave={e => { if (!selectedIds.has(c.id)) { e.currentTarget.style.background = "var(--md-surface)"; e.currentTarget.style.borderColor = "transparent"; } }}
              >
                {/* Checkbox */}
                <button
                  onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    color: selectedIds.has(c.id) ? "var(--md-primary)" : "var(--md-on-surface-variant)",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {selectedIds.has(c.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {/* Name + Avatar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={() => navigate(`/contacts/${c.id}`)}>
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
        {!activeGroup && totalPages > 1 && (
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
      </div>

      {/* Modals */}
      {showForm && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => { setShowForm(false); setEditingContact(null); }}
          onSaved={handleSaved}
        />
      )}
      {showGroupForm && (
        <GroupFormModal
          onClose={() => setShowGroupForm(false)}
          onSaved={() => { setShowGroupForm(false); fetchGroups(); }}
        />
      )}
      {showAddToGroup && (
        <AddToGroupModal
          contactIds={selArray}
          onClose={() => setShowAddToGroup(false)}
          onDone={() => { setShowAddToGroup(false); setSelectedIds(new Set()); fetchContacts(); fetchGroups(); }}
        />
      )}
      {showBulkTag && (
        <BulkTagModal
          contactIds={selArray}
          onClose={() => setShowBulkTag(false)}
          onDone={() => { setShowBulkTag(false); setSelectedIds(new Set()); fetchContacts(); }}
        />
      )}
    </div>
  );
}
