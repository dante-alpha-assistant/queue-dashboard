import { useState, useEffect, useMemo, useCallback } from "react";

export default function BatchDeployModal({ tasks, onDeploy, onClose }) {
  const [selected, setSelected] = useState(() => new Set(
    tasks.filter(t => {
      const pr = Array.isArray(t.pull_request_url) ? t.pull_request_url[0] : t.pull_request_url;
      return !!pr;
    }).map(t => t.id)
  ));
  const [phase, setPhase] = useState("select"); // select | dryrun | deploying | done | error
  const [error, setError] = useState(null);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [deployTaskId, setDeployTaskId] = useState(null);
  const [deployStatus, setDeployStatus] = useState(null);
  const [activityLog, setActivityLog] = useState([]);

  const getPr = (t) => Array.isArray(t.pull_request_url) ? t.pull_request_url[0] : t.pull_request_url;

  const deployable = useMemo(() => tasks.filter(t => getPr(t)), [tasks]);
  const noPR = useMemo(() => tasks.filter(t => !getPr(t)), [tasks]);

  // Group selected by repo
  const byRepo = useMemo(() => {
    const map = {};
    for (const t of deployable.filter(t => selected.has(t.id))) {
      const prUrl = getPr(t);
      const match = prUrl?.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      const repo = match ? match[1].split("/")[1] : "unknown";
      const pr = match ? `#${match[2]}` : prUrl;
      if (!map[repo]) map[repo] = [];
      map[repo].push({ ...t, pr, prUrl });
    }
    return map;
  }, [deployable, selected]);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === deployable.length) setSelected(new Set());
    else setSelected(new Set(deployable.map(t => t.id)));
  };

  // Poll deploy task status when deploying
  useEffect(() => {
    if (phase !== "deploying" || !deployTaskId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tasks/${deployTaskId}`);
        if (!res.ok) return;
        const task = await res.json();
        setDeployStatus(task.status);
        if (task.status === "completed" || task.status === "deployed") {
          setPhase("done");
          onDeploy({ deployTaskId, status: task.status });
        } else if (task.status === "failed" || task.status === "deploy_failed") {
          setError(task.error || "Deploy failed");
          setPhase("error");
        }
        // Fetch activity log
        const logRes = await fetch(`/api/tasks/${deployTaskId}/activity`);
        if (logRes.ok) {
          const logs = await logRes.json();
          if (Array.isArray(logs)) setActivityLog(logs.slice(-10));
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [phase, deployTaskId]);

  const handleDryRun = useCallback(async () => {
    if (selected.size === 0) return;
    setPhase("dryrun");
    setDryRunResult(null);
    try {
      const res = await fetch("/api/deploy/batch/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [...selected] }),
      });
      const data = await res.json();
      setDryRunResult(data);
    } catch (e) {
      setDryRunResult({ error: e.message });
    } finally {
      setPhase("select");
    }
  }, [selected]);

  const handleDeploy = useCallback(async () => {
    if (selected.size === 0) return;
    setPhase("deploying");
    setError(null);
    try {
      const res = await fetch("/api/deploy/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Deploy failed");
        setPhase("error");
        return;
      }
      setDeployTaskId(data.deployTask?.id);
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  }, [selected]);

  const phaseLabels = {
    select: "Select tasks to deploy",
    dryrun: "Checking PR compatibility...",
    deploying: "Deploying...",
    done: "Deploy complete!",
    error: "Deploy failed",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
    }} onClick={phase === "deploying" ? undefined : onClose}>
      <div style={{
        background: "var(--md-surface, #fff)", borderRadius: 16, padding: 24,
        minWidth: 500, maxWidth: 640, maxHeight: "85vh", overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-background, #1C1B1F)" }}>
              🚀 Batch Deploy
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--md-outline, #79747E)" }}>
              {phaseLabels[phase]}
            </p>
          </div>
          {phase !== "deploying" && (
            <button onClick={onClose} style={{
              background: "none", border: "none", fontSize: 18, cursor: "pointer",
              color: "var(--md-outline, #79747E)", padding: 4,
            }}>✕</button>
          )}
        </div>

        {/* Deploying progress */}
        {phase === "deploying" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              background: "var(--md-primary-container, #EADDFF)", borderRadius: 10, padding: 16,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                border: "3px solid var(--md-primary, #6750A4)",
                borderTopColor: "transparent",
                animation: "spin 1s linear infinite",
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {deployStatus === "in_progress" ? "Agent is merging PRs..." : "Waiting for agent pickup..."}
                </div>
                <div style={{ fontSize: 11, color: "var(--md-outline)" }}>
                  Task ID: {deployTaskId?.slice(0, 8)}
                </div>
              </div>
            </div>
            {activityLog.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                {activityLog.map((log, i) => (
                  <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)" }}>
                    {log.field}: {log.old_value} → {log.new_value}
                  </div>
                ))}
              </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div style={{
            background: "#1B5E2014", borderRadius: 10, padding: 16, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
            border: "1px solid #1B5E2040",
          }}>
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1B5E20" }}>All tasks deployed successfully</div>
              <div style={{ fontSize: 11, color: "var(--md-outline)" }}>Tasks have been moved to the Deployed column.</div>
            </div>
          </div>
        )}

        {/* Select phase */}
        {(phase === "select" || phase === "dryrun") && (
          <>
            {/* Repo summary */}
            {Object.keys(byRepo).length > 0 && (
              <div style={{
                background: "var(--md-surface-container, #F3EDF7)", borderRadius: 10, padding: 12,
                marginBottom: 16, fontSize: 12,
              }}>
                {Object.entries(byRepo).map(([repo, tasks]) => (
                  <div key={repo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{repo}</span>
                    <span style={{ color: "var(--md-outline, #79747E)" }}>
                      {tasks.length} PR{tasks.length > 1 ? "s" : ""}: {tasks.map(t => t.pr).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Select all */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--md-on-surface-variant, #49454F)" }}>
                <input type="checkbox" checked={selected.size === deployable.length && deployable.length > 0} onChange={toggleAll} />
                Select all ({deployable.length})
              </label>
            </div>

            {/* Task list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {deployable.map(t => {
                const prUrl = getPr(t);
                const match = prUrl?.match(/\/pull\/(\d+)/);
                const drResult = dryRunResult?.results?.find(r => r.id === t.id);
                return (
                  <label key={t.id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    borderRadius: 8, cursor: "pointer",
                    background: selected.has(t.id) ? "var(--md-primary-container, #EADDFF)" : "var(--md-surface-container, #F3EDF7)",
                    border: `1px solid ${drResult?.mergeable === false ? "#B3261E40" : selected.has(t.id) ? "var(--md-primary, #6750A4)" : "transparent"}`,
                    transition: "all 0.15s",
                  }}>
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{t.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {match && <span style={{ fontSize: 10, color: "var(--md-outline)", fontFamily: "monospace" }}>#{match[1]}</span>}
                      {drResult && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: drResult.mergeable ? "#1B5E20" : "#B3261E" }}>
                          {drResult.mergeable ? "✓" : "✗ " + (drResult.reason || "conflict")}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}

              {noPR.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--md-outline)", marginTop: 8, textTransform: "uppercase" }}>
                    No PR — cannot deploy ({noPR.length})
                  </div>
                  {noPR.map(t => (
                    <div key={t.id} style={{
                      padding: "8px 10px", borderRadius: 8, fontSize: 12, opacity: 0.5,
                      background: "var(--md-surface-container, #F3EDF7)",
                    }}>
                      {t.title}
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* Error */}
        {(error || phase === "error") && (
          <div style={{
            background: "#B3261E14", borderRadius: 8, padding: 10, marginBottom: 12,
            fontSize: 12, color: "#B3261E", border: "1px solid #B3261E40",
          }}>
            ❌ {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {phase === "done" ? (
            <button onClick={onClose} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "#1B5E20", color: "#fff", fontSize: 12,
              fontWeight: 600, cursor: "pointer",
            }}>Done</button>
          ) : phase === "deploying" ? (
            <button disabled style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)",
              fontSize: 12, fontWeight: 600, cursor: "wait",
            }}>Deploying... do not close</button>
          ) : (
            <>
              <button onClick={onClose} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid var(--md-outline, #79747E)",
                background: "transparent", color: "var(--md-on-background)", fontSize: 12,
                fontWeight: 600, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handleDryRun} disabled={selected.size === 0 || phase === "dryrun"} style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "var(--md-surface-variant, #E7E0EC)", color: "var(--md-on-surface-variant, #49454F)",
                fontSize: 12, fontWeight: 600, cursor: selected.size === 0 ? "not-allowed" : "pointer",
              }}>
                {phase === "dryrun" ? "Checking..." : "🔍 Dry Run"}
              </button>
              <button onClick={handleDeploy} disabled={selected.size === 0} style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: selected.size === 0 ? "#79747E" : "#1B5E20",
                color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: selected.size === 0 ? "not-allowed" : "pointer",
              }}>
                🚀 Deploy {selected.size} task{selected.size !== 1 ? "s" : ""}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
