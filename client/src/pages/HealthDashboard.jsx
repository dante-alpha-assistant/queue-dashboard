import { useState, useEffect, useCallback } from "react";
import { Bot, HeartPulse, CheckCircle2, Clock, Package, RefreshCw, Wrench, XCircle } from 'lucide-react';

const API = "/api/health";

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function HealthBadge({ level, score }) {
  const colors = { green: "#16a34a", yellow: "#ca8a04", red: "#dc2626" };
  const bg = { green: "#dcfce7", yellow: "#fef9c3", red: "#fee2e2" };
  const labels = { green: "Healthy", yellow: "Degraded", red: "Unhealthy" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
      background: bg[level], borderRadius: 12, border: `1px solid ${colors[level]}30`,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: colors[level], color: "#fff", fontSize: 22, fontWeight: 800,
      }}>{score}</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: colors[level] }}>{labels[level]}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Pipeline Health Score</div>
      </div>
    </div>
  );
}

function SummaryCards({ summary }) {
  const cards = [
    { label: "Online Agents", value: `${summary.online_agents}/${summary.total_agents}`, icon: "🤖", color: summary.online_agents === summary.total_agents ? "#16a34a" : "#ca8a04" },
    { label: "Stuck Tasks", value: summary.stuck_count, icon: "⏰", color: summary.stuck_count === 0 ? "#16a34a" : "#dc2626" },
    { label: "Failed (24h)", value: summary.failed_24h_count, icon: "❌", color: summary.failed_24h_count === 0 ? "#16a34a" : "#dc2626" },
    { label: "Merge Queue", value: summary.merge_pending, icon: "🔀", color: summary.merge_pending === 0 ? "#16a34a" : "#ca8a04" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          padding: "14px 16px", background: "var(--md-surface)", borderRadius: 10,
          border: "1px solid var(--md-surface-variant)",
        }}>
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {c.icon} {c.label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function StuckTasksList({ tasks }) {
  if (!tasks.length) return (
    <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
      <CheckCircle2 size={14} /> No stuck tasks
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tasks.map(t => (
        <div key={t.id} style={{
          padding: "10px 14px", background: "var(--md-surface)", borderRadius: 8,
          border: "1px solid var(--md-surface-variant)", display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
            background: t.minutes_in_status > 60 ? "#fee2e2" : "#fef9c3",
            color: t.minutes_in_status > 60 ? "#dc2626" : "#ca8a04",
            whiteSpace: "nowrap",
          }}>{formatDuration(t.minutes_in_status)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
              {t.stuck_reason} {t.assigned_agent && `· ${t.assigned_agent}`}
            </div>
          </div>
          <span style={{
            padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
            background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)",
          }}>{t.status}</span>
        </div>
      ))}
    </div>
  );
}

function AgentHealthList({ agents }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {agents.map(a => {
        const statusColor = a.status === "online" ? "#16a34a" : a.status === "busy" ? "#ca8a04" : "#9ca3af";
        return (
          <div key={a.id} style={{
            padding: "10px 14px", background: "var(--md-surface)", borderRadius: 8,
            border: "1px solid var(--md-surface-variant)", display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name || a.id}</span>
                {a.heartbeat_stale && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>⚠ stale heartbeat</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
                {(a.capabilities || []).join(", ") || "no capabilities"}
                {a.last_heartbeat && ` · HB ${a.heartbeat_age_min}m ago`}
              </div>
              {a.active_tasks.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--md-primary)", marginTop: 3 }}>
                  <Wrench size={14} /> {a.active_tasks.map(t => t.title).join(", ")}
                </div>
              )}
            </div>
            <div style={{
              padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
              background: `${statusColor}20`, color: statusColor,
            }}>{a.status}</div>
          </div>
        );
      })}
    </div>
  );
}

function MergeQueuePanel({ mergeQueue, total }) {
  const repos = Object.keys(mergeQueue);
  if (!repos.length) return (
    <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
      <CheckCircle2 size={14} /> No PRs waiting to merge
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {repos.map(repo => (
        <div key={repo}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface-variant)", marginBottom: 4 }}>
            <Package size={14} /> {repo} ({mergeQueue[repo].length})
          </div>
          {mergeQueue[repo].map(item => (
            <div key={item.id} style={{
              padding: "8px 12px", background: "var(--md-surface)", borderRadius: 6,
              border: "1px solid var(--md-surface-variant)", marginBottom: 4, fontSize: 12,
            }}>
              <span style={{ fontWeight: 600 }}>{item.title}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FailedTasksList({ tasks }) {
  if (!tasks.length) return (
    <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
      <CheckCircle2 size={14} /> No failures in the last 24h
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tasks.slice(0, 10).map(t => (
        <div key={t.id} style={{
          padding: "10px 14px", background: "var(--md-surface)", borderRadius: 8,
          border: "1px solid #fecaca",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>{t.title}</div>
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
            {t.error ? (typeof t.error === "string" ? t.error.slice(0, 120) : JSON.stringify(t.error).slice(0, 120)) : "No error message"}
          </div>
          <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
            {t.assigned_agent && `${t.assigned_agent} · `}{new Date(t.updated_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HealthDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--md-on-surface-variant)" }}>
      Loading health data...
    </div>
  );

  if (error && !data) return (
    <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
      <XCircle size={14} /> Failed to load health data: {error}
      <br />
      <button onClick={fetchHealth} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--md-surface-variant)", cursor: "pointer", background: "var(--md-surface)" }}>
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--md-on-surface)" }}><HeartPulse size={20} /> Pipeline Health</h2>
          {lastRefresh && (
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
              Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
        <button onClick={fetchHealth} style={{
          padding: "6px 14px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
          background: "var(--md-surface)", cursor: "pointer", fontSize: 12, fontWeight: 600,
          color: "var(--md-on-surface-variant)",
        }}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Health Score + Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, marginBottom: 20, alignItems: "start" }}>
        <HealthBadge level={data.health_level} score={data.health_score} />
        <SummaryCards summary={data.summary} />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Stuck Tasks */}
        <Section title="Stuck Tasks" icon={<Clock size={16} />} count={data.stuck_tasks.length} alert={data.stuck_tasks.length > 0}>
          <StuckTasksList tasks={data.stuck_tasks} />
        </Section>

        {/* Agent Health */}
        <Section title="Agent Health" icon={<Bot size={16} />} count={data.agent_health.length}>
          <AgentHealthList agents={data.agent_health} />
        </Section>

        {/* Failed Tasks (24h) */}
        <Section title="Failures (24h)" icon={<XCircle size={16} />} count={data.failed_24h.length} alert={data.failed_24h.length > 0}>
          <FailedTasksList tasks={data.failed_24h} />
        </Section>

        {/* Merge Queue */}
        <Section title="🔀 Merge Queue" count={data.merge_queue_total}>
          <MergeQueuePanel mergeQueue={data.merge_queue} total={data.merge_queue_total} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, count, alert, children }) {
  return (
    <div style={{
      background: "var(--md-background)", borderRadius: 12,
      border: `1px solid ${alert ? "#fecaca" : "var(--md-surface-variant)"}`,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: alert ? "#fef2f210" : "transparent",
      }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        {count !== undefined && (
          <span style={{
            padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
            background: alert ? "#fee2e2" : "var(--md-surface-variant)",
            color: alert ? "#dc2626" : "var(--md-on-surface-variant)",
          }}>{count}</span>
        )}
      </div>
      <div style={{ padding: 10, maxHeight: 400, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}
