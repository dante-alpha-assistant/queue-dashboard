import { useReducer, useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, Search, ExternalLink, Check, Loader2, Package, GitBranch, Server, Key, ClipboardList, Sparkles } from "lucide-react";

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
  { key: "GH_TOKEN", icon: "🔑", label: "GH_TOKEN", desc: "GitHub access for cloning and pushing code", alwaysRequired: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY", icon: "🗄️", label: "SUPABASE_SERVICE_ROLE_KEY", desc: "Full access to Supabase database and storage" },
  { key: "SUPABASE_MGMT_TOKEN", icon: "⚙️", label: "SUPABASE_MGMT_TOKEN", desc: "Run SQL migrations and manage Supabase projects" },
  { key: "VERCEL_TOKEN", icon: "▲", label: "VERCEL_TOKEN", desc: "Deploy to Vercel" },
  { key: "KUBECONFIG", icon: "☸️", label: "KUBECONFIG", desc: "Direct Kubernetes cluster access" },
  { key: "OPENROUTER_API_KEY", icon: "🤖", label: "OPENROUTER_API_KEY", desc: "AI model access via OpenRouter" },
];

const DEFAULT_REQ_CREDS = ["GH_TOKEN"];
const DEFAULT_QA_CREDS = ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_MGMT_TOKEN"];

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
  createSuccess: null,
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
    case "AUTO_ADD_CRED": {
      const field = action.field;
      if (state[field].includes(action.key)) return state;
      return { ...state, [field]: [...state[field], action.key] };
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
  const navigate = useNavigate();
  const searchTimer = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [agentCapabilities, setAgentCapabilities] = useState([]);

  // Fetch agent capabilities for preview
  useEffect(() => {
    fetch("/api/agents/capabilities")
      .then(r => r.ok ? r.json() : [])
      .then(data => setAgentCapabilities(data || []))
      .catch(() => setAgentCapabilities([]));
  }, []);

  // Auto-suggest credentials based on Step 3 selections
  useEffect(() => {
    const repos = state.repos || [];
    const repoDeploy = state.repoDeploy || {};
    const deployTargets = repos.map(r => (repoDeploy[r.full_name]?.target) || state.deployTarget);
    const hasVercel = deployTargets.includes("vercel");
    const hasK8s = deployTargets.includes("kubernetes");
    const hasSupabase = !!(state.supabaseRef && state.supabaseRef.trim());

    if (hasVercel && !state.reqCredentials.includes("VERCEL_TOKEN")) {
      dispatch({ type: "AUTO_ADD_CRED", field: "reqCredentials", key: "VERCEL_TOKEN" });
    }
    if (hasK8s && !state.reqCredentials.includes("KUBECONFIG")) {
      dispatch({ type: "AUTO_ADD_CRED", field: "reqCredentials", key: "KUBECONFIG" });
    }
    if (hasSupabase) {
      if (!state.reqCredentials.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        dispatch({ type: "AUTO_ADD_CRED", field: "reqCredentials", key: "SUPABASE_SERVICE_ROLE_KEY" });
      }
      if (!state.reqCredentials.includes("SUPABASE_MGMT_TOKEN")) {
        dispatch({ type: "AUTO_ADD_CRED", field: "reqCredentials", key: "SUPABASE_MGMT_TOKEN" });
      }
      if (!state.qaCredentials.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        dispatch({ type: "AUTO_ADD_CRED", field: "qaCredentials", key: "SUPABASE_SERVICE_ROLE_KEY" });
      }
      if (!state.qaCredentials.includes("SUPABASE_MGMT_TOKEN")) {
        dispatch({ type: "AUTO_ADD_CRED", field: "qaCredentials", key: "SUPABASE_MGMT_TOKEN" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.repos, state.supabaseRef, state.deployTarget, state.repoDeploy]);

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
        supabase_project_ref: state.supabaseRef.trim() || null,
        required_credentials: state.reqCredentials,
        required_qa_credentials: state.qaCredentials,
        env_keys: state.reqCredentials,
        qa_env_keys: state.qaCredentials,
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
      dispatch({ type: "SET_FIELD", field: "createSuccess", value: created });
      onCreated(created);
      setTimeout(() => navigate("/apps/" + created.id), 2000);
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
    /* ── Credential column renderer ─────────────────────── */
    const renderCredColumn = (title, subtitle, field, inputField) => (
      <div style={{
        flex: 1, minWidth: 240,
        background: "var(--md-surface-container-low, #F7F2FA)",
        borderRadius: 16, padding: "20px 18px",
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
        display: "flex", flexDirection: "column", gap: 0,
      }}>
        {/* Column header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)", marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", lineHeight: 1.4 }}>{subtitle}</div>
        </div>

        {/* Standard credential options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {CREDENTIAL_OPTIONS.map(c => {
            const checked = state[field].includes(c.key);
            const locked = c.alwaysRequired;
            return (
              <label key={c.key} onClick={() => !locked && dispatch({ type: "TOGGLE_CRED", field, key: c.key })} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                borderRadius: 10, cursor: locked ? "default" : "pointer",
                background: checked ? "rgba(103,80,164,0.08)" : "white",
                border: `1px solid ${checked ? "rgba(103,80,164,0.3)" : "transparent"}`,
                transition: "all 120ms",
              }}>
                {/* Custom checkbox */}
                <div style={{
                  marginTop: 2, flexShrink: 0,
                  width: 18, height: 18, borderRadius: 5,
                  border: `2px solid ${checked ? "var(--md-primary, #6750A4)" : "var(--md-outline, #79747E)"}`,
                  background: checked ? "var(--md-primary, #6750A4)" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{c.icon}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "var(--md-on-surface)", letterSpacing: "0.02em",
                    }}>{c.label}</span>
                    {locked && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 4,
                        background: "rgba(103,80,164,0.15)", color: "var(--md-primary, #6750A4)",
                        fontWeight: 700, letterSpacing: "0.03em",
                      }}>REQUIRED</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10, color: "var(--md-on-surface-variant)",
                    marginTop: 3, lineHeight: 1.4,
                  }}>{c.desc}</div>
                </div>
              </label>
            );
          })}

          {/* Custom credentials */}
          {state[field].filter(c => !CREDENTIAL_OPTIONS.some(o => o.key === c)).map(c => (
            <div key={c} style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
              borderRadius: 10, background: "rgba(103,80,164,0.08)",
              border: "1px solid rgba(103,80,164,0.3)",
            }}>
              <div style={{
                marginTop: 2, flexShrink: 0,
                width: 18, height: 18, borderRadius: 5,
                border: "2px solid var(--md-primary, #6750A4)",
                background: "var(--md-primary, #6750A4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🔐</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", color: "var(--md-on-surface)",
                  }}>{c}</span>
                  <span style={{
                    fontSize: 9, padding: "1px 5px", borderRadius: 4,
                    background: "rgba(0,0,0,0.06)", color: "var(--md-on-surface-variant)", fontWeight: 600,
                  }}>CUSTOM</span>
                </div>
              </div>
              <button onClick={() => dispatch({ type: "TOGGLE_CRED", field, key: c })} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--md-on-surface-variant)", padding: "0 2px",
                fontSize: 16, lineHeight: 1, flexShrink: 0,
              }}>×</button>
            </div>
          ))}

          {/* Add custom credential */}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              value={state[inputField]}
              onChange={e => dispatch({ type: "SET_FIELD", field: inputField, value: e.target.value })}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dispatch({ type: "ADD_CUSTOM_CRED", field, value: state[inputField], inputField });
                }
              }}
              placeholder="CUSTOM_KEY"
              style={{
                ...inputStyle, flex: 1,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "7px 10px",
              }}
            />
            <button
              onClick={() => dispatch({ type: "ADD_CUSTOM_CRED", field, value: state[inputField], inputField })}
              disabled={!state[inputField].trim()}
              style={{
                padding: "7px 14px", borderRadius: 8, border: "none",
                background: state[inputField].trim() ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant)",
                color: state[inputField].trim() ? "#fff" : "var(--md-on-surface-variant)",
                cursor: state[inputField].trim() ? "pointer" : "not-allowed",
                fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}
            >Add</button>
          </div>
        </div>
      </div>
    );

    /* ── Agent Capability Preview ────────────────────────── */
    const renderAgentPreview = () => {
      if (agentCapabilities.length === 0) return null;
      const isQaAgent = (a) => (a.capabilities || []).includes("qa");
      return (
        <div style={{ marginTop: 4 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "var(--md-on-surface-variant)",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8,
          }}>Agent Capability Preview</div>
          <div style={{
            fontSize: 12, color: "var(--md-on-surface-variant)",
            marginBottom: 12, lineHeight: 1.5,
          }}>
            Based on your selections, these agents can work on this app:
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {agentCapabilities.map(agent => {
              const qaAgent = isQaAgent(agent);
              const requiredCreds = qaAgent ? state.qaCredentials : state.reqCredentials;
              const available = agent.available_credentials || [];
              // GH_TOKEN is always assumed available (any agent with a GH_TOKEN)
              const missing = requiredCreds.filter(c => c !== "GH_TOKEN" && !available.includes(c));
              const compatible = missing.length === 0;
              return (
                <div key={agent.id || agent.name} style={{
                  flexShrink: 0, padding: "12px 14px", borderRadius: 12,
                  border: `2px solid ${compatible ? "rgba(21,128,61,0.3)" : "rgba(185,28,28,0.25)"}`,
                  background: compatible ? "rgba(21,128,61,0.05)" : "rgba(185,28,28,0.04)",
                  minWidth: 180, maxWidth: 240,
                }}>
                  {/* Agent header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      fontSize: 18, width: 32, height: 32, borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--md-surface-container, #F5F0FB)", flexShrink: 0,
                    }}>{agent.avatar || (qaAgent ? "🧪" : "🤖")}</div>
                    <div>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: "var(--md-on-surface)",
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160,
                      }}>{agent.id || agent.name}</div>
                      {qaAgent && (
                        <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>QA Agent</div>
                      )}
                    </div>
                  </div>

                  {/* Compatibility badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {compatible ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                          <circle cx="7" cy="7" r="7" fill="#15803d"/>
                          <polyline points="3.5,7 5.5,9.5 10.5,4.5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>COMPATIBLE</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                          <circle cx="7" cy="7" r="7" fill="#b91c1c"/>
                          <line x1="4.5" y1="4.5" x2="9.5" y2="9.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                          <line x1="9.5" y1="4.5" x2="4.5" y2="9.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c" }}>MISSING</span>
                      </>
                    )}
                  </div>

                  {/* Missing creds list */}
                  {!compatible && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {missing.map(m => (
                        <span key={m} style={{
                          fontSize: 9, padding: "2px 5px", borderRadius: 4,
                          background: "rgba(185,28,28,0.1)", color: "#b91c1c",
                          fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                        }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Two-column layout: stacks on narrow viewports via flexWrap */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {renderCredColumn(
            "What does the coding agent need?",
            "Select env vars the agent must have to build and deploy this app",
            "reqCredentials", "customCredential"
          )}
          {renderCredColumn(
            "What does the QA agent need?",
            "Select env vars the QA agent must have to review and verify",
            "qaCredentials", "customQaCredential"
          )}
        </div>

        {/* Agent capability preview */}
        {renderAgentPreview()}
      </div>
    );
  };

  const renderReview = () => {
    const deployTargetBadge = (target, repoName) => {
      const badges = {
        kubernetes: { bg: "#E8F5E9", color: "#2E7D32", text: "☸️ K8s" },
        vercel: { bg: "#E3F2FD", color: "#1565C0", text: "▲ Vercel" },
        none: { bg: "#F5F5F5", color: "#616161", text: "⏭️ None" },
      };
      const b = badges[target] || badges.none;
      const configSummary = target === "kubernetes"
        ? `${state.k8sNamespace}/${state.k8sService || repoName}`
        : target === "vercel"
        ? (state.vercelProject || repoName)
        : null;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 4,
            background: b.bg, color: b.color, fontWeight: 700,
          }}>{b.text}</span>
          {configSummary && (
            <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>
              {configSummary}
            </span>
          )}
        </div>
      );
    };

    const editLink = (stepIdx) => (
      <button
        onClick={() => dispatch({ type: "SET_FIELD", field: "step", value: stepIdx })}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--md-primary, #6750A4)", fontSize: 11, fontWeight: 600,
          padding: "2px 6px", borderRadius: 4, textDecoration: "underline",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >Edit</button>
    );

    const credPill = (key, variant) => {
      const styles = {
        coding: { background: "rgba(103,80,164,0.1)", color: "var(--md-primary, #6750A4)" },
        qa: { background: "rgba(34,197,94,0.1)", color: "#15803D" },
      };
      const s = styles[variant] || styles.coding;
      return (
        <span key={key} style={{
          display: "inline-flex", alignItems: "center",
          padding: "2px 8px", borderRadius: 4,
          fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
          ...s,
        }}>{key}</span>
      );
    };

    const compatibleAgents = agentCapabilities.filter(agent => {
      if (agent.disabled) return false;
      const available = agent.available_credentials || [];
      const required = agent.capabilities?.includes("qa") ? state.qaCredentials : state.reqCredentials;
      return required.every(c => available.includes(c));
    });

    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: 0,
        border: "1px solid var(--md-surface-variant, #E7E0EC)", borderRadius: 16, overflow: "hidden",
      }}>
        {/* App info */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--md-surface-container, #F5F0FB)", fontSize: 20, flexShrink: 0,
              }}>
                {state.icon || state.name[0]?.toUpperCase() || "📦"}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>{state.name}</div>
                <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>{state.slug}</div>
              </div>
            </div>
            {editLink(0)}
          </div>
          {state.description && (
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.5, marginTop: 8 }}>{state.description}</div>
          )}
        </div>

        {/* Repos */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ ...labelStyle, margin: 0 }}>Repositories ({state.repos.length})</div>
            {editLink(1)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.repos.map(r => (
              <div key={r.full_name} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", borderRadius: 8,
                background: "var(--md-surface-container, #F5F0FB)",
                flexWrap: "wrap", gap: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12 }}>🔗</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "var(--md-on-surface)" }}>{r.full_name}</span>
                </div>
                {deployTargetBadge(state.deployTarget, r.name)}
              </div>
            ))}
          </div>
        </div>

        {/* Supabase */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ ...labelStyle, margin: 0 }}>Supabase</div>
            {editLink(2)}
          </div>
          {state.supabaseRef ? (
            <a
              href={`https://supabase.com/dashboard/project/${state.supabaseRef}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                color: "var(--md-primary, #6750A4)", fontWeight: 600,
              }}
            >
              {state.supabaseRef}
              <ExternalLink size={11} />
            </a>
          ) : (
            <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>No Supabase project</span>
          )}
        </div>

        {/* Credentials */}
        <div style={{ padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ ...labelStyle, margin: 0 }}>Credentials</div>
            {editLink(3)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--md-on-surface-variant)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Coding Agent</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {state.reqCredentials.length > 0
                  ? state.reqCredentials.map(c => credPill(c, "coding"))
                  : <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>—</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--md-on-surface-variant)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>QA Agent</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {state.qaCredentials.length > 0
                  ? state.qaCredentials.map(c => credPill(c, "qa"))
                  : <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>—</span>}
              </div>
            </div>
            {compatibleAgents.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--md-on-surface-variant)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Compatible Agents</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {compatibleAgents.map(a => (
                    <div key={a.id || a.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={12} color="#22C55E" strokeWidth={3} />
                      <span style={{ fontSize: 12, color: "var(--md-on-surface)", fontWeight: 500 }}>{a.name || a.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
          {state.createSuccess ? (
            /* ── Success State ────────────────────────────────── */
            <div style={{
              width: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 8, padding: "4px 0",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "rgba(34,197,94,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Check size={28} color="#22C55E" strokeWidth={3} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--md-on-surface)", textAlign: "center" }}>
                {state.name} created successfully! 🎉
              </div>
              <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>Redirecting in 2 seconds…</div>
              <button
                onClick={() => navigate("/apps/" + state.createSuccess.id)}
                style={{
                  marginTop: 4, padding: "8px 20px", borderRadius: 100, border: "none",
                  background: "#22C55E", color: "#fff",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                Go to App <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <>
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
                    background: state.submitting ? "var(--md-outline, #79747E)" : "var(--md-primary, #6750A4)",
                    color: "#fff", cursor: state.submitting ? "not-allowed" : "pointer",
                    fontSize: 13, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    display: "flex", alignItems: "center", gap: 6,
                    boxShadow: state.submitting ? "none" : "0 2px 8px rgba(103,80,164,0.3)",
                    transition: "background 200ms",
                  }}
                >
                  {state.submitting
                    ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Creating…</>
                    : <><Sparkles size={14} /> Create App</>
                  }
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confetti overlay */}
      {state.createSuccess && <ConfettiOverlay />}
    </div>
  );
}

/* ── Confetti ───────────────────────────────────────────── */
const CONFETTI_COLORS = ["#6750A4", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6", "#F97316"];
const CONFETTI_PARTICLES = [
  { left: "5%",  delay: "0s",    size: 9,  round: true  },
  { left: "12%", delay: "0.1s",  size: 7,  round: false },
  { left: "20%", delay: "0.05s", size: 10, round: false },
  { left: "28%", delay: "0.2s",  size: 8,  round: true  },
  { left: "35%", delay: "0s",    size: 6,  round: true  },
  { left: "42%", delay: "0.15s", size: 11, round: false },
  { left: "50%", delay: "0.08s", size: 8,  round: true  },
  { left: "57%", delay: "0.25s", size: 9,  round: false },
  { left: "64%", delay: "0.03s", size: 7,  round: true  },
  { left: "71%", delay: "0.18s", size: 10, round: false },
  { left: "78%", delay: "0.12s", size: 8,  round: true  },
  { left: "85%", delay: "0.07s", size: 11, round: false },
  { left: "92%", delay: "0.22s", size: 9,  round: true  },
  { left: "8%",  delay: "0.3s",  size: 7,  round: false },
  { left: "16%", delay: "0.35s", size: 8,  round: true  },
  { left: "24%", delay: "0.28s", size: 10, round: false },
  { left: "33%", delay: "0.4s",  size: 6,  round: true  },
  { left: "46%", delay: "0.33s", size: 9,  round: false },
  { left: "60%", delay: "0.38s", size: 11, round: true  },
  { left: "75%", delay: "0.45s", size: 7,  round: false },
];

function ConfettiOverlay() {
  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {CONFETTI_PARTICLES.map((p, i) => (
        <span
          key={i}
          style={{
            position: "fixed",
            left: p.left,
            top: "-20px",
            zIndex: 2000,
            width: p.size,
            height: p.size,
            borderRadius: p.round ? "50%" : "2px",
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `confettiFall 2s ease-in ${p.delay} forwards`,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}
