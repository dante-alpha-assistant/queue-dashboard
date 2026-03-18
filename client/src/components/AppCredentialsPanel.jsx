import { useState, useEffect, useCallback } from "react";

const CREDENTIAL_TYPES = ["secret", "token", "key", "password", "url", "api_key"];

const COMMON_CREDENTIALS = [
  "GH_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_MGMT_TOKEN",
  "VERCEL_TOKEN",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "TURSO_AUTH_TOKEN",
  "TURSO_DATABASE_URL",
  "ANTHROPIC_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "DOPPLER_TOKEN",
  "STRIPE_SECRET_KEY",
];

const EMPTY_FORM = {
  credential_name: "",
  credential_type: "secret",
  k8s_secret_name: "",
  k8s_secret_key: "",
  description: "",
};

const TYPE_COLORS = {
  secret: { bg: "rgba(207,102,121,0.15)", color: "#CF6679" },
  token: { bg: "rgba(103,80,164,0.2)", color: "#D0BCFF" },
  key: { bg: "rgba(76,175,80,0.15)", color: "#81C784" },
  password: { bg: "rgba(255,152,0,0.15)", color: "#FFB74D" },
  url: { bg: "rgba(33,150,243,0.15)", color: "#64B5F6" },
  api_key: { bg: "rgba(0,188,212,0.15)", color: "#4DD0E1" },
};

