import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Pencil, Archive, ChevronRight, X, Loader2 } from "lucide-react";

const DEPLOY_TARGETS = ["kubernetes", "vercel", "none"];
const DEPLOY_TARGET_CONFIG = {
  kubernetes: { icon: "☸️", label: "Kubernetes", color: "#326CE5" },
  vercel: { icon: "▲", label: "Vercel", color: "#000" },
  none: { icon: "⏭️", label: "None", color: "#79747E" },
};

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── App Form Modal ──────────────────────────────────────── */
function AppFormModal({ app, onSave, onClose }) {
  const isEdit = !!app?.id;
  const [name, setName] = useState(app?.name || "");
  const [slug, setSlug] = useState(app?.slug || "");
  const [description, setDescription] = useState(app?.description || "");
  const [repos, setRepos] = useState((app?.repos || []).join("\n"));
  const [deployTarget, setDeployTarget] = useState(app?.deploy_target || "none");
  const [supabaseRef, setSupabaseRef] = useState(app?.supabase_project_ref || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [slugManual, setSlugManual] = useState(isEdit);

  const handleNameChange = (val) => {
    setName(val);
    if (!slugManual) setSlug(slugify(val));
  };

  const handleSave = async () => {
    if (!name.trim()) return setError("Name is required");
    if (!slug.trim()) return setError("Slug is required");
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        repos: repos.split("\n").map(r => r.trim()).filter(Boolean),
        deploy_target: deployTarget,
        supabase_project_ref: supabaseRef.trim() || null,
      };

      const url = isEdit ? `/api/apps/${app.id}` : "/api/apps";
      const method = isEdit ? "PATCH" : "POST";
      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${resp.status})`);
      }
      const saved = await resp.json();
      onSave(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid var(--md-surface-variant, #E7E0EC)",
    background: "var(--md-surface, #FFFBFE)",
    color: "var(--md-on-surface, #1C1B1F)", fontSize: 13,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant, #49454F)",
    marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-surface, #FFFBFE)", borderRadius: 20,
        width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto",
        padding: 0, boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>
            {isEdit ? "Edit App" : "Create App"}
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)",
            padding: 4, borderRadius: 8, display: "flex",
          }}><X size={20} /></button>
        </div>

        {/* Form */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input value={name} onChange={e => handleNameChange(e.target.value)}
              placeholder="My App" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Slug</label>
            <input value={slug} onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
              placeholder="my-app" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What does this app do?" rows={2}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} />
          </div>
          <div>
            <label style={labelStyle}>Repos (one per line)</label>
            <textarea value={repos} onChange={e => setRepos(e.target.value)}
              placeholder="owner/repo-name" rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </div>
          <div>
            <label style={labelStyle}>Deploy Target</label>
            <div style={{ display: "flex", gap: 8 }}>
              {DEPLOY_TARGETS.map(t => {
                const cfg = DEPLOY_TARGET_CONFIG[t];
                const active = deployTarget === t;
                return (
                  <button key={t} onClick={() => setDeployTarget(t)} style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10,
                    border: `2px solid ${active ? cfg.color : "var(--md-surface-variant, #E7E0EC)"}`,
                    background: active ? `${cfg.color}12` : "transparent",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    color: active ? cfg.color : "var(--md-on-surface-variant)",
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    transition: "all 150ms",
                  }}>
                    <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Supabase Project Ref (optional)</label>
            <input value={supabaseRef} onChange={e => setSupabaseRef(e.target.value)}
              placeholder="abcdefghijklmnop" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(179, 38, 30, 0.12)", color: "#B3261E",
              fontSize: 12, fontWeight: 500,
            }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 100, border: "1px solid var(--md-surface-variant)",
            background: "transparent", color: "var(--md-on-surface)", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "10px 24px", borderRadius: 100, border: "none",
            background: saving ? "var(--md-outline)" : "var(--md-primary, #6750A4)",
            color: "#fff", cursor: saving ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {saving && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
            {isEdit ? "Save Changes" : "Create App"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Apps Page ────────────────────────────────────────────── */
export default function AppsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskCounts, setTaskCounts] = useState({});
  const [formApp, setFormApp] = useState(null); // null = closed, {} = create, {id,...} = edit
  const [archiving, setArchiving] = useState(null);

  const fetchApps = useCallback(async () => {
    try {
      const [activeResp, archivedResp] = await Promise.all([
        fetch("/api/apps?status=active"),
        fetch("/api/apps?status=archived"),
      ]);
      const active = await activeResp.json();
      const archived = await archivedResp.json();
      const all = [...(Array.isArray(active) ? active : []), ...(Array.isArray(archived) ? archived : [])];
      setApps(all);

      // Fetch task counts per app
      const counts = {};
      await Promise.all(all.map(async (app) => {
        try {
          const resp = await fetch(`/api/apps/${app.id}/tasks?limit=0`);
          const tasks = await resp.json();
          counts[app.id] = Array.isArray(tasks) ? tasks.length : 0;
        } catch {
          counts[app.id] = 0;
        }
      }));
      setTaskCounts(counts);
    } catch (e) {
      console.error("Failed to fetch apps:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleSave = (saved) => {
    setFormApp(null);
    fetchApps();
  };

  const handleArchive = async (app) => {
    if (!confirm(`Archive "${app.name}"? Tasks won't be affected.`)) return;
    setArchiving(app.id);
    try {
      await fetch(`/api/apps/${app.id}`, { method: "DELETE" });
      fetchApps();
    } catch (e) {
      console.error("Archive failed:", e);
    } finally {
      setArchiving(null);
    }
  };

  const handleRestore = async (app) => {
    setArchiving(app.id);
    try {
      await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      fetchApps();
    } catch (e) {
      console.error("Restore failed:", e);
    } finally {
      setArchiving(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--md-on-surface-variant)" }}>
        <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const activeApps = apps.filter(a => a.status === "active");
  const archivedApps = apps.filter(a => a.status === "archived");

  return (
    <div style={{ padding: "24px 32px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)", display: "flex", alignItems: "center", gap: 10 }}>
            <Package size={22} />
            Apps
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            Manage applications, their repos, and deploy targets
          </p>
        </div>
        <button onClick={() => setFormApp({})} style={{
          padding: "10px 20px", borderRadius: 100, border: "none",
          background: "var(--md-primary, #6750A4)", color: "#fff",
          cursor: "pointer", fontSize: 13, fontWeight: 600,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 2px 8px rgba(103,80,164,0.3)",
        }}>
          <Plus size={16} /> New App
        </button>
      </div>

      {/* Active Apps Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {activeApps.map(app => {
          const dtCfg = DEPLOY_TARGET_CONFIG[app.deploy_target] || DEPLOY_TARGET_CONFIG.none;
          return (
            <div key={app.id} style={{
              background: "var(--md-surface, #FFFBFE)", borderRadius: 16,
              border: "1px solid var(--md-surface-variant, #E7E0EC)",
              overflow: "hidden", transition: "box-shadow 200ms",
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ padding: "16px 20px" }}>
                {/* Name + deploy target */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>
                    {app.name}
                  </h3>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 100,
                    background: `${dtCfg.color}14`, color: dtCfg.color,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    {dtCfg.icon} {dtCfg.label}
                  </span>
                </div>

                {/* Slug */}
                <div style={{
                  fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 8,
                }}>{app.slug}</div>

                {/* Description */}
                {app.description && (
                  <p style={{
                    margin: "0 0 10px", fontSize: 12, color: "var(--md-on-surface-variant)",
                    lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>{app.description}</p>
                )}

                {/* Repos */}
                {app.repos?.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {app.repos.map(r => (
                      <span key={r} style={{
                        fontSize: 10, padding: "3px 8px", borderRadius: 6,
                        background: "var(--md-surface-container, #F5F0FB)",
                        color: "var(--md-on-surface-variant)",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{r.split("/").pop()}</span>
                    ))}
                  </div>
                )}

                {/* Stats row */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingTop: 10, borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
                }}>
                  <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
                    {taskCounts[app.id] || 0} tasks
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setFormApp(app)} title="Edit" style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--md-on-surface-variant)", padding: 6, borderRadius: 8,
                      display: "flex", transition: "background 150ms",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    ><Pencil size={14} /></button>
                    <button
                      onClick={() => handleArchive(app)}
                      disabled={archiving === app.id}
                      title="Archive"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--md-on-surface-variant)", padding: 6, borderRadius: 8,
                        display: "flex", transition: "background 150ms",
                        opacity: archiving === app.id ? 0.5 : 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(179,38,30,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    ><Archive size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeApps.length === 0 && (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          color: "var(--md-on-surface-variant)",
        }}>
          <Package size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No apps yet</div>
          <div style={{ fontSize: 13 }}>Create your first app to scope tasks to repos</div>
        </div>
      )}

      {/* Archived section */}
      {archivedApps.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{
            fontSize: 14, fontWeight: 600, color: "var(--md-on-surface-variant)",
            textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12,
          }}>Archived ({archivedApps.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {archivedApps.map(app => (
              <div key={app.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 12,
                background: "var(--md-surface-container, #F5F0FB)",
                opacity: 0.7,
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-on-surface)" }}>{app.name}</span>
                  <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginLeft: 8 }}>{app.slug}</span>
                </div>
                <button onClick={() => handleRestore(app)} disabled={archiving === app.id} style={{
                  padding: "6px 14px", borderRadius: 100, border: "1px solid var(--md-surface-variant)",
                  background: "transparent", color: "var(--md-on-surface)", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  opacity: archiving === app.id ? 0.5 : 1,
                }}>Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {formApp !== null && (
        <AppFormModal app={formApp} onSave={handleSave} onClose={() => setFormApp(null)} />
      )}
    </div>
  );
}
