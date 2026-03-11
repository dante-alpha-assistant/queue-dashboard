import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Building2, Pencil, Trash2, Tag, Globe, Clock, User, AlertTriangle } from "lucide-react";
import ContactFormModal from "../components/ContactFormModal";
import ReactMarkdown from "react-markdown";

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchContact = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      setContact(data);
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchContact(); }, [fetchContact]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (res.ok) navigate("/contacts");
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"];
  const getColor = (name) => COLORS[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--md-on-surface-variant)" }}>
        Loading contact...
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <User size={48} style={{ marginBottom: 16, opacity: 0.3, color: "var(--md-on-surface-variant)" }} />
        <h2 style={{ color: "var(--md-on-surface)", margin: "0 0 8px" }}>Contact Not Found</h2>
        <p style={{ color: "var(--md-on-surface-variant)", fontSize: 14, margin: "0 0 20px" }}>
          No contact with this ID was found.
        </p>
        <button onClick={() => navigate("/contacts")} style={{
          padding: "8px 24px", borderRadius: 20, border: "none",
          background: "var(--md-primary)", color: "var(--md-on-primary)",
          cursor: "pointer", fontWeight: 600, fontSize: 14,
        }}>
          Back to Contacts
        </button>
      </div>
    );
  }

  const c = contact;

  return (
    <div style={{ padding: "0 24px 40px", maxWidth: 900, margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={() => navigate("/contacts")}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 0", background: "none", border: "none",
          cursor: "pointer", color: "var(--md-on-surface-variant)",
          fontSize: 13, fontWeight: 500, marginTop: 16, marginBottom: 8,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <ArrowLeft size={16} /> Back to Contacts
      </button>

      {/* Header Card */}
      <div style={{
        background: "var(--md-surface)", borderRadius: 16,
        border: "1px solid var(--md-surface-variant)", padding: 24,
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          {/* Avatar */}
          {c.avatar_url ? (
            <img src={c.avatar_url} alt={c.name} style={{
              width: 80, height: 80, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: "50%", background: getColor(c.name),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {getInitials(c.name)}
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--md-on-background)" }}>
              {c.name}
            </h1>
            {c.role && (
              <p style={{ margin: "0 0 2px", fontSize: 14, color: "var(--md-on-surface-variant)" }}>
                {c.role}
              </p>
            )}
            {c.company && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 4 }}>
                <Building2 size={14} /> {c.company}
              </p>
            )}

            {/* Contact info row */}
            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              {c.email && (
                <a href={`mailto:${c.email}`} style={{
                  display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                  color: "var(--md-primary)", textDecoration: "none",
                }}>
                  <Mail size={14} /> {c.email}
                </a>
              )}
              {c.phone && (
                <a href={`tel:${c.phone}`} style={{
                  display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                  color: "var(--md-primary)", textDecoration: "none",
                }}>
                  <Phone size={14} /> {c.phone}
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowEdit(true)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderRadius: 20, border: "1px solid var(--md-surface-variant)",
              background: "transparent", color: "var(--md-on-background)",
              cursor: "pointer", fontWeight: 600, fontSize: 12,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              <Pencil size={14} /> Edit
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderRadius: 20, border: "1px solid rgba(239,68,68,0.3)",
              background: "transparent", color: "#ef4444",
              cursor: "pointer", fontWeight: 600, fontSize: 12,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* Tags */}
        {c.tags && c.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
            {c.tags.map(tag => (
              <span key={tag} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 12px", borderRadius: 14, fontSize: 12, fontWeight: 600,
                background: "var(--md-primary-container, rgba(99,102,241,0.15))",
                color: "var(--md-on-primary-container, #6366f1)",
              }}>
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Source & Created */}
        <div style={{
          background: "var(--md-surface)", borderRadius: 16,
          border: "1px solid var(--md-surface-variant)", padding: 20,
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--md-on-background)" }}>
            Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {c.source && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={14} style={{ color: "var(--md-on-surface-variant)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 600 }}>Source</div>
                  <div style={{ fontSize: 13, color: "var(--md-on-background)" }}>{c.source}</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} style={{ color: "var(--md-on-surface-variant)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 600 }}>Created</div>
                <div style={{ fontSize: 13, color: "var(--md-on-background)" }}>
                  {new Date(c.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            </div>
            {c.updated_at && c.updated_at !== c.created_at && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={14} style={{ color: "var(--md-on-surface-variant)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 600 }}>Last Updated</div>
                  <div style={{ fontSize: 13, color: "var(--md-on-background)" }}>
                    {new Date(c.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div style={{
          background: "var(--md-surface)", borderRadius: 16,
          border: "1px solid var(--md-surface-variant)", padding: 20,
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--md-on-background)" }}>
            Notes
          </h3>
          {c.notes ? (
            <div style={{ fontSize: 13, color: "var(--md-on-background)", lineHeight: 1.6 }}>
              <ReactMarkdown>{c.notes}</ReactMarkdown>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--md-on-surface-variant)", fontStyle: "italic", margin: 0 }}>
              No notes yet
            </p>
          )}
        </div>
      </div>

      {/* Interaction Timeline (placeholder) */}
      <div style={{
        background: "var(--md-surface)", borderRadius: 16,
        border: "1px solid var(--md-surface-variant)", padding: 20, marginTop: 16,
      }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--md-on-background)" }}>
          Interaction Timeline
        </h3>
        <p style={{ fontSize: 13, color: "var(--md-on-surface-variant)", fontStyle: "italic", margin: 0 }}>
          No interactions recorded yet. Interactions will appear here as they are logged.
        </p>
      </div>

      {/* Reminders (placeholder) */}
      <div style={{
        background: "var(--md-surface)", borderRadius: 16,
        border: "1px solid var(--md-surface-variant)", padding: 20, marginTop: 16,
      }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--md-on-background)" }}>
          Reminders
        </h3>
        <p style={{ fontSize: 13, color: "var(--md-on-surface-variant)", fontStyle: "italic", margin: 0 }}>
          No reminders set. Reminders for follow-ups will appear here.
        </p>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <ContactFormModal
          contact={c}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); fetchContact(); }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            background: "var(--md-surface)", borderRadius: 16, padding: "24px 32px",
            maxWidth: 400, textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }} onClick={e => e.stopPropagation()}>
            <AlertTriangle size={40} style={{ color: "#ef4444", marginBottom: 12 }} />
            <h3 style={{ margin: "0 0 8px", color: "var(--md-on-surface)" }}>Delete Contact?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--md-on-surface-variant)" }}>
              Are you sure you want to delete <strong>{c.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{
                padding: "8px 20px", borderRadius: 20, border: "1px solid var(--md-surface-variant)",
                background: "transparent", color: "var(--md-on-background)",
                cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{
                padding: "8px 20px", borderRadius: 20, border: "none",
                background: "#ef4444", color: "#fff",
                cursor: deleting ? "default" : "pointer", fontWeight: 600, fontSize: 13,
                opacity: deleting ? 0.7 : 1,
              }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
