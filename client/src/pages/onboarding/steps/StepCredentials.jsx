import { useEffect, useState } from "react";

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
  marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
};

const CREDENTIAL_OPTIONS = [
  { key: "GH_TOKEN", label: "GH_TOKEN" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "SUPABASE_SERVICE_ROLE_KEY" },
  { key: "SUPABASE_MGMT_TOKEN", label: "SUPABASE_MGMT_TOKEN" },
  { key: "VERCEL_TOKEN", label: "VERCEL_TOKEN" },
  { key: "KUBECONFIG", label: "KUBECONFIG" },
];

/* ── Auto-selection helpers ───────────────────────────── */
function getAutoReqCreds(deployTarget) {
  switch (deployTarget) {
    case "kubernetes":
      return ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_MGMT_TOKEN", "KUBECONFIG"];
    case "vercel":
      return ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN"];
    default:
      return ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"];
  }
}

const AUTO_QA_CREDS = ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"];

/** Parse a raw .env string into an array of {key, value} objects */
function parseEnvText(text) {
  if (!text) return [];
  const lines = text.split("\n");
  const vars = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) vars.push({ key, value });
  }
  return vars;
}

function CredentialList({ state, dispatch, field, inputField }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {CREDENTIAL_OPTIONS.map(c => {
        const checked = state[field].includes(c.key);
        return (
          <label key={c.key} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
            borderRadius: 10, cursor: "pointer",
            background: checked ? "rgba(103,80,164,0.06)" : "transparent",
            border: `1px solid ${checked ? "rgba(103,80,164,0.2)" : "transparent"}`,
            transition: "all 150ms",
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => dispatch({ type: "TOGGLE_CRED", field, key: c.key })}
              style={{ width: 18, height: 18, accentColor: "var(--md-primary, #6750A4)" }}
            />
            <span style={{
              fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
              color: "var(--md-on-surface)",
            }}>{c.label}</span>
          </label>
        );
      })}
      {state[field].filter(c => !CREDENTIAL_OPTIONS.some(o => o.key === c)).map(c => (
        <label key={c} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
          borderRadius: 10, background: "rgba(103,80,164,0.06)",
          border: "1px solid rgba(103,80,164,0.2)",
        }}>
          <input type="checkbox" checked readOnly onChange={() => dispatch({ type: "TOGGLE_CRED", field, key: c })}
            style={{ width: 18, height: 18, accentColor: "var(--md-primary, #6750A4)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: "var(--md-on-surface)" }}>{c}</span>
          <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontStyle: "italic" }}>(custom)</span>
        </label>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input
          value={state[inputField]}
          onChange={e => dispatch({ type: "SET_FIELD", field: inputField, value: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); dispatch({ type: "ADD_CUSTOM_CRED", field, value: state[inputField], inputField }); } }}
          placeholder="CUSTOM_KEY"
          style={{ ...inputStyle, flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "8px 12px" }}
        />
        <button
          onClick={() => dispatch({ type: "ADD_CUSTOM_CRED", field, value: state[inputField], inputField })}
          disabled={!state[inputField].trim()}
          style={{
            padding: "8px 18px", borderRadius: 10, border: "none",
            background: state[inputField].trim() ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant)",
            color: "#fff", cursor: state[inputField].trim() ? "pointer" : "not-allowed",
            fontSize: 12, fontWeight: 600, fontFamily: "'Inter', system-ui",
            transition: "all 150ms",
          }}
        >Add</button>
      </div>
    </div>
  );
}

