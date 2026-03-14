import { useState, useEffect } from "react";
import { Loader2, ChevronLeft } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: 12,
  border: "1px solid var(--md-surface-variant, #E7E0EC)",
  background: "var(--md-surface, #FFFBFE)",
  color: "var(--md-on-surface, #1C1B1F)", fontSize: 14,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 200ms, box-shadow 200ms",
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant, #49454F)",
  marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
};

const DEPLOY_TARGETS = [
  { value: "kubernetes", icon: "☸️", label: "Kubernetes", color: "#326CE5", desc: "Deploy to K8s cluster via ArgoCD" },
  { value: "vercel", icon: "▲", label: "Vercel", color: "#000", desc: "Deploy to Vercel edge network" },
  { value: "none", icon: "⏭️", label: "None", color: "#79747E", desc: "Code only — no auto-deploy" },
];

const K8S_NAMESPACES = ["agents", "apps", "dev", "infra", "dante"];

function PlatformBadge({ target }) {
  if (target === "vercel") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
        background: "#000", color: "#fff",
      }}>▲ Vercel</span>
    );
  }
  if (target === "kubernetes") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
        background: "#326CE5", color: "#fff",
      }}>☸️ Kubernetes</span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
      background: "#79747E", color: "#fff",
    }}>⏭️ None</span>
  );
}