export default function AppCredentialsPanel({ appId }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/apps/${appId}/credentials`)
      .then((r) => r.json())
      .then((data) => {
        setCredentials(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.credential_name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(`/api/apps/${appId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to add credential");
      setForm({ ...EMPTY_FORM });
      setAdding(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (credId) => {
    if (!window.confirm("Remove this credential?")) return;
    setDeletingId(credId);
    try {
      const resp = await fetch(`/api/apps/${appId}/credentials/${credId}`, {
        method: "DELETE",
      });
      if (!resp.ok) throw new Error("Failed to delete credential");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const s = {
    panel: {
      background: "var(--md-surface, #2B2930)",
      borderRadius: 12,
      padding: 20,
      marginTop: 20,
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    title: {
      margin: 0,
      fontSize: 15,
      fontWeight: 600,
      color: "var(--md-on-surface, #E6E1E5)",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    countBadge: {
      fontSize: 11,
      background: "var(--md-surface-variant, #49454F)",
      color: "var(--md-on-surface-variant, #CAC4D0)",
      borderRadius: 10,
      padding: "2px 8px",
    },
    addBtn: {
      padding: "6px 14px",
      borderRadius: 20,
      border: adding ? "1px solid #49454F" : "none",
      background: adding ? "transparent" : "var(--md-primary, #D0BCFF)",
      color: adding ? "var(--md-on-surface-variant, #CAC4D0)" : "var(--md-on-primary, #381E72)",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13,
    },
    credRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "10px 12px",
      background: "var(--md-surface-container, #1C1B1F)",
      borderRadius: 8,
      marginBottom: 8,
    },
    credContent: { flex: 1 },
    credNameRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 3 },
    credName: {
      fontFamily: "monospace",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--md-on-surface, #E6E1E5)",
    },
    k8sInfo: {
      fontSize: 12,
      color: "var(--md-on-surface-variant, #CAC4D0)",
      display: "flex",
      alignItems: "center",
      gap: 4,
    },
    k8sBadge: {
      fontFamily: "monospace",
      fontSize: 11,
      background: "rgba(103,80,164,0.2)",
      color: "#D0BCFF",
      borderRadius: 6,
      padding: "1px 6px",
    },
    descText: {
      fontSize: 12,
      color: "var(--md-on-surface-variant, #938F99)",
      marginTop: 3,
    },
    delBtn: {
      padding: "3px 10px",
      borderRadius: 12,
      border: "1px solid #CF6679",
      background: "transparent",
      color: "#CF6679",
      cursor: "pointer",
      fontSize: 12,
      flexShrink: 0,
      marginTop: 1,
    },
    formCard: {
      background: "var(--md-surface-container, #1C1B1F)",
      borderRadius: 8,
      padding: 16,
      marginTop: 8,
      border: "1px solid #49454F",
    },
    formRow: { display: "flex", gap: 10, marginBottom: 10 },
    input: {
      flex: 1,
      padding: "8px 10px",
      borderRadius: 6,
      border: "1px solid #49454F",
      background: "#2B2930",
      color: "#E6E1E5",
      fontSize: 13,
      outline: "none",
    },
    fullInput: {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 6,
      border: "1px solid #49454F",
      background: "#2B2930",
      color: "#E6E1E5",
      fontSize: 13,
      outline: "none",
      boxSizing: "border-box",
      marginBottom: 10,
    },
    select: {
      padding: "8px 10px",
      borderRadius: 6,
      border: "1px solid #49454F",
      background: "#2B2930",
      color: "#E6E1E5",
      fontSize: 13,
      outline: "none",
    },
    formActions: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end",
      marginTop: 4,
    },
    cancelBtn: {
      padding: "6px 14px",
      borderRadius: 20,
      border: "1px solid #49454F",
      background: "transparent",
      color: "#CAC4D0",
      cursor: "pointer",
      fontSize: 13,
    },
    saveBtn: {
      padding: "6px 14px",
      borderRadius: 20,
      border: "none",
      background: "#D0BCFF",
      color: "#381E72",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13,
    },
    empty: {
      textAlign: "center",
      color: "var(--md-on-surface-variant, #CAC4D0)",
      fontSize: 14,
      padding: "24px 0",
    },
    errMsg: {
      fontSize: 13,
      color: "#CF6679",
      marginBottom: 10,
      padding: "8px 10px",
      background: "rgba(207,102,121,0.1)",
      borderRadius: 6,
    },
    footer: {
      marginTop: 12,
      fontSize: 12,
      color: "var(--md-on-surface-variant, #CAC4D0)",
      borderTop: "1px solid #49454F",
      paddingTop: 10,
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
  };

  const getTypeBadge = (type) => {
    const c = TYPE_COLORS[type] || { bg: "rgba(150,150,150,0.15)", color: "#CAC4D0" };
    return (
      <span style={{ fontSize: 11, background: c.bg, color: c.color, borderRadius: 6, padding: "1px 6px" }}>
        {type}
      </span>
    );
  };

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <h3 style={s.title}>
          🔐 App Credentials
          <span style={s.countBadge}>{credentials.length}</span>
        </h3>
        <button
          style={s.addBtn}
          onClick={() => {
            setAdding((v) => !v);
            setForm({ ...EMPTY_FORM });
            setError(null);
          }}
        >
          {adding ? "✕ Cancel" : "+ Add Credential"}
        </button>
      </div>

      {error && <div style={s.errMsg}>⚠️ {error}</div>}

      {adding && (
        <form onSubmit={handleAdd} style={s.formCard}>
          <div style={s.formRow}>
            <input
              list="cred-suggestions"
              style={s.input}
              placeholder="Credential name (e.g. GH_TOKEN)"
              value={form.credential_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, credential_name: e.target.value.toUpperCase() }))
              }
              required
              autoFocus
            />
            <datalist id="cred-suggestions">
              {COMMON_CREDENTIALS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <select
              style={s.select}
              value={form.credential_type}
              onChange={(e) => setForm((f) => ({ ...f, credential_type: e.target.value }))}
            >
              {CREDENTIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div style={s.formRow}>
            <input
              style={s.input}
              placeholder="K8s secret name (e.g. dashboard-secrets)"
              value={form.k8s_secret_name}
              onChange={(e) => setForm((f) => ({ ...f, k8s_secret_name: e.target.value }))}
            />
            <input
              style={s.input}
              placeholder="K8s secret key (e.g. github-token)"
              value={form.k8s_secret_key}
              onChange={(e) => setForm((f) => ({ ...f, k8s_secret_key: e.target.value }))}
            />
          </div>
          <input
            style={s.fullInput}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div style={s.formActions}>
            <button type="button" style={s.cancelBtn} onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" style={s.saveBtn} disabled={saving}>
              {saving ? "Saving..." : "Add Credential"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={s.empty}>Loading credentials...</div>
      ) : credentials.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔑</div>
          <div>No credentials configured yet.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Add credentials to enable app-scoped secret access for agents.
          </div>
        </div>
      ) : (
        <div>
          {credentials.map((cred) => (
            <div key={cred.id} style={s.credRow}>
              <div style={s.credContent}>
                <div style={s.credNameRow}>
                  <span style={s.credName}>{cred.credential_name}</span>
                  {getTypeBadge(cred.credential_type)}
                </div>
                {cred.k8s_secret_name && (
                  <div style={s.k8sInfo}>
                    <span>k8s:</span>
                    <span style={s.k8sBadge}>
                      {cred.k8s_secret_name}/{cred.k8s_secret_key}
                    </span>
                  </div>
                )}
                {cred.description && (
                  <div style={s.descText}>{cred.description}</div>
                )}
              </div>
              <button
                style={s.delBtn}
                onClick={() => handleDelete(cred.id)}
                disabled={deletingId === cred.id}
              >
                {deletingId === cred.id ? "..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={s.footer}>
        🛡️ Credentials are app-scoped. Agents only receive credentials for the specific app
        assigned to their task.
      </div>
    </div>
  );
}
