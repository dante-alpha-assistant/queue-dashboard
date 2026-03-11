import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Trash2, UserMinus, UserPlus, Mail, Building2, Phone, Search, XCircle } from "lucide-react";
import GroupFormModal from "../components/GroupFormModal";

export default function GroupDetailPage({ groupId }) {
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [addingIds, setAddingIds] = useState(new Set());

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
    } catch (e) {
      console.error("Failed to fetch group:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  const fetchAllContacts = async () => {
    try {
      const res = await fetch("/api/contacts?limit=200");
      const json = await res.json();
      setAllContacts(json.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAdd = () => {
    fetchAllContacts();
    setAddModal(true);
    setContactSearch("");
  };

  const handleAddMember = async (contactId) => {
    setAddingIds(prev => new Set(prev).add(contactId));
    try {
      await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: [contactId] }),
      });
      fetchGroup();
    } catch (e) {
      console.error(e);
    } finally {
      setAddingIds(prev => { const s = new Set(prev); s.delete(contactId); return s; });
    }
  };

  const handleRemoveMember = async (contactId) => {
    if (!confirm("Remove this contact from the group?")) return;
    try {
      await fetch(`/api/groups/${groupId}/members/${contactId}`, { method: "DELETE" });
      fetchGroup();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`Delete group "${group?.name}"? This won't delete the contacts.`)) return;
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (res.ok) navigate("/contacts");
    } catch (e) {
      console.error(e);
    }
  };

  const getInitials = (name) => name ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"];
  const getColor = (name) => COLORS[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "var(--md-on-surface-variant)" }}>Loading...</div>;
  if (!group) return <div style={{ padding: 60, textAlign: "center", color: "var(--md-on-surface-variant)" }}>Group not found</div>;

  const memberIds = new Set((group.members || []).map(m => m.id));
  const availableContacts = allContacts
    .filter(c => !memberIds.has(c.id))
    .filter(c => !contactSearch.trim() || c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.email?.toLowerCase().includes(contactSearch.toLowerCase()));

  return (
    <div style={{ padding: "0 24px 24px", maxWidth: 900, margin: "0 auto" }}>
      {/* Back nav */}
      <button onClick={() => navigate("/contacts")} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "12px 0",
        background: "none", border: "none", cursor: "pointer",
        color: "var(--md-primary)", fontSize: 13, fontWeight: 600,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <ArrowLeft size={16} /> Back to CRM
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: group.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#fff",
          }}>
            {group.name[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--md-on-background)" }}>{group.name}</h1>
            {group.description && <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--md-on-surface-variant)" }}>{group.description}</p>}
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--md-on-surface-variant)" }}>
              {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleOpenAdd} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20,
            background: group.color, color: "#fff", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <UserPlus size={14} /> Add Members
          </button>
          <button onClick={() => setEditModal(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20,
            border: "1px solid var(--md-surface-variant)", background: "transparent",
            color: "var(--md-on-background)", cursor: "pointer",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <Edit2 size={14} /> Edit
          </button>
          <button onClick={handleDeleteGroup} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20,
            border: "1px solid rgba(220,38,38,0.3)", background: "transparent",
            color: "#ef4444", cursor: "pointer",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Members list */}
      {(!group.members || group.members.length === 0) ? (
        <div style={{
          textAlign: "center", padding: 60, color: "var(--md-on-surface-variant)",
          background: "var(--md-surface)", borderRadius: 16, border: "1px solid var(--md-surface-variant)",
        }}>
          <UserPlus size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 14, margin: 0 }}>No members yet. Add contacts to this group.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr auto",
            padding: "8px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.5px", color: "var(--md-on-surface-variant)",
            borderBottom: "1px solid var(--md-surface-variant)",
          }}>
            <span>Name</span>
            <span>Email</span>
            <span>Company</span>
            <span>Tags</span>
            <span></span>
          </div>
          {group.members.map(c => (
            <div key={c.id} style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr auto",
              alignItems: "center", padding: "12px 16px", borderRadius: 10,
              background: "var(--md-surface)", cursor: "pointer",
              transition: "background 0.15s",
            }}
              onClick={() => navigate(`/contacts/${c.id}`)}
              onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--md-surface)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: getColor(c.name),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>{getInitials(c.name)}</div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>{c.name}</div>
                  {c.role && <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{c.role}</div>}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
                {c.email && <><Mail size={12} /> {c.email}</>}
              </div>
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
                {c.company && <><Building2 size={12} /> {c.company}</>}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(c.tags || []).slice(0, 2).map(tag => (
                  <span key={tag} style={{
                    padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                    background: "var(--md-primary-container, rgba(99,102,241,0.15))",
                    color: "var(--md-on-primary-container, #6366f1)",
                  }}>{tag}</span>
                ))}
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleRemoveMember(c.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                  border: "1px solid rgba(220,38,38,0.2)", background: "transparent",
                  color: "#ef4444", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  fontFamily: "'Inter', system-ui, sans-serif", opacity: 0.7,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}
              >
                <UserMinus size={12} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <GroupFormModal
          group={group}
          onClose={() => setEditModal(false)}
          onSaved={() => { setEditModal(false); fetchGroup(); }}
        />
      )}

      {/* Add members modal */}
      {addModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setAddModal(false)}>
          <div style={{
            background: "var(--md-surface)", borderRadius: 16, padding: 24,
            width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--md-on-background)" }}>Add Members</h3>
              <button onClick={() => setAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", padding: 4 }}>
                <XCircle size={18} />
              </button>
            </div>

            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--md-on-surface-variant)" }} />
              <input
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                style={{
                  width: "100%", padding: "8px 12px 8px 32px", borderRadius: 10,
                  border: "1px solid var(--md-surface-variant)", background: "var(--md-surface-container, var(--md-surface))",
                  color: "var(--md-on-background)", fontSize: 13, outline: "none",
                  fontFamily: "'Inter', system-ui, sans-serif", boxSizing: "border-box",
                }}
                autoFocus
              />
            </div>

            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {availableContacts.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
                  {contactSearch ? "No matching contacts" : "All contacts are already in this group"}
                </div>
              ) : availableContacts.map(c => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  padding: "8px 12px", borderRadius: 10, background: "var(--md-surface-container, var(--md-surface))",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", background: getColor(c.name),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                      }}>{getInitials(c.name)}</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{c.email}</div>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddMember(c.id)}
                    disabled={addingIds.has(c.id)}
                    style={{
                      padding: "5px 12px", borderRadius: 14, border: "none",
                      background: group.color, color: "#fff", cursor: "pointer",
                      fontWeight: 600, fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif",
                      opacity: addingIds.has(c.id) ? 0.5 : 1,
                    }}
                  >
                    {addingIds.has(c.id) ? "Adding..." : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
