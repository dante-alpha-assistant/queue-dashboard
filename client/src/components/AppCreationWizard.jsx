import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight, Search, ExternalLink, Check, Loader2, Package, GitBranch, Server, Key, ClipboardList } from "lucide-react";

/* ── Constants ─────────────────────────────────────────── */
const STEPS = [
  { key: "basic", label: "Basic Info", icon: Package },
  { key: "repos", label: "Repositories", icon: GitBranch },
  { key: "deploy", label: "Deploy Target", icon: Server },
  { key: "credentials", label: "Credentials", icon: Key },
  { key: "review", label: "Review", icon: ClipboardList },
];

const DEPLOY_TARGETS = [
  { value: "kubernetes", icon: "☸️", label: "Kubernetes", color: "#326CE5" },
  { value: "vercel", icon: "▲", label: "Vercel", color: "#000" },
  { value: "none", icon: "⏭️", label: "None", color: "#79747E" },
];

const K8S_NAMESPACES = ["agents", "dev", "infra", "dante"];

const CREDENTIAL_OPTIONS = [
  { key: "GH_TOKEN", label: "GH_TOKEN" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "SUPABASE_SERVICE_ROLE_KEY" },
  { key: "SUPABASE_MGMT_TOKEN", label: "SUPABASE_MGMT_TOKEN" },
  { key: "VERCEL_TOKEN", label: "VERCEL_TOKEN" },
  { key: "KUBECONFIG", label: "KUBECONFIG" },
];

const DEFAULT_REQ_CREDS = ["GH_TOKEN"];
const DEFAULT_QA_CREDS = ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"];

/* ── Helpers ───────────────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ── Reducer ───────────────────────────────────────────── */
const initialState = {
  step: 0,
  name: "",
  slug: "",
  slugManual: false,
  description: "",
  icon: "",
  repos: [],                     // selected repos [{full_name, name, description, language}]
  repoSearch: "",
  repoResults: [],
  repoLoading: false,
  deployTarget: "kubernetes",
  k8sNamespace: "infra",
  k8sService: "",
  vercelProject: "",
  reqCredentials: [...DEFAULT_REQ_CREDS],
  qaCredentials: [...DEFAULT_QA_CREDS],
  customCredential: "",
  customQaCredential: "",
  supabaseRef: "",
  submitting: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_NAME": {
      const s = { ...state, name: action.value };
      if (!s.slugManual) s.slug = slugify(action.value);
      return s;
    }
    case "TOGGLE_REPO": {
      const idx = state.repos.findIndex(r => r.full_name === action.repo.full_name);
      const repos = idx >= 0
        ? state.repos.filter((_, i) => i !== idx)
        : [...state.repos, action.repo];
      const s = { ...state, repos };
      // Auto-suggest k8s service or vercel project from first repo
      if (repos.length > 0 && !state.k8sService) {
        s.k8sService = repos[0].name;
      }
      if (repos.length > 0 && !state.vercelProject) {
        s.vercelProject = repos[0].name;
      }
      return s;
    }
    case "TOGGLE_CRED": {
      const field = action.field; // reqCredentials or qaCredentials
      const creds = state[field];
      const idx = creds.indexOf(action.key);
      return {
        ...state,
        [field]: idx >= 0 ? creds.filter(c => c !== action.key) : [...creds, action.key],
      };
    }
    case "ADD_CUSTOM_CRED": {
      const field = action.field;
      const val = action.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
      if (!val || state[field].includes(val)) return state;
      return { ...state, [field]: [...state[field], val], [action.inputField]: "" };
    }
    case "NEXT_STEP":
      return { ...state, step: Math.min(state.step + 1, STEPS.length - 1), error: null };
    case "PREV_STEP":
      return { ...state, step: Math.max(state.step - 1, 0), error: null };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

