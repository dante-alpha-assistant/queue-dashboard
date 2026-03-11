import { useState, useMemo, useCallback } from "react";

export default function BatchDeployModal({ tasks, onDeploy, onClose }) {
  const getPr = (t) => Array.isArray(t.pull_request_url) ? t.pull_request_url[0] : t.pull_request_url;

  const deployable = useMemo(() => tasks.filter(t => getPr(t)), [tasks]);
  const noPR = useMemo(() => tasks.filter(t => !getPr(t)), [tasks]);

  const [selected, setSelected] = useState(() => new Set(deployable.map(t => t.id)));
  const [dryRunResult, setDryRunResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    setSelected(selected.size === deployable.length ? new Set() : new Set(deployable.map(t => t.id)));
  };

  const handleDryRun = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setDryRunResult(null);
    try {
      const res = await fetch("/api/deploy/batch/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [...selected] }),
      });
      setDryRunResult(await res.json());
    } catch (e) {
      setDryRunResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const handleDeploy = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading(true);
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
        setLoading(false);
        return;
      }
      onDeploy(data);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [selected, onDeploy]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--md-surface, #fff)", borderRadius: 16, padding: 24,
        minWidth: 500, maxWidth: 640, maxHeight: "85vh", overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        border: "1px solid var(--md-surface-variant, #E7E0EC)",
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🚀 Batch Deploy</h2>
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
              <div key={repo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>{repo}</span>
                <span style={{ color: "var(--md-outline)" }}>
                  {tasks.length} PR{tasks.length > 1 ? "s" : ""}: {tasks.map(t => t.pr).join(", ")}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Select all */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8, color: "var(--md-on-surface-variant)" }}>
          <input type="checkbox" checked={selected.size === deployable.length && deployable.length > 0} onChange={toggleAll} />
          Select all ({deployable.length})
        </label>

        {/* Task list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {deployable.map(t => {
            const prUrl = getPr(t);
            const prNum = prUrl?.match(/\/pull\/(\d+)/)?.[1];
            const dr = dryRunResult?.results?.find(r => r.id === t.id);
            return (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                borderRadius: 8, cursor: "pointer",
                background: selected.has(t.id) ? "var(--md-primary-container, #EADDFF)" : "var(--md-surface-container, #F3EDF7)",
                border: `1px solid ${dr?.mergeable === false ? "#B3261E40" : selected.has(t.id) ? "var(--md-primary, #6750A4)" : "transparent"}`,
              }}>
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{t.title}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {prNum && <span style={{ fontSize: 10, color: "var(--md-outline)", fontFamily: "monospace" }}>#{prNum}</span>}
                  {dr && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: dr.mergeable ? "#1B5E20" : "#B3261E" }}>
                      {dr.mergeable ? "✓" : "✗ " + (dr.reason || "conflict")}
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
                <div key={t.id} style={{ padding: "8px 10px", borderRadius: 8, fontSize: 12, opacity: 0.5, background: "var(--md-surface-container)" }}>
                  {t.title}
                </div>
              ))}
            </>
          )}
        </div>

        {error && (
          <div style={{
            background: "#B3261E14", borderRadius: 8, padding: 10, marginBottom: 12,
            fontSize: 12, color: "#B3261E", border: "1px solid #B3261E40",
          }}>❌ {error}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8,
            border: "1px solid var(--md-outline, #79747E)",
            background: "transparent",
            color: "var(--md-on-surface-variant, #52525B)",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            lineHeight: "1.2",
          }}>Cancel</button>
          <button onClick={handleDryRun} disabled={selected.size === 0 || loading} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "var(--md-surface-variant, #E7E0EC)",
            color: "var(--md-on-surface-variant, #52525B)",
            fontSize: 12, fontWeight: 600,
            lineHeight: "1.2",
            cursor: selected.size === 0 || loading ? "not-allowed" : "pointer",
            opacity: selected.size === 0 || loading ? 0.5 : 1,
          }}>{loading ? "Checking…" : "🔍 Dry Run"}</button>
          <button onClick={handleDeploy} disabled={selected.size === 0 || loading} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: selected.size === 0 || loading ? "#79747E" : "#1B5E20",
            color: "#fff", fontSize: 12, fontWeight: 600,
            lineHeight: "1.2",
            cursor: selected.size === 0 || loading ? "not-allowed" : "pointer",
          }}>🚀 Deploy {selected.size} task{selected.size !== 1 ? "s" : ""}</button>
        </div>
      </div>
    </div>
  );
}
