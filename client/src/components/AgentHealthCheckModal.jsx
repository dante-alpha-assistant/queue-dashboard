import { useState, useEffect, useCallback } from "react";
import { authedFetch } from "../lib/api.js";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ArrowRight, Wifi, WifiOff, Clock } from "lucide-react";

function formatHeartbeatAge(seconds) {
  if (seconds == null) return "—";
  const mins = Math.floor(seconds / 60);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

export default function AgentHealthCheckModal({ onDismiss }) {
  const [phase, setPhase] = useState("loading"); // loading | success | failure
  const [results, setResults] = useState(null);
  const [failedAgents, setFailedAgents] = useState([]);
  const [successCountdown, setSuccessCountdown] = useState(3);

  const runCheck = useCallback(async () => {
    setPhase("loading");
    setResults(null);
    setFailedAgents([]);

    try {
      const res = await authedFetch("/api/agents/health-checks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const allResults = Object.values(data);
      const failed = allResults.filter(r => r.hasIssue);

      setResults(data);
      setFailedAgents(failed);

      if (failed.length === 0) {
        setPhase("success");
      } else {
        setPhase("failure");
      }
    } catch (e) {
      console.error("Health check failed:", e);
      setPhase("failure");
      setFailedAgents([{ name: "Connection Error", error: e.message, hasIssue: true, reachable: false }]);
    }
  }, []);

  // Run on mount
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // Auto-dismiss countdown on success
  useEffect(() => {
    if (phase !== "success") return;
    setSuccessCountdown(3);
    const interval = setInterval(() => {
      setSuccessCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, onDismiss]);

  // Backdrop + modal container
  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>
        {/* Modal card */}
        <div style={{
          background: "var(--md-surface-container)",
          borderRadius: 20,
          padding: "32px 36px",
          width: "100%",
          maxWidth: 520,
          border: "1px solid var(--md-surface-variant)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
          animation: "healthModalIn 220ms ease-out forwards",
        }}>
          <style>{`
            @keyframes healthModalIn {
              from { opacity: 0; transform: translateY(16px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes healthSpinAnim {
              to { transform: rotate(360deg); }
            }
            .health-spin { animation: healthSpinAnim 1s linear infinite; }
          `}</style>

          {/* ── LOADING PHASE ── */}
          {phase === "loading" && (
            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <Loader2 size={40} color="var(--md-primary)" className="health-spin" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--md-on-background)", marginBottom: 8 }}>
                Checking Agent Health
              </div>
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
                Running health probes on all registered agents in parallel…
              </div>
              <div style={{ marginTop: 24 }}>
                <button onClick={onDismiss} style={{
                  padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: "1px solid var(--md-surface-variant)",
                  background: "var(--md-surface)", color: "var(--md-on-surface-variant)",
                  cursor: "pointer",
                }}>
                  Skip →
                </button>
              </div>
            </div>
          )}

          {/* ── SUCCESS PHASE ── */}
          {phase === "success" && (
            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(46,125,50,0.12)", border: "2px solid rgba(46,125,50,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <CheckCircle2 size={32} color="#2E7D32" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--md-on-background)", marginBottom: 8 }}>
                All Agents Healthy ✓
              </div>
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6, marginBottom: 20 }}>
                {results ? `${Object.values(results).length} agent${Object.values(results).length !== 1 ? "s" : ""} checked — no issues detected.` : "All agents are reachable and operational."}
              </div>
              <div style={{
                padding: "10px 16px", borderRadius: 12,
                background: "rgba(46,125,50,0.08)", border: "1px solid rgba(46,125,50,0.25)",
                fontSize: 13, color: "#2E7D32", fontWeight: 600, marginBottom: 20,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <CheckCircle2 size={14} />
                Continuing in {successCountdown}s…
              </div>
              <button onClick={onDismiss} style={{
                padding: "10px 28px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "var(--md-primary)", color: "var(--md-on-primary)",
                border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 8,
              }}>
                Continue to Dashboard <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* ── FAILURE PHASE ── */}
          {phase === "failure" && (
            <div style={{ padding: "0 0 8px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(186,26,26,0.1)", border: "2px solid rgba(186,26,26,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <AlertTriangle size={24} color="#BA1A1A" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--md-on-background)" }}>
                    {failedAgents.length} Agent{failedAgents.length !== 1 ? "s" : ""} Unreachable
                  </div>
                  <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
                    Some agents failed their health check. Review below.
                  </div>
                </div>
              </div>

              {/* Failed agents list */}
              <div style={{
                maxHeight: 280, overflowY: "auto",
                display: "flex", flexDirection: "column", gap: 8,
                marginBottom: 20,
                paddingRight: 4,
              }}>
                {failedAgents.map((agent, i) => (
                  <div key={agent.name || i} style={{
                    padding: "12px 14px", borderRadius: 12,
                    background: "var(--md-surface)",
                    border: "1px solid rgba(186,26,26,0.25)",
                    borderLeft: "3px solid #BA1A1A",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--md-on-background)" }}>
                        {agent.name}
                      </div>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 8,
                        background: agent.reachable === false ? "rgba(186,26,26,0.1)" : "rgba(230,81,0,0.1)",
                        color: agent.reachable === false ? "#BA1A1A" : "#E65100",
                        fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                        flexShrink: 0,
                      }}>
                        {agent.reachable === false ? (
                          <><WifiOff size={9} /> unreachable</>
                        ) : (
                          <><Wifi size={9} /> {agent.error || "issue"}</>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                      {agent.statusCode && (
                        <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                          HTTP {agent.statusCode}
                        </span>
                      )}
                      {agent.latencyMs != null && (
                        <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                          {agent.latencyMs}ms
                        </span>
                      )}
                      {agent.lastHeartbeatAge != null && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                          <Clock size={10} /> last hb: {formatHeartbeatAge(agent.lastHeartbeatAge)}
                        </span>
                      )}
                      {agent.error && (
                        <span style={{ fontSize: 11, color: "#BA1A1A", fontFamily: "'JetBrains Mono', monospace" }}>
                          {agent.error}
                        </span>
                      )}
                    </div>
                    {agent.status && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                        Registered status: <strong>{agent.status}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={runCheck} style={{
                  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: "1px solid var(--md-surface-variant)",
                  background: "var(--md-surface)", color: "var(--md-on-surface-variant)",
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <RefreshCw size={13} /> Retry
                </button>
                <button onClick={onDismiss} style={{
                  padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: "var(--md-primary)", color: "var(--md-on-primary)",
                  border: "none", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  Continue Anyway <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
