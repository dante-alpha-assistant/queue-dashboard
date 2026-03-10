import { useState, useMemo } from "react";

export default function BatchDeployModal({ tasks, onDeploy, onClose }) {
  const [selected, setSelected] = useState(() => new Set(
    tasks.filter(t => Array.isArray(t.pull_request_url) ? t.pull_request_url[0] : t.pull_request_url).map(t => t.id)
  ));
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);

  const deployable = useMemo(() => tasks.filter(t => Array.isArray(t.pull_request_url) ? t.pull_request_url[0] : t.pull_request_url), [tasks]);
  const noPR = useMemo(() => tasks.filter(t => !t.pull_request_url), [tasks]);

  // Group selected by repo
  const byRepo = useMemo(() => {
    const map = {};
    for (const t of deployable.filter(t => selected.has(t.id))) {
      const match = ((Array.isArray(t.pull_request_url) ? t.pull_request_url[0] : t.pull_request_url) || '').match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      const repo = match ? match[1] : "unknown";
      const pr = match ? `#${match[2]}` : t.pull_request_url;
      if (!map[repo]) map[repo] = [];
      map[repo].push({ ...t, pr });
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

  const handleDeploy = async () => {
    if (selected.size === 0) return;
    setDeploying(true);
    setError(null);
    try {
      const res = await fetch("/api/deploy/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deploy failed");
      onDeploy(data);
    } catch (e) {
      setError(e.message);
      setDeploying(false);
    }
  };

  const handleDryRun = async () => {
    if (selected.size === 0) return;
    setDryRunning(true);
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
      setDryRunning(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-surface, #fff)", borderRadius: 16, padding: 24,
        minWidth: 480, maxWidth: 640, maxHeight: "80vh", overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-background, #1C1B1F)" }}>
            🚀 Batch Deploy
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 18, cursor: "pointer",
            color: "var(--md-outline, #79747E)", padding: 4,
          }}>✕</button>
        </div>

        {/* Repo summary */}
        {Object.keys(byRepo).length > 0 && (
          <div style={{
            background: "var(--md-surface-container, #F3EDF7)", borderRadius: 10, padding: 12,
            marginBottom: 16, fontSize: 12,
          }}>
            {Object.entries(byRepo).map(([repo, tasks]) => (
              <div key={repo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{repo.split("/")[1]}</span>
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
            const match = ((Array.isArray(t.pull_request_url) ? t.pull_request_url[0] : t.pull_request_url) || '').match(/\/pull\/(\d+)/);
            return (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                borderRadius: 8, cursor: "pointer",
                background: selected.has(t.id) ? "var(--md-primary-container, #EADDFF)" : "var(--md-surface-container, #F3EDF7)",
                border: `1px solid ${selected.has(t.id) ? "var(--md-primary, #6750A4)" : "transparent"}`,
                transition: "all 0.15s",
              }}>
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{t.title}</span>
                {match && <span style={{ fontSize: 10, color: "var(--md-outline)", fontFamily: "monospace" }}>#{match[1]}</span>}
              </label>
            );
          })}

          {noPR.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--md-outline)", marginTop: 8, textTransform: "uppercase" }}>
                No PR (cannot deploy)
              </div>
              {noPR.map(t => (
                <div key={t.id} style={{
                  padding: "8px 10px", borderRadius: 8, fontSize: 12, opacity: 0.5,
                  background: "var(--md-surface-container, #F3EDF7)",
                }}>
                  {t.title} <span style={{ fontSize: 10, color: "var(--md-error, #B3261E)" }}>— no PR</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Dry run result */}
        {dryRunResult && (
          <div style={{
            background: dryRunResult.error ? "#B3261E14" : "#1B5E2014",
            borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11,
            border: `1px solid ${dryRunResult.error ? "#B3261E40" : "#1B5E2040"}`,
          }}>
            {dryRunResult.error ? (
              <span style={{ color: "#B3261E" }}>❌ {dryRunResult.error}</span>
            ) : (
              <span style={{ color: "#1B5E20" }}>✅ All {dryRunResult.mergeable} PRs can be merged cleanly</span>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#B3261E14", borderRadius: 8, padding: 10, marginBottom: 12,
            fontSize: 11, color: "#B3261E", border: "1px solid #B3261E40",
          }}>
            ❌ {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={deploying} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--md-outline, #79747E)",
            background: "transparent", color: "var(--md-on-background)", fontSize: 12,
            fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={handleDryRun} disabled={selected.size === 0 || dryRunning || deploying} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "var(--md-surface-variant, #E7E0EC)", color: "var(--md-on-surface-variant, #49454F)",
            fontSize: 12, fontWeight: 600, cursor: selected.size === 0 ? "not-allowed" : "pointer",
          }}>
            {dryRunning ? "Checking..." : "🔍 Dry Run"}
          </button>
          <button onClick={handleDeploy} disabled={selected.size === 0 || deploying} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: selected.size === 0 || deploying ? "#79747E" : "#1B5E20",
            color: "#fff", fontSize: 12, fontWeight: 600,
            cursor: selected.size === 0 || deploying ? "not-allowed" : "pointer",
          }}>
            {deploying ? "Deploying..." : `🚀 Deploy ${selected.size} task${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