function AISuggestionCard({ suggestion }) {
  const isK8s = suggestion.deploy_target === "kubernetes";
  const isVercel = suggestion.deploy_target === "vercel";
  const icon = isVercel ? "📦" : "⚙️";
  const borderColor = isVercel ? "#E2E8F0" : "rgba(50,108,229,0.2)";
  const bgColor = isVercel ? "var(--md-surface, #FFFBFE)" : "rgba(50,108,229,0.03)";

  return (
    <div style={{
      padding: "16px 20px", borderRadius: 14,
      border: `1px solid ${borderColor}`,
      background: bgColor,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{
            fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
            fontSize: 13, fontWeight: 600, color: "var(--md-on-surface, #1C1B1F)",
          }}>{suggestion.name}</span>
        </div>
        <PlatformBadge target={suggestion.deploy_target} />
      </div>

      {/* Technical details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {isK8s && (
          <>
            <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--md-on-surface-variant, #49454F)" }}>
              <span style={{ fontWeight: 600, minWidth: 80 }}>Namespace:</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{suggestion.namespace || "apps"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--md-on-surface-variant, #49454F)" }}>
              <span style={{ fontWeight: 600, minWidth: 80 }}>Service:</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{suggestion.service_name}</span>
            </div>
          </>
        )}
        {isVercel && (
          <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--md-on-surface-variant, #49454F)" }}>
            <span style={{ fontWeight: 600, minWidth: 80 }}>URL:</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{suggestion.service_name}.vercel.app</span>
          </div>
        )}
      </div>

      {/* Reasoning */}
      {suggestion.reasoning && (
        <div style={{
          fontSize: 12, color: "var(--md-on-surface-variant, #49454F)",
          fontStyle: "italic", lineHeight: 1.5,
          paddingTop: 6, borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
        }}>
          💡 {suggestion.reasoning}
        </div>
      )}
    </div>
  );
}

function ManualConfig({ state, dispatch }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Deploy target cards */}
      <div>
        <label style={labelStyle}>Deploy Target</label>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          {DEPLOY_TARGETS.map(t => {
            const active = state.deployTarget === t.value;
            return (
              <button key={t.value} onClick={() => dispatch({ type: "SET_FIELD", field: "deployTarget", value: t.value })} style={{
                flex: 1, padding: "20px 16px", borderRadius: 16,
                border: `2px solid ${active ? t.color : "var(--md-surface-variant, #E7E0EC)"}`,
                background: active ? `${t.color}10` : "var(--md-surface, #FFFBFE)",
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                color: active ? t.color : "var(--md-on-surface-variant)",
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                transition: "all 200ms ease-out",
                transform: active ? "scale(1.02)" : "scale(1)",
                boxShadow: active ? `0 4px 16px ${t.color}20` : "none",
              }}>
                <span style={{ fontSize: 32 }}>{t.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</span>
                <span style={{ fontSize: 11, opacity: 0.7, textAlign: "center" }}>{t.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kubernetes config */}
      {state.deployTarget === "kubernetes" && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 14,
          padding: 20, borderRadius: 16,
          background: "rgba(50,108,229,0.04)", border: "1px solid rgba(50,108,229,0.15)",
        }}>
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

      {/* Vercel config */}
      {state.deployTarget === "vercel" && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 14,
          padding: 20, borderRadius: 16,
          background: "rgba(0,0,0,0.02)", border: "1px solid var(--md-surface-variant, #E7E0EC)",
        }}>
          <div style={{
            padding: "12px 16px", borderRadius: 10, background: "rgba(234,179,8,0.1)",
            color: "#92400E", fontSize: 13, fontWeight: 500,
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

      {/* None info */}
      {state.deployTarget === "none" && (
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "var(--md-surface-container, #F5F0FB)",
          color: "var(--md-on-surface-variant)", fontSize: 14, lineHeight: 1.6,
        }}>
          ℹ️ <strong>Code changes only.</strong> Tasks for this app will produce PRs but won't trigger deployments.
        </div>
      )}
    </div>
  );
}

export default function StepDeployTargets({ state, dispatch }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    // Skip if suggestions already loaded
    if (state.aiSuggestions) return;

    // Build repos list for the API call
    let reposForApi = [];
    if (state.repoSource === "scratch") {
      if (state.repos && state.repos.length > 0) {
        reposForApi = state.repos.map(r => ({ name: r.name || r, source: "scratch" }));
      } else {
        // Fallback: use slug or name
        reposForApi = [{ name: state.slug || state.name || "my-app", source: "scratch" }];
      }
    } else {
      reposForApi = (state.repos || []).map(r => ({ name: r.name, source: "github" }));
    }

    if (reposForApi.length === 0) {
      setShowManual(true);
      return;
    }

    setLoading(true);
    setError(null);

    fetch("/api/apps/suggest-deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.name,
        description: state.description,
        repos: reposForApi,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.repos) && data.repos.length > 0) {
          dispatch({ type: "SET_FIELD", field: "aiSuggestions", value: data.repos });
          // Also set the primary deployTarget from first repo for backward compat
          const primary = data.repos[0];
          if (primary) {
            dispatch({ type: "SET_FIELD", field: "deployTarget", value: primary.deploy_target || "kubernetes" });
            if (primary.deploy_target === "kubernetes") {
              dispatch({ type: "SET_FIELD", field: "k8sNamespace", value: primary.namespace || "apps" });
              dispatch({ type: "SET_FIELD", field: "k8sService", value: primary.service_name || "" });
            } else if (primary.deploy_target === "vercel") {
              dispatch({ type: "SET_FIELD", field: "vercelProject", value: primary.service_name || "" });
            }
          }
        } else {
          setShowManual(true);
        }
      })
      .catch(e => {
        console.warn("[suggest-deploy] fetch failed:", e.message);
        setError("Could not analyze your app — please configure manually below.");
        setShowManual(true);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="step-fields-stagger" style={{ gap: 20 }}>
        <div className="step-field" style={{
          "--field-index": 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          padding: "48px 24px", borderRadius: 20,
          border: "1px solid var(--md-surface-variant, #E7E0EC)",
          background: "var(--md-surface, #FFFBFE)",
          textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(124,58,237,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Loader2 size={28} style={{ animation: "spin 0.8s linear infinite", color: "#7C3AED" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface, #1C1B1F)", marginBottom: 6 }}>
              🤖 Analyzing your app...
            </div>
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant, #49454F)" }}>
              Deciding the best deploy strategy for your repos
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AI Suggestion card (confirmed suggestions available and not in manual mode)
  if (state.aiSuggestions && !showManual) {
    return (
      <div className="step-fields-stagger" style={{ gap: 20 }}>
        {/* Header */}
        <div className="step-field" style={{
          "--field-index": 0,
          padding: "18px 20px", borderRadius: 16,
          background: "rgba(124,58,237,0.06)",
          border: "1px solid rgba(124,58,237,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1C1B1F" }}>AI-Suggested Deploy Strategy</span>
            <span style={{
              marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 100,
              background: "rgba(124,58,237,0.15)", color: "#7C3AED", fontWeight: 700,
            }}>AI</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant, #49454F)" }}>
            Based on your app description, here is the recommended setup:
          </div>
        </div>

        {/* Per-repo suggestion cards */}
        {state.aiSuggestions.map((suggestion, i) => (
          <div key={suggestion.name} className="step-field" style={{ "--field-index": i + 1 }}>
            <AISuggestionCard suggestion={suggestion} />
          </div>
        ))}

        {/* Action buttons */}
        <div className="step-field" style={{
          "--field-index": state.aiSuggestions.length + 1,
          display: "flex", gap: 12,
        }}>
          <button
            onClick={() => setShowManual(true)}
            style={{
              flex: 1, padding: "12px 20px", borderRadius: 12,
              border: "1px solid var(--md-surface-variant, #E7E0EC)",
              background: "var(--md-surface, #FFFBFE)",
              color: "var(--md-on-surface-variant, #49454F)",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 150ms",
            }}
          >
            ✏️ Let me adjust
          </button>
        </div>

        {error && (
          <div style={{
            padding: "12px 16px", borderRadius: 12,
            background: "rgba(179,38,30,0.1)", color: "#B3261E",
            fontSize: 13, fontWeight: 500,
          }}>{error}</div>
        )}
      </div>
    );
  }

  // Manual config view
  return (
    <div className="step-fields-stagger" style={{ gap: 20 }}>
      {/* Back to AI suggestion link */}
      {state.aiSuggestions && (
        <div className="step-field" style={{ "--field-index": 0 }}>
          <button
            onClick={() => setShowManual(false)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#7C3AED", fontSize: 13, fontWeight: 600,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: "flex", alignItems: "center", gap: 4, padding: 0,
            }}
          >
            <ChevronLeft size={16} /> Back to AI suggestion
          </button>
        </div>
      )}

      {error && (
        <div className="step-field" style={{
          "--field-index": 0,
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(179,38,30,0.1)", color: "#B3261E",
          fontSize: 13, fontWeight: 500,
        }}>{error}</div>
      )}

      <div className="step-field" style={{ "--field-index": state.aiSuggestions ? 1 : 0 }}>
        <ManualConfig state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}
