import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Plus, Pencil, Archive, RotateCcw, X, Loader2, Search, XCircle, ChevronLeft, Save, BarChart3, ExternalLink, Clock, CheckCircle2, XOctagon, Rocket, Activity } from "lucide-react";

const DEPLOY_TARGETS = ["kubernetes", "vercel", "none"];
const DEPLOY_TARGET_CONFIG = {
  kubernetes: { icon: "☸️", label: "Kubernetes", color: "#326CE5", bg: "#326CE512" },
  vercel: { icon: "▲", label: "Vercel", color: "#0070F3", bg: "#0070F312" },
  none: { icon: "⏭️", label: "None", color: "#79747E", bg: "#79747E12" },
};

const STATUS_COLORS = {
  todo: "#79747E",
  assigned: "#E8A317",
  in_progress: "#E8A317",
  blocked: "#D84315",
  qa_testing: "#7B5EA7",
  completed: "#1B5E20",
  deploying: "#E65100",
  deployed: "#00897B",
  deploy_failed: "#C62828",
  failed: "#BA1A1A",
};

const APP_STATUS_CONFIG = {
  active:      { label: "Active",      color: "#1B5E20", bg: "#1B5E2014" },
  building:    { label: "Building",    color: "#E8A317", bg: "#E8A31714" },
  scaffolding: { label: "Scaffolding", color: "#7B5EA7", bg: "#7B5EA714" },
  deploying:   { label: "Deploying",   color: "#E65100", bg: "#E6510014" },
  failed:      { label: "Failed",      color: "#BA1A1A", bg: "#BA1A1A14" },
  archived:    { label: "Archived",    color: "#79747E", bg: "#79747E14" },
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function timeAgo(dateStr) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ── Shared Styles ──────────────────────────────────────── */
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
      const resp = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="My App" style={inputStyle} autoFocus />
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
                    background: active ? cfg.bg : "transparent",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    color: active ? cfg.color : "var(--md-on-surface-variant)",
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif", transition: "all 150ms",
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

/* ── App Detail View ──────────────────────────────────────── */
function AppDetailView({ app, onBack, onSave, onArchive, onRestore }) {
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [form, setForm] = useState({ ...app });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [taskFilter, setTaskFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tasksResp, statsResp] = await Promise.all([
          fetch(`/api/apps/${app.id}/tasks`),
          fetch(`/api/apps/${app.id}/stats`),
        ]);
        if (cancelled) return;
        const tasksData = await tasksResp.json();
        const statsData = await statsResp.json();
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setStats(statsData);
      } catch (e) {
        console.error("Failed to fetch app details:", e);
      } finally {
        if (!cancelled) setLoadingTasks(false);
      }
    })();
    return () => { cancelled = true; };
  }, [app.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name?.trim(),
        slug: form.slug?.trim(),
        description: form.description?.trim() || null,
        repos: typeof form.repos === "string"
          ? form.repos.split("\n").map(r => r.trim()).filter(Boolean)
          : form.repos || [],
        deploy_target: form.deploy_target || "none",
        supabase_project_ref: form.supabase_project_ref?.trim() || null,
      };
      const resp = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || "Save failed");
      const saved = await resp.json();
      setEditing(false);
      onSave(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const dtCfg = DEPLOY_TARGET_CONFIG[app.deploy_target] || DEPLOY_TARGET_CONFIG.none;
  const isArchived = app.status === "archived";

  const filteredTasks = useMemo(() => {
    if (taskFilter === "all") return tasks;
    if (taskFilter === "active") return tasks.filter(t => ["todo", "assigned", "in_progress", "blocked", "qa_testing"].includes(t.status));
    return tasks.filter(t => t.status === taskFilter);
  }, [tasks, taskFilter]);

  const taskFilterOptions = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "deployed", label: "Deployed" },
    { key: "failed", label: "Failed" },
  ];

  return (
    <div style={{ padding: "24px 32px", maxWidth: 960, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
        cursor: "pointer", color: "var(--md-primary, #6750A4)", fontSize: 13, fontWeight: 600,
        padding: 0, marginBottom: 20, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>
        <ChevronLeft size={16} /> Back to Apps
      </button>

      {/* App Header */}
      <div style={{
        background: "var(--md-surface, #FFFBFE)", borderRadius: 16,
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
        padding: "24px 28px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)" }}>
                {app.name}
              </h1>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
                background: (APP_STATUS_CONFIG[app.status] || APP_STATUS_CONFIG.active).bg,
                color: (APP_STATUS_CONFIG[app.status] || APP_STATUS_CONFIG.active).color,
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>{(APP_STATUS_CONFIG[app.status] || { label: app.status }).label}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
                background: dtCfg.bg, color: dtCfg.color,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>{dtCfg.icon} {dtCfg.label}</span>
            </div>
            <div style={{
              fontSize: 12, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 6,
            }}>{app.slug}</div>
            {app.description && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.5 }}>
                {app.description}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!isArchived && (
              <button onClick={() => { setEditing(true); setForm({ ...app, repos: (app.repos || []).join("\n") }); }}
                style={{
                  padding: "8px 16px", borderRadius: 100, border: "1px solid var(--md-surface-variant)",
                  background: "transparent", color: "var(--md-on-surface)", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <Pencil size={13} /> Edit
              </button>
            )}
            {isArchived ? (
              <button onClick={() => onRestore(app)} style={{
                padding: "8px 16px", borderRadius: 100, border: "1px solid var(--md-surface-variant)",
                background: "transparent", color: "var(--md-primary)", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <RotateCcw size={13} /> Restore
              </button>
            ) : (
              <button onClick={() => onArchive(app)} style={{
                padding: "8px 16px", borderRadius: 100, border: "1px solid rgba(186,26,26,0.3)",
                background: "transparent", color: "#BA1A1A", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Archive size={13} /> Archive
              </button>
            )}
          </div>
        </div>

        {/* Repos */}
        {app.repos?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {app.repos.map(r => (
              <a key={r} href={`https://github.com/${r}`} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 8,
                  background: "var(--md-surface-container, #F5F0FB)",
                  color: "var(--md-primary, #6750A4)",
                  fontFamily: "'JetBrains Mono', monospace",
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                  transition: "background 150ms",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-variant)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--md-surface-container, #F5F0FB)"}
              >
                {r} <ExternalLink size={10} />
              </a>
            ))}
          </div>
        )}

        {app.supabase_project_ref && (
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Supabase:</span>
            <code style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{app.supabase_project_ref}</code>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Tasks", value: stats.total, icon: BarChart3, color: "#6750A4" },
            { label: "Active", value: stats.active, icon: Activity, color: "#E8A317" },
            { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "#1B5E20" },
            { label: "Deployed", value: stats.deployed, icon: Rocket, color: "#00897B" },
            { label: "Failed", value: stats.failed, icon: XOctagon, color: "#BA1A1A" },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--md-surface, #FFFBFE)", borderRadius: 12,
              border: "1px solid var(--md-surface-variant, #E7E0EC)",
              padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <s.icon size={14} style={{ color: s.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {s.label}
                </span>
              </div>
              <span style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Task List */}
      <div style={{
        background: "var(--md-surface, #FFFBFE)", borderRadius: 16,
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--md-on-surface)" }}>
            Tasks ({filteredTasks.length})
          </h2>
          <div style={{ display: "flex", gap: 4 }}>
            {taskFilterOptions.map(f => (
              <button key={f.key} onClick={() => setTaskFilter(f.key)} style={{
                padding: "5px 12px", borderRadius: 100, border: "none",
                background: taskFilter === f.key ? "var(--md-primary, #6750A4)" : "var(--md-surface-container, #F5F0FB)",
                color: taskFilter === f.key ? "#fff" : "var(--md-on-surface-variant)",
                cursor: "pointer", fontSize: 11, fontWeight: 600,
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                transition: "all 150ms",
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        {loadingTasks ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--md-on-surface-variant)" }}>
            <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
            No tasks{taskFilter !== "all" ? ` with status "${taskFilter}"` : ""}
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflow: "auto" }}>
            {filteredTasks.map(t => (
              <a key={t.id} href={`/task/${t.id}`} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 20px", textDecoration: "none",
                borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
                transition: "background 100ms", color: "inherit",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container, #F5F0FB)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: STATUS_COLORS[t.status] || "#79747E",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", display: "flex", gap: 8, marginTop: 2 }}>
                    <span>{t.status?.replace(/_/g, " ")}</span>
                    {t.type && <span>• {t.type}</span>}
                    {t.assigned_agent && <span>• {t.assigned_agent}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", flexShrink: 0 }}>
                  {timeAgo(t.updated_at)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Edit Inline Sheet */}
      {editing && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setEditing(false)}>
          <div style={{
            background: "var(--md-surface, #FFFBFE)", borderRadius: 20,
            width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto",
            boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
            }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>Edit App</h2>
              <button onClick={() => setEditing(false)} style={{
                background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)",
                padding: 4, borderRadius: 8, display: "flex",
              }}><X size={20} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input value={form.slug || ""} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} />
              </div>
              <div>
                <label style={labelStyle}>Repos (one per line)</label>
                <textarea value={form.repos || ""} onChange={e => setForm(f => ({ ...f, repos: e.target.value }))}
                  rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
              </div>
              <div>
                <label style={labelStyle}>Deploy Target</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {DEPLOY_TARGETS.map(t => {
                    const cfg = DEPLOY_TARGET_CONFIG[t];
                    const active = form.deploy_target === t;
                    return (
                      <button key={t} onClick={() => setForm(f => ({ ...f, deploy_target: t }))} style={{
                        flex: 1, padding: "10px 12px", borderRadius: 10,
                        border: `2px solid ${active ? cfg.color : "var(--md-surface-variant, #E7E0EC)"}`,
                        background: active ? cfg.bg : "transparent",
                        cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        color: active ? cfg.color : "var(--md-on-surface-variant)",
                        fontFamily: "'Inter', system-ui, -apple-system, sans-serif", transition: "all 150ms",
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
                <input value={form.supabase_project_ref || ""} onChange={e => setForm(f => ({ ...f, supabase_project_ref: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
              </div>
              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(179,38,30,0.12)", color: "#B3261E", fontSize: 12, fontWeight: 500 }}>
                  {error}
                </div>
              )}
            </div>
            <div style={{
              padding: "16px 24px", borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
              display: "flex", justifyContent: "flex-end", gap: 10,
            }}>
              <button onClick={() => setEditing(false)} style={{
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
                <Save size={14} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── App Card ─────────────────────────────────────────────── */
function AppCard({ app, stats, onSelect, onEdit, onArchive }) {
  const dtCfg = DEPLOY_TARGET_CONFIG[app.deploy_target] || DEPLOY_TARGET_CONFIG.none;
  const s = stats || { total: 0, active: 0 };

  return (
    <div
      onClick={() => onSelect(app)}
      style={{
        background: "var(--md-surface, #FFFBFE)", borderRadius: 16,
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
        overflow: "hidden", transition: "all 200ms", cursor: "pointer",
        transform: "translateY(0)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ padding: "16px 20px" }}>
        {/* Name + status + deploy */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{app.name}</h3>
            {app.status && app.status !== "active" && (() => {
              const sc = APP_STATUS_CONFIG[app.status] || { label: app.status, color: "#79747E", bg: "#79747E14" };
              return (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
                  background: sc.bg, color: sc.color, textTransform: "uppercase",
                  letterSpacing: "0.04em", flexShrink: 0,
                }}>{sc.label}</span>
              );
            })()}
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
            background: dtCfg.bg, color: dtCfg.color, textTransform: "uppercase",
            letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
          }}>{dtCfg.icon} {dtCfg.label}</span>
        </div>

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
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
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

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 10, borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
              <span style={{ color: "#E8A317", fontWeight: 700 }}>{s.active}</span> active / {s.total} total
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {s.last_activity && (
              <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={10} /> {timeAgo(s.last_activity)}
              </span>
            )}
            <div style={{ display: "flex", gap: 2 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => onEdit(app)} title="Edit" style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--md-on-surface-variant)", padding: 5, borderRadius: 8,
                display: "flex", transition: "background 150ms",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              ><Pencil size={13} /></button>
              <button onClick={() => onArchive(app)} title="Archive" style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--md-on-surface-variant)", padding: 5, borderRadius: 8,
                display: "flex", transition: "background 150ms",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(179,38,30,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              ><Archive size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── New App Card ────────────────────────────────────────── */
function NewAppCard() {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate("/apps/new")}
      style={{
        borderRadius: 16, border: "2px dashed var(--md-surface-variant, #E7E0EC)",
        overflow: "hidden", transition: "all 200ms", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: 180, gap: 10,
        background: "transparent",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--md-primary, #6750A4)";
        e.currentTarget.style.background = "var(--md-surface, #FFFBFE)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--md-surface-variant, #E7E0EC)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "var(--md-surface-container, #F5F0FB)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Plus size={20} style={{ color: "var(--md-primary, #6750A4)" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface-variant)" }}>New App</span>
    </div>
  );
}

/* ── Apps Page ────────────────────────────────────────────── */
export default function AppsPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkStats, setBulkStats] = useState({});
  const [formApp, setFormApp] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active | archived | all

  const fetchApps = useCallback(async () => {
    try {
      const [allResp, statsResp] = await Promise.all([
        fetch("/api/apps?status=all"),
        fetch("/api/apps/stats/bulk"),
      ]);
      const all = await allResp.json();
      const stats = await statsResp.json();
      setApps(Array.isArray(all) ? all : []);
      setBulkStats(stats);
    } catch (e) {
      console.error("Failed to fetch apps:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleSave = (saved) => {
    setFormApp(null);
    if (selectedApp && saved.id === selectedApp.id) {
      setSelectedApp(saved);
    }
    fetchApps();
  };

  const handleArchive = async (app) => {
    if (!confirm(`Archive "${app.name}"? Tasks won't be affected.`)) return;
    setArchiving(app.id);
    try {
      await fetch(`/api/apps/${app.id}`, { method: "DELETE" });
      if (selectedApp?.id === app.id) setSelectedApp(null);
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
      if (selectedApp?.id === app.id) setSelectedApp(prev => ({ ...prev, status: "active" }));
      fetchApps();
    } catch (e) {
      console.error("Restore failed:", e);
    } finally {
      setArchiving(null);
    }
  };

  // Filtered apps
  const filteredApps = useMemo(() => {
    let result = apps;
    if (statusFilter === "active") result = result.filter(a => a.status !== "archived");
    else if (statusFilter === "archived") result = result.filter(a => a.status === "archived");
    // "all" → no status filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.slug?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.repos?.some(r => r.toLowerCase().includes(q))
      );
    }
    return result;
  }, [apps, statusFilter, searchQuery]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--md-on-surface-variant)" }}>
        <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // Detail view
  if (selectedApp) {
    return (
      <AppDetailView
        app={selectedApp}
        onBack={() => setSelectedApp(null)}
        onSave={handleSave}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
    );
  }

  const activeCount = apps.filter(a => a.status !== "archived").length;
  const archivedCount = apps.filter(a => a.status === "archived").length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)", display: "flex", alignItems: "center", gap: 10 }}>
            <Package size={22} /> Apps
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            Manage applications, repos, and deploy targets
          </p>
        </div>
        <button onClick={() => navigate("/apps/new")} style={{
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

      {/* Search & Filter Bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
        padding: "12px 16px", borderRadius: 14,
        background: "var(--md-surface, #FFFBFE)",
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
      }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--md-on-surface-variant)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              ...inputStyle, paddingLeft: 32, paddingRight: searchQuery ? 30 : 12,
              borderRadius: 10, width: "100%",
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--md-on-surface-variant)", padding: 0, display: "flex",
            }}><XCircle size={14} /></button>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "active", label: `Active (${activeCount})` },
            { key: "archived", label: `Archived (${archivedCount})` },
            { key: "all", label: `All (${apps.length})` },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
              padding: "6px 14px", borderRadius: 100, border: "none",
              background: statusFilter === f.key ? "var(--md-primary, #6750A4)" : "var(--md-surface-container, #F5F0FB)",
              color: statusFilter === f.key ? "#fff" : "var(--md-on-surface-variant)",
              cursor: "pointer", fontSize: 11, fontWeight: 600,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              transition: "all 150ms",
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Apps Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filteredApps.map(app => (
          <AppCard
            key={app.id}
            app={app}
            stats={bulkStats[app.id]}
            onSelect={setSelectedApp}
            onEdit={(a) => setFormApp(a)}
            onArchive={handleArchive}
          />
        ))}
        {statusFilter !== "archived" && <NewAppCard />}
      </div>

      {filteredApps.length === 0 && !searchQuery && statusFilter === "active" && (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          color: "var(--md-on-surface-variant)",
        }}>
          <Package size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No apps yet</div>
          <div style={{ fontSize: 13 }}>Create your first app to scope tasks to repos</div>
        </div>
      )}

      {filteredApps.length === 0 && searchQuery && (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          color: "var(--md-on-surface-variant)",
        }}>
          <Search size={36} strokeWidth={1} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>No apps matching "{searchQuery}"</div>
        </div>
      )}

      {/* Form Modal */}
      {formApp !== null && (
        <AppFormModal app={formApp} onSave={handleSave} onClose={() => setFormApp(null)} />
      )}
    </div>
  );
}
