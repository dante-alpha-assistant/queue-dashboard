import { authedFetch } from "../lib/api.js";
import { useState, useEffect } from "react";
import { Settings, Zap, Hand, Info, Database, KeyRound, RotateCcw, CheckCircle, AlertCircle, Gauge, Lock, Users } from "lucide-react";

const DEPLOYMENT_RULES = [
  {
    type: "app-factory",
    deployMode: "auto",
    trigger: "On completion",
    notes: "App-factory tasks auto-deploy when status reaches completed",
    color: "#16a34a",
  },
  {
    type: "coding",
    deployMode: "manual",
    trigger: "Manual deploy",
    notes: "Requires human review and manual deploy action",
    color: "#ca8a04",
  },
  {
    type: "ops",
    deployMode: "manual",
    trigger: "Manual deploy",
    notes: "Operational tasks require manual review before deployment",
    color: "#ca8a04",
  },
  {
    type: "research",
    deployMode: "manual",
    trigger: "Manual deploy",
    notes: "Research tasks do not typically have deployable artifacts",
    color: "#ca8a04",
  },
  {
    type: "qa",
    deployMode: "manual",
    trigger: "Manual deploy",
    notes: "QA tasks validate deployments but do not trigger new ones",
    color: "#ca8a04",
  },
  {
    type: "general",
    deployMode: "manual",
    trigger: "Manual deploy",
    notes: "General tasks require manual review",
    color: "#ca8a04",
  },
];

function DeployBadge({ mode, color }) {
  const isAuto = mode === "auto";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: `${color}20`,
      color: color,
      border: `1px solid ${color}40`,
    }}>
      {isAuto ? <Zap size={11} /> : <Hand size={11} />}
      {isAuto ? "Auto" : "Manual"}
    </span>
  );
}