/* ── Component ─────────────────────────────────────────── */
export default function AppCreationWizard({ onClose, onCreated }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const searchTimer = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    if (state.name || state.repos.length > 0 || state.description) {
      setHasChanges(true);
    }
  }, [state.name, state.repos.length, state.description]);

  // Debounced repo search
  const searchRepos = useCallback(async (q) => {
    dispatch({ type: "SET_FIELD", field: "repoLoading", value: true });
    try {
      const resp = await fetch(`/api/github/repos?q=${encodeURIComponent(q)}`);
      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      dispatch({ type: "SET_FIELD", field: "repoResults", value: data });
    } catch {
      dispatch({ type: "SET_FIELD", field: "repoResults", value: [] });
    } finally {
      dispatch({ type: "SET_FIELD", field: "repoLoading", value: false });
    }
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchRepos(state.repoSearch);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [state.repoSearch, searchRepos]);

  // Load repos on mount (empty search)
  useEffect(() => { searchRepos(""); }, [searchRepos]);

  const handleClose = () => {
    if (hasChanges && !confirm("You have unsaved changes. Close anyway?")) return;
    onClose();
  };

  const canNext = () => {
    switch (state.step) {
      case 0: return state.name.trim().length > 0 && state.slug.trim().length > 0;
      case 1: return state.repos.length > 0;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    dispatch({ type: "SET_FIELD", field: "submitting", value: true });
    dispatch({ type: "SET_FIELD", field: "error", value: null });

    try {
      const deployConfig = {};
      if (state.deployTarget === "kubernetes") {
        deployConfig.namespace = state.k8sNamespace;
        deployConfig.service = state.k8sService || state.repos[0]?.name || "";
      } else if (state.deployTarget === "vercel") {
        deployConfig.project = state.vercelProject || state.repos[0]?.name || "";
      }

      const body = {
        name: state.name.trim(),
        slug: state.slug.trim(),
        description: state.description.trim() || null,
        icon: state.icon || null,
        repos: state.repos.map(r => r.full_name),
        deploy_target: state.deployTarget,
        deploy_config: deployConfig,
        env_keys: state.reqCredentials,
        qa_env_keys: state.qaCredentials,
        supabase_project_ref: state.supabaseRef.trim() || null,
      };

      const resp = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${resp.status})`);
      }

      const created = await resp.json();
      onCreated(created);
    } catch (e) {
      dispatch({ type: "SET_FIELD", field: "error", value: e.message });
    } finally {
      dispatch({ type: "SET_FIELD", field: "submitting", value: false });
    }
  };

  /* ── Styles ─────────────────────────────────────────── */
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

  /* ── Render Steps ───────────────────────────────────── */
  const renderStep = () => {
    switch (state.step) {
      case 0: return renderBasicInfo();
      case 1: return renderRepos();
      case 2: return renderDeploy();
      case 3: return renderCredentials();
      case 4: return renderReview();
      default: return null;
    }
  };

  const renderBasicInfo = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle}>App Name *</label>
        <input
          value={state.name}
          onChange={e => dispatch({ type: "SET_NAME", value: e.target.value })}
          placeholder="My Awesome App"
          style={inputStyle}
          autoFocus
        />
      </div>
      <div>
        <label style={labelStyle}>Slug</label>
        <input
          value={state.slug}
          onChange={e => dispatch({ type: "SET_FIELD", field: "slug", value: e.target.value })}
          onFocus={() => dispatch({ type: "SET_FIELD", field: "slugManual", value: true })}
          placeholder="my-awesome-app"
          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
        />
        <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 4, display: "block" }}>
          Auto-generated from name. Edit to customize.
        </span>
      </div>
      <div>
        <label style={labelStyle}>Description (optional)</label>
        <textarea
          value={state.description}
          onChange={e => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
          placeholder="What does this app do?"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
        />
      </div>
      <div>
        <label style={labelStyle}>Icon / Emoji (optional)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--md-surface-container, #F5F0FB)", fontSize: 24,
            border: "2px solid var(--md-surface-variant, #E7E0EC)",
          }}>
            {state.icon || (state.name ? state.name[0].toUpperCase() : "📦")}
          </div>
          <input
            value={state.icon}
            onChange={e => dispatch({ type: "SET_FIELD", field: "icon", value: e.target.value })}
            placeholder="🚀 or a letter"
            style={{ ...inputStyle, flex: 1 }}
            maxLength={2}
          />
        </div>
      </div>
    </div>
  );

  const renderRepos = () => {
    const isSelected = (r) => state.repos.some(s => s.full_name === r.full_name);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Selected repos */}
        {state.repos.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {state.repos.map(r => (
              <span key={r.full_name} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 100,
                background: "var(--md-primary, #6750A4)", color: "#fff",
                fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
              }}>
                {r.name}
                <button onClick={() => dispatch({ type: "TOGGLE_REPO", repo: r })} style={{
                  background: "none", border: "none", color: "rgba(255,255,255,0.8)",
                  cursor: "pointer", padding: 0, display: "flex", fontSize: 14, lineHeight: 1,
                }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--md-on-surface-variant)", pointerEvents: "none" }} />
          <input
            value={state.repoSearch}
            onChange={e => dispatch({ type: "SET_FIELD", field: "repoSearch", value: e.target.value })}
            placeholder="Search dante-alpha-assistant repos..."
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
          {state.repoLoading && (
            <Loader2 size={14} style={{ position: "absolute", right: 12, top: 13, animation: "spin 0.8s linear infinite", color: "var(--md-on-surface-variant)" }} />
          )}
        </div>

        {/* Results */}
        <div style={{
          maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
          border: "1px solid var(--md-surface-variant, #E7E0EC)", borderRadius: 12, padding: 6,
        }}>
          {state.repoResults.length === 0 && !state.repoLoading && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
              {state.repoSearch ? "No repos found" : "Loading repos..."}
            </div>
          )}
          {state.repoResults.map(r => {
            const selected = isSelected(r);
            return (
              <button
                key={r.full_name}
                onClick={() => dispatch({ type: "TOGGLE_REPO", repo: r })}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                  borderRadius: 10, border: `2px solid ${selected ? "var(--md-primary, #6750A4)" : "transparent"}`,
                  background: selected ? "rgba(103,80,164,0.06)" : "transparent",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  transition: "all 100ms",
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  border: `2px solid ${selected ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant, #E7E0EC)"}`,
                  background: selected ? "var(--md-primary, #6750A4)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selected && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>
                    {r.name}
                  </div>
                  {r.description && (
                    <div style={{
                      fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{r.description}</div>
                  )}
                  {r.language && (
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 4, marginTop: 4, display: "inline-block",
                      background: "var(--md-surface-container, #F5F0FB)", color: "var(--md-on-surface-variant)",
                    }}>{r.language}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Create new repo link */}
        <a
          href="https://github.com/organizations/dante-alpha-assistant/repositories/new"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "var(--md-primary, #6750A4)", fontWeight: 600, textDecoration: "none",
          }}
        >
          <ExternalLink size={12} /> Create new repo on GitHub
        </a>
      </div>
    );
  };

  const renderDeploy = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle}>Deploy Target</label>
        <div style={{ display: "flex", gap: 10 }}>
          {DEPLOY_TARGETS.map(t => {
            const active = state.deployTarget === t.value;
            return (
              <button key={t.value} onClick={() => dispatch({ type: "SET_FIELD", field: "deployTarget", value: t.value })} style={{
                flex: 1, padding: "16px 12px", borderRadius: 12,
                border: `2px solid ${active ? t.color : "var(--md-surface-variant, #E7E0EC)"}`,
                background: active ? `${t.color}12` : "transparent",
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                color: active ? t.color : "var(--md-on-surface-variant)",
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                transition: "all 150ms",
              }}>
                <span style={{ fontSize: 24 }}>{t.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {state.deployTarget === "kubernetes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 12, background: "rgba(50,108,229,0.04)", border: "1px solid rgba(50,108,229,0.15)" }}>
          <div>
            <label style={labelStyle}>Namespace</label>
            <select
              value={state.k8sNamespace}
              onChange={e => dispatch({ type: "SET_FIELD", field: "k8sNamespace", value: e.target.value })}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {K8S_NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Service Name</label>
            <input
              value={state.k8sService}
              onChange={e => dispatch({ type: "SET_FIELD", field: "k8sService", value: e.target.value })}
              placeholder={state.repos[0]?.name || "my-service"}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {state.deployTarget === "vercel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.02)", border: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{
            padding: "10px 14px", borderRadius: 8, background: "rgba(234,179,8,0.1)",
            color: "#92400E", fontSize: 12, fontWeight: 500,
          }}>
            ⚠️ Vercel deployments require VERCEL_TOKEN in credentials
          </div>
          <div>
            <label style={labelStyle}>Vercel Project Name</label>
            <input
              value={state.vercelProject}
              onChange={e => dispatch({ type: "SET_FIELD", field: "vercelProject", value: e.target.value })}
              placeholder={state.repos[0]?.name || "my-project"}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {state.deployTarget === "none" && (
        <div style={{
          padding: "14px 16px", borderRadius: 12, background: "var(--md-surface-container, #F5F0FB)",
          color: "var(--md-on-surface-variant)", fontSize: 13, lineHeight: 1.6,
        }}>
          ℹ️ <strong>Code changes only.</strong> Tasks for this app will produce PRs but won't trigger deployments.
        </div>
      )}
    </div>
  );

  const renderCredentials = () => {
    const renderCredList = (field, inputField, defaults) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CREDENTIAL_OPTIONS.map(c => {
          const checked = state[field].includes(c.key);
          return (
            <label key={c.key} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
              borderRadius: 8, cursor: "pointer",
              background: checked ? "rgba(103,80,164,0.06)" : "transparent",
              transition: "background 100ms",
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => dispatch({ type: "TOGGLE_CRED", field, key: c.key })}
                style={{ width: 16, height: 16, accentColor: "var(--md-primary, #6750A4)" }}
              />
              <span style={{
                fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                color: "var(--md-on-surface)",
              }}>{c.label}</span>
            </label>
          );
        })}
        {/* Custom credentials */}
        {state[field].filter(c => !CREDENTIAL_OPTIONS.some(o => o.key === c)).map(c => (
          <label key={c} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
            borderRadius: 8, background: "rgba(103,80,164,0.06)",
          }}>
            <input type="checkbox" checked readOnly onChange={() => dispatch({ type: "TOGGLE_CRED", field, key: c })}
              style={{ width: 16, height: 16, accentColor: "var(--md-primary, #6750A4)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "var(--md-on-surface)" }}>{c}</span>
            <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>(custom)</span>
          </label>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            value={state[inputField]}
            onChange={e => dispatch({ type: "SET_FIELD", field: inputField, value: e.target.value })}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); dispatch({ type: "ADD_CUSTOM_CRED", field, value: state[inputField], inputField }); } }}
            placeholder="CUSTOM_KEY"
            style={{ ...inputStyle, flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "6px 10px" }}
          />
          <button
            onClick={() => dispatch({ type: "ADD_CUSTOM_CRED", field, value: state[inputField], inputField })}
            disabled={!state[inputField].trim()}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: state[inputField].trim() ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant)",
              color: "#fff", cursor: state[inputField].trim() ? "pointer" : "not-allowed",
              fontSize: 11, fontWeight: 600, fontFamily: "'Inter', system-ui",
            }}
          >Add</button>
        </div>
      </div>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={{ ...labelStyle, marginBottom: 10 }}>Required Credentials</label>
          {renderCredList("reqCredentials", "customCredential", DEFAULT_REQ_CREDS)}
        </div>
        <div style={{ height: 1, background: "var(--md-surface-variant, #E7E0EC)" }} />
        <div>
          <label style={{ ...labelStyle, marginBottom: 10 }}>QA Credentials</label>
          {renderCredList("qaCredentials", "customQaCredential", DEFAULT_QA_CREDS)}
        </div>
        <div style={{ height: 1, background: "var(--md-surface-variant, #E7E0EC)" }} />
        <div>
          <label style={labelStyle}>Supabase Project Ref (optional)</label>
          <input
            value={state.supabaseRef}
            onChange={e => dispatch({ type: "SET_FIELD", field: "supabaseRef", value: e.target.value })}
            placeholder="abcdefghijklmnop"
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
          />
        </div>
      </div>
    );
  };

  const renderReview = () => {
    const dtCfg = DEPLOY_TARGETS.find(t => t.value === state.deployTarget);
    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: 0,
        border: "1px solid var(--md-surface-variant, #E7E0EC)", borderRadius: 16, overflow: "hidden",
      }}>
        {/* App info */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--md-surface-container, #F5F0FB)", fontSize: 20,
            }}>
              {state.icon || state.name[0]?.toUpperCase() || "📦"}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>{state.name}</div>
              <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>{state.slug}</div>
            </div>
          </div>
          {state.description && (
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.5 }}>{state.description}</div>
          )}
        </div>

        {/* Repos */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Repositories ({state.repos.length})</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {state.repos.map(r => (
              <span key={r.full_name} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                background: "var(--md-surface-container, #F5F0FB)",
                color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace",
              }}>{r.full_name}</span>
            ))}
          </div>
        </div>

        {/* Deploy */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Deploy Target</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>{dtCfg?.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>{dtCfg?.label}</span>
            {state.deployTarget === "kubernetes" && (
              <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>
                {state.k8sNamespace}/{state.k8sService || state.repos[0]?.name}
              </span>
            )}
            {state.deployTarget === "vercel" && (
              <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>
                {state.vercelProject || state.repos[0]?.name}
              </span>
            )}
          </div>
        </div>

        {/* Credentials */}
        <div style={{ padding: "12px 20px", borderBottom: state.supabaseRef ? "1px solid var(--md-surface-variant, #E7E0EC)" : "none" }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Credentials</div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 4 }}>
            <strong>Required:</strong> {state.reqCredentials.join(", ") || "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            <strong>QA:</strong> {state.qaCredentials.join(", ") || "—"}
          </div>
        </div>

        {/* Supabase */}
        {state.supabaseRef && (
          <div style={{ padding: "12px 20px" }}>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Supabase Project</div>
            <span style={{
              fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              color: "var(--md-on-surface-variant)",
            }}>{state.supabaseRef}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={handleClose}>
      <div style={{
        background: "var(--md-surface, #FFFBFE)", borderRadius: 24,
        width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>
            Create New App
          </h2>
          <button onClick={handleClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--md-on-surface-variant)", padding: 4, borderRadius: 8, display: "flex",
          }}><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div style={{
          padding: "16px 24px", display: "flex", alignItems: "center", gap: 4,
          borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
          flexShrink: 0, overflowX: "auto",
        }}>
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const active = i === state.step;
            const done = i < state.step;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4, flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 100,
                  background: active ? "var(--md-primary, #6750A4)" : done ? "rgba(103,80,164,0.12)" : "transparent",
                  color: active ? "#fff" : done ? "var(--md-primary, #6750A4)" : "var(--md-on-surface-variant)",
                  transition: "all 200ms",
                  whiteSpace: "nowrap",
                }}>
                  {done ? <Check size={14} strokeWidth={3} /> : <StepIcon size={14} />}
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, minWidth: 8,
                    background: done ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant, #E7E0EC)",
                    borderRadius: 1, transition: "background 200ms",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{
          padding: "20px 24px", flex: 1, overflowY: "auto",
        }}>
          {renderStep()}

          {state.error && (
            <div style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 8,
              background: "rgba(179, 38, 30, 0.12)", color: "#B3261E",
              fontSize: 12, fontWeight: 500,
            }}>{state.error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <button
            onClick={() => dispatch({ type: "PREV_STEP" })}
            disabled={state.step === 0}
            style={{
              padding: "10px 20px", borderRadius: 100,
              border: "1px solid var(--md-surface-variant)",
              background: "transparent", color: state.step === 0 ? "var(--md-surface-variant)" : "var(--md-on-surface)",
              cursor: state.step === 0 ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: "flex", alignItems: "center", gap: 6, opacity: state.step === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {state.step < STEPS.length - 1 ? (
            <button
              onClick={() => dispatch({ type: "NEXT_STEP" })}
              disabled={!canNext()}
              style={{
                padding: "10px 24px", borderRadius: 100, border: "none",
                background: canNext() ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant)",
                color: canNext() ? "#fff" : "var(--md-on-surface-variant)",
                cursor: canNext() ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={state.submitting}
              style={{
                padding: "10px 24px", borderRadius: 100, border: "none",
                background: state.submitting ? "var(--md-outline)" : "var(--md-primary, #6750A4)",
                color: "#fff", cursor: state.submitting ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: state.submitting ? "none" : "0 2px 8px rgba(103,80,164,0.3)",
              }}
            >
              {state.submitting && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
              Create App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
