import { useState, useEffect, useCallback } from "react";
import SpeedLoader from "../components/SpeedLoader";
import { Package, Plus, Pencil, Archive, ExternalLink, GitBranch, Server, Database, X, Check } from "lucide-react";

const DEPLOY_TARGETS = ["kubernetes", "vercel", "none"];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function AppFormModal({ app, onSave, onClose }) {
  const isEdit = !!app;
  const [form, setForm] = useState({
    name: app?.name || "",
    slug: app?.slug || "",
    description: app?.description || "",
    repos: app?.repos?.join(", ") || "",
    deploy_target: app?.deploy_target || "none",
    supabase_project_ref: app?.supabase_project_ref || "",
  });
  const [autoSlug, setAutoSlug] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleNameChange = (name) => {
    setForm(prev => ({
      ...prev,
      name,
      ...(autoSlug ? { slug: slugify(name) } : {}),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError("Name is required");
    if (!form.slug.trim()) return setError("Slug is required");
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        repos: form.repos.split(",").map(r => r.trim()).filter(Boolean),
        deploy_target: form.deploy_target,
        supabase_project_ref: form.supabase_project_ref.trim() || null,
      };
      const url = isEdit ? `/api/apps/${app.id}` : "/api/apps";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      onSave(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid var(--md-surface-variant)",
    background: "var(--md-surface)", color: "var(--md-on-background)",
    fontSize: 13, fontFamily: "'Inter', system-ui, sans-serif",
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)",
    marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.5px",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-surface)", borderRadius: 16, padding: "24px 28px",
        width: 480, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>
            {isEdit ? "Edit App" : "New App"}
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--md-on-surface-variant)", padding: 4,
          }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="My App" />
          </div>
          <div>
            <label style={labelStyle}>Slug *</label>
            <input style={inputStyle} value={form.slug}
              onChange={e => { setAutoSlug(false); setForm(prev => ({ ...prev, slug: e.target.value })); }}
              placeholder="my-app"
            />
            {autoSlug && form.slug && (
              <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 2, display: "block" }}>
                Auto-generated from name
              </span>
            )}
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this app do?"
            />
          </div>
          <div>
            <label style={labelStyle}>Repos (comma-separated)</label>
            <input style={inputStyle} value={form.repos}
              onChange={e => setForm(prev => ({ ...prev, repos: e.target.value }))}
              placeholder="org/repo-1, org/repo-2"
            />
          </div>
          <div>
            <label style={labelStyle}>Deploy Target</label>
            <select style={inputStyle} value={form.deploy_target}
              onChange={e => setForm(prev => ({ ...prev, deploy_target: e.target.value }))}>
              {DEPLOY_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Supabase Project Ref</label>
            <input style={inputStyle} value={form.supabase_project_ref}
              onChange={e => setForm(prev => ({ ...prev, supabase_project_ref: e.target.value }))}
              placeholder="abc123xyz"
            />
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 8,
            background: "#FDECEA", color: "#B71C1C", fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 20, border: "1px solid var(--md-surface-variant)",
            background: "transparent", color: "var(--md-on-surface)", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: "8px 20px", borderRadius: 20, border: "none",
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            cursor: saving ? "wait" : "pointer", fontSize: 13, fontWeight: 600,
            opacity: saving ? 0.7 : 1,
          }}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create App"}</button>
        </div>
      </div>
    </div>
  );
}

function AppCard({ app, taskCount, onEdit, onArchive }) {
  const deployColor = app.deploy_target === "kubernetes" ? "#1565C0" : app.deploy_target === "vercel" ? "#000" : "#79747E";

  return (
    <div style={{
      background: "var(--md-surface)", borderRadius: 12,
      border: "1px solid var(--md-surface-variant)",
      padding: 20, transition: "box-shadow 0.15s",
      display: "flex", flexDirection: "column", gap: 12,
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, var(--md-primary), #7B68EE)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 15,
          }}>{app.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--md-on-surface)" }}>{app.name}</div>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>{app.slug}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => onEdit(app)} title="Edit" style={{
            background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6,
            color: "var(--md-on-surface-variant)",
          }}><Pencil size={14} /></button>
          <button onClick={() => onArchive(app)} title="Archive" style={{
            background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6,
            color: "var(--md-on-surface-variant)",
          }}><Archive size={14} /></button>
        </div>
      </div>

      {app.description && (
        <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.5 }}>{app.description}</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
        {/* Deploy target badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 10px", borderRadius: 12,
          background: `${deployColor}14`, color: deployColor,
          fontWeight: 600,
        }}>
          <Server size={11} />
          {app.deploy_target}
        </span>

        {/* Task count badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 10px", borderRadius: 12,
          background: "var(--md-primary-container, #E8DEF8)", color: "var(--md-on-primary-container, #4F378B)",
          fontWeight: 600,
        }}>
          {taskCount ?? "—"} tasks
        </span>

        {/* Supabase badge */}
        {app.supabase_project_ref && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 10px", borderRadius: 12,
            background: "#3ECF8E14", color: "#3ECF8E",
            fontWeight: 600,
          }}>
            <Database size={11} />
            Supabase
          </span>
        )}
      </div>

      {/* Repos */}
      {app.repos?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {app.repos.map((repo, i) => (
            <a key={i} href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "var(--md-on-surface-variant)", textDecoration: "none",
            }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--md-primary)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--md-on-surface-variant)"}
            >
              <GitBranch size={12} />
              {repo}
              <ExternalLink size={10} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppsPage() {
  const [apps, setApps] = useState([]);
  const [taskCounts, setTaskCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const fetchApps = useCallback(async () => {
    try {
      const status = showArchived ? "all" : "active";
      const res = await fetch(`/api/apps?status=${status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setApps(data);
        // Fetch task counts for each app
        const counts = {};
        await Promise.all(data.map(async (app) => {
          try {
            const tRes = await fetch(`/api/apps/${app.id}/tasks?limit=1000`);
            const tasks = await tRes.json();
            counts[app.id] = Array.isArray(tasks) ? tasks.length : 0;
          } catch { counts[app.id] = 0; }
        }));
        setTaskCounts(counts);
      }
    } catch (e) {
      console.error("Failed to fetch apps:", e);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleSave = (saved) => {
    setShowForm(false);
    setEditingApp(null);
    fetchApps();
  };

  const handleArchive = async (app) => {
    if (!confirm(`Archive "${app.name}"? This will hide it from active apps.`)) return;
    try {
      await fetch(`/api/apps/${app.id}`, { method: "DELETE" });
      fetchApps();
    } catch (e) {
      console.error("Archive failed:", e);
    }
  };

  if (loading) return <SpeedLoader text="Loading apps..." />;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)", display: "flex", alignItems: "center", gap: 10 }}>
            <Package size={22} />
            Apps
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            Manage apps to scope tasks to specific repos and deploy targets
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowArchived(prev => !prev)} className={`filter-chip ${showArchived ? "active" : ""}`}>
            {showArchived ? "Showing All" : "Active Only"}
          </button>
          <button onClick={() => { setEditingApp(null); setShowForm(true); }} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 20, border: "none",
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>
            <Plus size={16} />
            New App
          </button>
        </div>
      </div>

      {apps.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--md-on-surface-variant)" }}>
          <Package size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>No apps yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Create your first app to get started</div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}>
          {apps.map(app => (
            <AppCard
              key={app.id}
              app={app}
              taskCount={taskCounts[app.id]}
              onEdit={(a) => { setEditingApp(a); setShowForm(true); }}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AppFormModal
          app={editingApp}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingApp(null); }}
        />
      )}
    </div>
  );
}