function TokenRotationSection() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [taskId, setTaskId] = useState(null);

  const handleDeploy = async () => {
    if (!token.trim()) return;
    setStatus("loading");
    setMessage("");
    setTaskId(null);
    try {
      const resp = await authedFetch("/api/settings/rotate-claude-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Request failed");
      setStatus("success");
      setTaskId(data.taskId);
      setMessage(data.message);
      setToken("");
    } catch (e) {
      setStatus("error");
      setMessage(e.message);
    }
  };

  return (
    <div style={{
      background: "var(--md-surface)",
      borderRadius: 16,
      border: "1px solid var(--md-surface-variant)",
      overflow: "hidden",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <KeyRound size={16} style={{ color: "var(--md-primary)" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>🔐 Claude OAuth Token Rotation</div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 1 }}>
            Dispatch a setup task to rotate the Anthropic token across all agents via GitOps
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px" }}>
        {/* Info note */}
        <div style={{
          background: "rgba(103,80,164,0.08)",
          border: "1px solid rgba(103,80,164,0.2)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--md-on-surface-variant)",
          marginBottom: 18,
          lineHeight: 1.5,
        }}>
          This will dispatch a <code style={{ background: "var(--md-surface-variant)", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>setup</code> task
          to <strong>setup-agent</strong>, which will rotate the Anthropic OAuth token across
          all agents that use it: <strong>neo</strong>, <strong>neo-worker</strong>, <strong>ifra-worker</strong>, <strong>neo-chat-worker</strong>, <strong>research-worker</strong>, and <strong>setup-agent</strong> via GitOps sealed secrets.
        </div>

        {/* Input */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--md-on-surface-variant)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            New Claude OAuth Token
          </label>
          <input
            type="password"
            value={token}
            onChange={e => { setToken(e.target.value); if (status !== "idle") setStatus("idle"); }}
            placeholder="sk-ant-oat01-..."
            disabled={status === "loading"}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--md-surface-variant)",
              background: "var(--md-background)",
              color: "var(--md-on-surface)",
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              outline: "none",
              boxSizing: "border-box",
              opacity: status === "loading" ? 0.6 : 1,
            }}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleDeploy}
          disabled={status === "loading" || !token.trim()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: (status === "loading" || !token.trim()) ? "var(--md-surface-variant)" : "var(--md-primary)",
            color: (status === "loading" || !token.trim()) ? "var(--md-on-surface-variant)" : "var(--md-on-primary)",
            fontWeight: 600,
            fontSize: 13,
            cursor: (status === "loading" || !token.trim()) ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          <RotateCcw size={14} style={{ animation: status === "loading" ? "spin 1s linear infinite" : "none" }} />
          {status === "loading" ? "Dispatching..." : "Deploy Claude OAuth Token"}
        </button>

        {/* Status message */}
        {status === "success" && (
          <div style={{
            marginTop: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(22,163,74,0.1)",
            border: "1px solid rgba(22,163,74,0.25)",
            color: "#16a34a",
            fontSize: 13,
          }}>
            <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{message}</div>
              {taskId && (
                <div style={{ fontSize: 11, marginTop: 3, opacity: 0.8, fontFamily: "'JetBrains Mono', monospace" }}>
                  Task ID: {taskId}
                </div>
              )}
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{
            marginTop: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(220,38,38,0.1)",
            border: "1px solid rgba(220,38,38,0.25)",
            color: "#dc2626",
            fontSize: 13,
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontWeight: 500 }}>{message}</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ConcurrencyLimitsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalLimit, setGlobalLimit] = useState(2);
  const [agentLimits, setAgentLimits] = useState({});
  const [agentUsage, setAgentUsage] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState(null); // { type: "success"|"error", message }

  useEffect(() => {
    authedFetch("/api/settings/concurrency")
      .then(r => r.json())
      .then(data => {
        setGlobalLimit(data.global_user_concurrency_limit ?? 2);
        setAgentLimits(data.agent_user_concurrency_limits ?? {});
        setAgentUsage(data.agent_usage ?? {});
        setIsAdmin(data.is_admin ?? false);
        setLoading(false);
      })
      .catch(e => {
        setToast({ type: "error", message: "Failed to load concurrency config: " + e.message });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      const resp = await authedFetch("/api/settings/concurrency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          global_user_concurrency_limit: globalLimit,
          agent_user_concurrency_limits: agentLimits,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Request failed");
      setToast({ type: "success", message: data.message || "Concurrency limits saved!" });
    } catch (e) {
      setToast({ type: "error", message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const agentNames = Object.keys(agentLimits);

  const formatUsage = (agent) => {
    const usage = agentUsage[agent] || {};
    const entries = Object.entries(usage);
    if (entries.length === 0) return "—";
    return entries.map(([user, count]) => {
      const display = user.length > 20 ? user.slice(0, 8) + "…" : user;
      return `${display}: ${count}`;
    }).join(", ");
  };

  return (
    <div style={{
      background: "var(--md-surface)",
      borderRadius: 16,
      border: "1px solid var(--md-surface-variant)",
      overflow: "hidden",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Gauge size={16} style={{ color: "var(--md-primary)" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>🔒 Agent Concurrency Limits</div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 1 }}>
            Configure how many tasks each user can run concurrently per agent
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--md-on-surface-variant)", fontSize: 13 }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid var(--md-primary)", borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }} />
            Loading concurrency config…
          </div>
        ) : (
          <>
            {/* Global Limit */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 600,
                color: "var(--md-on-surface-variant)",
                textTransform: "uppercase", letterSpacing: "0.5px",
                marginBottom: 8,
              }}>
                <Users size={13} />
                Global User Concurrency Limit
                {!isAdmin && <Lock size={12} style={{ marginLeft: 4, opacity: 0.6 }} />}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={globalLimit}
                disabled={!isAdmin}
                onChange={e => setGlobalLimit(Number(e.target.value))}
                style={{
                  width: 100,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--md-surface-variant)",
                  background: isAdmin ? "var(--md-background)" : "var(--md-surface-variant)",
                  color: "var(--md-on-surface)",
                  fontSize: 14,
                  fontWeight: 600,
                  outline: "none",
                  opacity: isAdmin ? 1 : 0.7,
                  cursor: isAdmin ? "auto" : "not-allowed",
                }}
              />
              <span style={{ marginLeft: 10, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
                tasks per user across all agents
              </span>
            </div>

            {/* Per-agent table */}
            {agentNames.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: "var(--md-on-surface-variant)",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                  marginBottom: 10,
                }}>
                  Per-Agent Limits
                  {!isAdmin && <Lock size={12} style={{ marginLeft: 6, opacity: 0.6 }} />}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--md-surface-variant)" }}>
                        {["Agent", "Limit per User", "Current Usage"].map(h => (
                          <th key={h} style={{
                            padding: "8px 14px",
                            textAlign: "left",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            color: "var(--md-on-surface-variant)",
                            whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agentNames.map((agent, i) => (
                        <tr key={agent} style={{
                          borderBottom: i < agentNames.length - 1
                            ? "1px solid var(--md-surface-variant)"
                            : "none",
                        }}>
                          <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>
                            {agent}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={agentLimits[agent] ?? 1}
                              disabled={!isAdmin}
                              onChange={e => setAgentLimits(prev => ({ ...prev, [agent]: Number(e.target.value) }))}
                              style={{
                                width: 70,
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: "1px solid var(--md-surface-variant)",
                                background: isAdmin ? "var(--md-background)" : "var(--md-surface-variant)",
                                color: "var(--md-on-surface)",
                                fontSize: 13,
                                fontWeight: 600,
                                outline: "none",
                                opacity: isAdmin ? 1 : 0.7,
                                cursor: isAdmin ? "auto" : "not-allowed",
                              }}
                            />
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--md-on-surface-variant)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatUsage(agent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Save button (admin only) */}
            {isAdmin && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: saving ? "var(--md-surface-variant)" : "var(--md-primary)",
                  color: saving ? "var(--md-on-surface-variant)" : "var(--md-on-primary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: saving ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                  marginBottom: toast ? 14 : 0,
                }}
              >
                <Gauge size={14} style={{ animation: saving ? "spin 1s linear infinite" : "none" }} />
                {saving ? "Saving…" : "Save Concurrency Limits"}
              </button>
            )}

            {/* Toast */}
            {toast && (
              <div style={{
                marginTop: isAdmin ? 14 : 0,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                background: toast.type === "success" ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
                border: `1px solid ${toast.type === "success" ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
                color: toast.type === "success" ? "#16a34a" : "#dc2626",
                fontSize: 13,
              }}>
                {toast.type === "success"
                  ? <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                }
                <span style={{ fontWeight: 500 }}>{toast.message}</span>
              </div>
            )}

            {!isAdmin && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--md-on-surface-variant)",
                marginTop: 4,
                opacity: 0.7,
              }}>
                <Lock size={12} />
                Read-only — only admins can modify concurrency limits
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      background: "var(--md-background)",
      minHeight: "100vh",
      padding: "24px",
      color: "var(--md-on-surface)",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Settings size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Settings</h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
              System configuration and deployment rules
            </p>
          </div>
        </div>

        {/* Deployment Rules Section */}
        <div style={{
          background: "var(--md-surface)",
          borderRadius: 16,
          border: "1px solid var(--md-surface-variant)",
          overflow: "hidden",
          marginBottom: 20,
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--md-surface-variant)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <Zap size={16} style={{ color: "var(--md-primary)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Deployment Rules</div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 1 }}>
                Auto-deploy conditions per task type
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}>
              <thead>
                <tr style={{ background: "var(--md-surface-variant)" }}>
                  {["Task Type", "Deploy Mode", "Trigger", "Notes"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--md-on-surface-variant)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEPLOYMENT_RULES.map((rule, i) => (
                  <tr key={rule.type} style={{
                    borderBottom: i < DEPLOYMENT_RULES.length - 1
                      ? "1px solid var(--md-surface-variant)"
                      : "none",
                  }}>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 600,
                        color: rule.color,
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: rule.color, flexShrink: 0,
                        }} />
                        {rule.type}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <DeployBadge mode={rule.deployMode} color={rule.color} />
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "var(--md-on-surface)" }}>
                      {rule.trigger}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--md-on-surface-variant)", fontSize: 12 }}>
                      {rule.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <TokenRotationSection />

        <ConcurrencyLimitsSection />

        {/* Future notice */}
        <div style={{
          background: "var(--md-surface)",
          borderRadius: 12,
          border: "1px solid var(--md-surface-variant)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(103,80,164,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, marginTop: 1,
          }}>
            <Database size={16} style={{ color: "var(--md-primary)" }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>Roadmap: Editable Rules</div>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.5 }}>
              In a future release, these deployment rules will be editable and persisted in a{" "}
              <code style={{
                background: "var(--md-surface-variant)", padding: "1px 5px",
                borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>deployment_rules</code>{" "}
              database table. Each rule will support custom conditions, approval workflows, and per-agent overrides.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
