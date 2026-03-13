import { ExternalLink, Sparkles } from "lucide-react";
import { computeProposedArchitecture } from "../repoArchitecture";

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant, #49454F)",
  marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
};

const DEPLOY_TARGETS = {
  kubernetes: { icon: "☸️", label: "Kubernetes", color: "#326CE5" },
  vercel: { icon: "▲", label: "Vercel", color: "#000" },
  none: { icon: "⏭️", label: "None", color: "#79747E" },
};

const ARCH_ROLE_ICONS = {
  "Frontend": "🖥️",
  "Backend API": "⚙️",
  "Background Worker": "🔄",
  "Monorepo": "📦",
};

export default function StepReview({ state }) {
  const dtCfg = DEPLOY_TARGETS[state.deployTarget] || DEPLOY_TARGETS.none;
  const isScratch = state.repoSource === "scratch";
  const proposed = isScratch ? computeProposedArchitecture(state.name, state.description) : null;

  return (
    <div className="step-fields-stagger">
      {/* Review card */}
      <div className="step-field" style={{
        "--field-index": 0,
        border: "1px solid var(--md-surface-variant, #E7E0EC)", borderRadius: 20, overflow: "hidden",
        background: "var(--md-surface, #FFFBFE)",
      }}>
        {/* App info header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--md-surface-container, #F5F0FB)", fontSize: 24,
              border: "2px solid var(--md-surface-variant)",
            }}>
              {state.icon || state.name[0]?.toUpperCase() || "📦"}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>{state.name}</div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>{state.slug}</div>
            </div>
          </div>
          {state.description && (
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>{state.description}</div>
          )}
        </div>

        {/* Repos — GitHub mode: show selected repos */}
        {!isScratch && (
          <div className="step-field" style={{ "--field-index": 1, padding: "16px 24px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={labelStyle}>Repositories ({state.repos.length})</span>
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 100, fontWeight: 600,
                background: "#24292F", color: "#fff",
              }}>
                ✦ GitHub: @{state.githubUser?.login || "you"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {state.repos.map(r => (
                <a key={r.full_name} href={`https://github.com/${r.full_name}`} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 8,
                  background: "var(--md-surface-container, #F5F0FB)",
                  color: "var(--md-primary, #6750A4)", fontFamily: "'JetBrains Mono', monospace",
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {r.full_name} <ExternalLink size={10} />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Repos — Scratch mode: show proposed architecture */}
        {isScratch && proposed && (
          <div className="step-field" style={{ "--field-index": 1, padding: "16px 24px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={labelStyle}>Proposed Architecture</span>
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 100, fontWeight: 600,
                background: "rgba(124,58,237,0.12)", color: "#7C3AED",
                border: "1px solid rgba(124,58,237,0.25)",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <Sparkles size={10} /> AI
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {proposed.map(r => (
                <div key={r.name} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(124,58,237,0.05)",
                  border: "1px solid rgba(124,58,237,0.15)",
                }}>
                  <span style={{ fontSize: 16 }}>{ARCH_ROLE_ICONS[r.role] || "📁"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "var(--md-primary, #6750A4)",
                    }}>
                      dante-alpha-assistant/{r.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 6,
                    background: "rgba(124,58,237,0.1)", color: "#7C3AED",
                    fontWeight: 600, flexShrink: 0,
                  }}>
                    {r.role}
                  </span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 10, fontSize: 11, color: "var(--md-on-surface-variant, #49454F)",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ color: "#7C3AED" }}>⚡</span>
              AI will confirm this structure when you create the app
            </div>
          </div>
        )}

        {/* Deploy */}
        <div className="step-field" style={{ "--field-index": 2, padding: "16px 24px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
          <div style={labelStyle}>Deploy Target</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{dtCfg.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: dtCfg.color }}>{dtCfg.label}</span>
            {state.deployTarget === "kubernetes" && (
              <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>
                {state.k8sNamespace}/{state.k8sService || (proposed ? proposed[0]?.name : state.repos[0]?.name)}
              </span>
            )}
            {state.deployTarget === "vercel" && (
              <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>
                {state.vercelProject || (proposed ? proposed[0]?.name : state.repos[0]?.name)}
              </span>
            )}
          </div>
        </div>

        {/* Credentials */}
        <div className="step-field" style={{
          "--field-index": 3,
          padding: "16px 24px",
          borderBottom: state.supabaseRef ? "1px solid var(--md-surface-variant, #E7E0EC)" : "none",
        }}>
          <div style={labelStyle}>Credentials</div>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginBottom: 6 }}>
            <strong>Required:</strong> {state.reqCredentials.join(", ") || "—"}
          </div>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            <strong>QA:</strong> {state.qaCredentials.join(", ") || "—"}
          </div>
        </div>

        {/* Supabase */}
        {state.supabaseRef && (
          <div className="step-field" style={{ "--field-index": 4, padding: "16px 24px" }}>
            <div style={labelStyle}>Supabase Project</div>
            <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "var(--md-on-surface-variant)" }}>
              {state.supabaseRef}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