/** Raw .env paste view for existing repo apps */
function EnvPasteCredentials({ state, dispatch }) {
  const parsed = parseEnvText(state.rawEnvCredentials || "");

  return (
    <div className="step-fields-stagger" style={{ gap: 24 }}>
      <div className="step-field" style={{
        "--field-index": 0,
        padding: "14px 16px", borderRadius: 12,
        background: "rgba(103,80,164,0.06)",
        border: "1px solid rgba(103,80,164,0.2)",
        color: "var(--md-on-surface)", fontSize: 13, lineHeight: 1.6,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>
        🔐 <strong>Paste your app's environment variables below.</strong> The AI agent will securely handle sealing, storing in the GitOps repo, and making them available to your app's tasks.
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
          Paste your <code style={{ background: "var(--md-surface-variant)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>.env</code> file contents — comments and blank lines are ignored. Values are encrypted before storage.
        </div>
      </div>

      <div className="step-field" style={{ "--field-index": 1 }}>
        <label style={labelStyle}>Environment Variables</label>
        <textarea
          value={state.rawEnvCredentials || ""}
          onChange={e => dispatch({ type: "SET_FIELD", field: "rawEnvCredentials", value: e.target.value })}
          placeholder={`# Paste your .env file here\nDATABASE_URL="postgres://..."\nAPI_KEY="sk-..."\nSECRET_TOKEN="..."`}
          rows={12}
          style={{
            ...inputStyle,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            lineHeight: 1.7,
            resize: "vertical",
            minHeight: 200,
          }}
        />
      </div>

      {parsed.length > 0 && (
        <div className="step-field" style={{ "--field-index": 2 }}>
          <label style={labelStyle}>Detected Variables ({parsed.length})</label>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
          }}>
            {parsed.map(({ key }) => (
              <span key={key} style={{
                padding: "4px 10px", borderRadius: 8,
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.25)",
                fontSize: 12, fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#166534",
              }}>
                {key}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="step-field" style={{ "--field-index": 3 }}>
        <label style={labelStyle}>Supabase Project Ref (optional)</label>
        <input
          value={state.supabaseRef}
          onChange={e => dispatch({ type: "SET_FIELD", field: "supabaseRef", value: e.target.value })}
          placeholder="abcdefghijklmnop"
          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
        />
      </div>
    </div>
  );
}

export default function StepCredentials({ state, dispatch }) {
  const isScratch = state.repoSource === "scratch";
  const isExistingRepo = state.repoSource === "github" || state.repoSource === "existing";

  /* Auto-select credentials for scratch apps based on deploy target */
  useEffect(() => {
    if (!isScratch) return;
    const autoCreds = getAutoReqCreds(state.deployTarget);
    dispatch({ type: "SET_FIELD", field: "reqCredentials", value: autoCreds });
    dispatch({ type: "SET_FIELD", field: "qaCredentials", value: AUTO_QA_CREDS });
  }, [isScratch, state.deployTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // For existing repos: show the raw .env paste view
  if (isExistingRepo) {
    return <EnvPasteCredentials state={state} dispatch={dispatch} />;
  }

  // For scratch apps: show the checkbox credential picker
  return (
    <div className="step-fields-stagger" style={{ gap: 24 }}>
      {isScratch && (
        <div className="step-field" style={{
          "--field-index": 0,
          padding: "14px 16px", borderRadius: 12,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.3)",
          color: "#166534", fontSize: 13, lineHeight: 1.6,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          ✅ <strong>Internal platform credentials will be automatically provided</strong> to agents building your app. Selections below are pre-filled based on your deploy target — you can still customize as needed.
        </div>
      )}

      <div className="step-field" style={{ "--field-index": isScratch ? 1 : 0 }}>
        <label style={labelStyle}>Required Credentials</label>
        <CredentialList state={state} dispatch={dispatch} field="reqCredentials" inputField="customCredential" />
      </div>

      <div className="step-field" style={{ "--field-index": isScratch ? 2 : 1, height: 1, background: "var(--md-surface-variant, #E7E0EC)" }} />

      <div className="step-field" style={{ "--field-index": isScratch ? 3 : 2 }}>
        <label style={labelStyle}>QA Credentials</label>
        <CredentialList state={state} dispatch={dispatch} field="qaCredentials" inputField="customQaCredential" />
      </div>

      <div className="step-field" style={{ "--field-index": isScratch ? 4 : 3, height: 1, background: "var(--md-surface-variant, #E7E0EC)" }} />

      <div className="step-field" style={{ "--field-index": isScratch ? 5 : 4 }}>
        <label style={labelStyle}>Supabase Project Ref (optional)</label>
        <input
          value={state.supabaseRef}
          onChange={e => dispatch({ type: "SET_FIELD", field: "supabaseRef", value: e.target.value })}
          placeholder="abcdefghijklmnop"
          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
        />
      </div>
    </div>
  );
}

export { parseEnvText };
