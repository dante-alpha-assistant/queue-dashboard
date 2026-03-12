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

const K8S_NAMESPACES = ["agents", "dev", "infra", "dante"];

export default function StepDeployTargets({ state, dispatch }) {
  return (
    <div className="step-fields-stagger" style={{ gap: 20 }}>
      {/* Deploy target cards */}
      <div className="step-field" style={{ "--field-index": 0 }}>
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
        <div className="step-field" style={{
          "--field-index": 1,
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
        <div className="step-field" style={{
          "--field-index": 1,
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
        <div className="step-field" style={{
          "--field-index": 1,
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
