import SpeedLoader from "../components/SpeedLoader";
import AgentDetailPanel from "../components/AgentDetailPanel";
import SkillsModal from "../components/SkillsModal";
import { StatusDotSvg, PingboardIcons, TierBadge, CapabilityTag } from "../components/PingboardIcons";
import { useState, useEffect, useCallback, useRef } from "react";

/* ─── CSS Keyframes (injected once) ─── */
const styleId = "pingboard-animations";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.6; }
    }
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    @keyframes pb-slide-in {
      from { opacity: 0; transform: translateY(20px) scale(0.95); max-height: 0; }
      to { opacity: 1; transform: translateY(0) scale(1); max-height: 400px; }
    }
    @keyframes pb-fade-out {
      from { opacity: 1; transform: scale(1); max-height: 400px; }
      to { opacity: 0; transform: scale(0.9); max-height: 0; padding: 0; margin: 0; }
    }
    @keyframes pb-pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
      50% { box-shadow: 0 0 12px 4px rgba(99, 102, 241, 0.25); }
    }
    @keyframes pb-status-flash {
      0% { background-color: rgba(99, 102, 241, 0.2); }
      100% { background-color: transparent; }
    }
    .pingboard-tooltip {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 12px;
      z-index: 100;
      pointer-events: none;
      transition: opacity 150ms, visibility 150ms;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      max-width: 320px;
      white-space: normal;
    }
    .pingboard-tooltip-trigger:hover .pingboard-tooltip {
      visibility: visible;
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

const STATUS_COLORS = {
  online: "#2E7D32",
  busy: "#E65100",
  offline: "#79747E",
  disabled: "#BA1A1A",
};

const STATUS_LABELS = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
  disabled: "Disabled",
};

const STATUS_FILTERS = ["all", "online", "busy", "offline"];

function formatUptime(seconds) {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatElapsed(isoDate) {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  if (ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function formatDuration(ms) {
  if (!ms) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

/* ─── Agent Avatar ─── */
function AgentAvatar({ agent, size = 64 }) {
  const initials = (agent.name || "?")
    .split("-")
    .map((w) => w[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#eab308", "#22c55e", "#14b8a6",
    "#06b6d4", "#3b82f6",
  ];
  const hash = (agent.name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = colors[hash % colors.length];

  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: agent.avatar ? `url(${agent.avatar}) center/cover` : bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: size * 0.35,
        letterSpacing: "0.5px", flexShrink: 0, position: "relative",
      }}
    >
      {!agent.avatar && initials}
      {agent.emoji && (
        <span style={{
          position: "absolute", bottom: -2, right: -2, fontSize: size * 0.3,
          background: "var(--md-surface-container)", borderRadius: "50%",
          padding: 2, lineHeight: 1,
        }}>
          {agent.emoji}
        </span>
      )}
    </div>
  );
}

/* ─── Capacity Bar ─── */
function CapacityBar({ load, max, style: outerStyle }) {
  if (!max || max <= 0) return null;
  const pct = Math.min((load / max) * 100, 100);
  const color = load >= max ? "#E65100" : load > 0 ? "#2E7D32" : "#79747E";
  return (
    <div style={{ width: "100%", ...outerStyle }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 10, fontWeight: 600, marginBottom: 3, color: "var(--md-on-surface-variant)",
      }}>
        <span>{load}/{max} slots</span>
        <span style={{ color }}>{load >= max ? "Full" : load > 0 ? "Active" : "Free"}</span>
      </div>
      <div style={{
        height: 4, borderRadius: 2, background: "var(--md-surface-variant)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 2, background: color,
          width: `${pct}%`, transition: "width 300ms ease",
        }} />
      </div>
    </div>
  );
}

/* ─── Current Task Preview ─── */
function CurrentTaskPreview({ tasks = [], compact = false }) {
  if (!tasks || tasks.length === 0) return (
    <div style={{
      fontSize: compact ? 10 : 11, color: "#79747E", fontStyle: "italic",
      padding: compact ? "2px 0" : "4px 0",
    }}>
      Idle
    </div>
  );

  const task = tasks[0];
  const title = task.title || "Untitled";
  const truncated = title.length > (compact ? 28 : 40) ? title.slice(0, compact ? 25 : 37) + "..." : title;
  const startTime = task.started_at || task.updated_at;
  const elapsed = startTime ? formatElapsed(startTime) : null;

  return (
    <div className="pingboard-tooltip-trigger" style={{ position: "relative", width: "100%" }}>
      <div style={{
        fontSize: compact ? 10 : 11, padding: "3px 8px", borderRadius: 6,
        background: "rgba(46, 125, 50, 0.08)", color: "#2E7D32",
        fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {PingboardIcons.wrench(compact ? 10 : 12, "#2E7D32")}
        {truncated}
      </div>
      {tasks.length > 1 && (
        <div style={{ fontSize: 9, color: "var(--md-on-surface-variant)", marginTop: 2, textAlign: "center" }}>
          +{tasks.length - 1} more task{tasks.length - 1 > 1 ? "s" : ""}
        </div>
      )}
      <div className="pingboard-tooltip">
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Status: {task.status}{elapsed ? ` · Working for ${elapsed}` : ""}
        </div>
        {tasks.length > 1 && tasks.slice(1).map(t => (
          <div key={t.id} style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontWeight: 500 }}>{t.title}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Status: {t.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Human Card (Dante) ─── */
function HumanCard({ agent, replicas, liveTasks = [] }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      borderRadius: 20, padding: 24,
      border: "2px solid #ffd700",
      boxShadow: "0 0 20px rgba(255, 215, 0, 0.15), 0 8px 32px rgba(0,0,0,0.2)",
      textAlign: "center", minWidth: 220, maxWidth: 280, position: "relative",
    }}>
      <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)" }}>
        {PingboardIcons.crown(28, "#ffd700")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
        <div style={{ position: "relative" }}>
          <AgentAvatar agent={agent} size={64} />
          <div style={{ position: "absolute", bottom: 0, right: -4 }}>
            <StatusDotSvg status={agent.status} size={14} />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#ffd700", letterSpacing: "0.5px" }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 12, color: "#e0e0e0", fontWeight: 500, marginTop: 2 }}>
            {agent.role || "Human"}
          </div>
          <div style={{
            fontSize: 10, color: "#ffd700", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "1px", marginTop: 4, opacity: 0.8,
          }}>
            {STATUS_LABELS[agent.status] || agent.status}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Manager Card ─── */
function ManagerCard({ agent, replicas, liveTasks = [] }) {
  const load = liveTasks.length || agent.current_load || 0;
  const maxCap = agent.max_capacity || 0;
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const isWorking = liveTasks.length > 0;

  return (
    <div style={{
      background: "linear-gradient(135deg, var(--md-surface-container) 0%, var(--md-surface) 100%)",
      borderRadius: 18, padding: 20,
      border: "2px solid #7c4dff",
      boxShadow: "0 0 12px rgba(124, 77, 255, 0.1), 0 6px 24px rgba(0,0,0,0.1)",
      textAlign: "center", minWidth: 200, maxWidth: 260, position: "relative",
    }}>
      <div style={{
        position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
      }}>
        <TierBadge tier="manager" size="small" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div style={{ position: "relative" }}>
          <AgentAvatar agent={agent} size={56} />
          <div style={{ position: "absolute", bottom: 0, right: -4 }}>
            <StatusDotSvg status={agent.status} size={12} isWorking={isWorking} />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--md-on-background)" }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 11, color: "#7c4dff", fontWeight: 600, marginTop: 2 }}>
            {agent.role || "Engineering Manager"}
          </div>
        </div>
        {maxCap > 0 && <CapacityBar load={load} max={maxCap} />}
        <CurrentTaskPreview tasks={liveTasks} />
        {caps.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", marginTop: 2 }}>
            {caps.slice(0, 4).map((c, i) => (
              <CapabilityTag key={i} capability={c} variant="highlight" />
            ))}
            {caps.length > 4 && (
              <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 6, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
                +{caps.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Worker Card ─── */
function WorkerCard({ agent, liveTasks = [] }) {
  const load = liveTasks.length || agent.current_load || 0;
  const maxCap = agent.max_capacity || 0;
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const statusColor = STATUS_COLORS[agent.status] || "#79747E";
  const isWorking = liveTasks.length > 0;

  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        borderRadius: 14, padding: 16,
        border: `1px solid ${isWorking ? "rgba(46, 125, 50, 0.3)" : "var(--md-surface-variant)"}`,
        borderLeft: `3px solid ${statusColor}`,
        textAlign: "center", width: 200, position: "relative", transition: "all 200ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ position: "relative" }}>
          <AgentAvatar agent={agent} size={40} />
          <div style={{ position: "absolute", bottom: -1, right: -3 }}>
            <StatusDotSvg status={agent.status} size={10} isWorking={isWorking} />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", fontWeight: 500, marginTop: 1 }}>
            {agent.role || "Worker"}
          </div>
        </div>
        {maxCap > 0 && <CapacityBar load={load} max={maxCap} />}
        <CurrentTaskPreview tasks={liveTasks} compact />
        {caps.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", marginTop: 2 }}>
            {caps.slice(0, 3).map((c, i) => (
              <CapabilityTag key={i} capability={c} />
            ))}
            {caps.length > 3 && (
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 5, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)" }}>
                +{caps.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Vertical Connector ─── */
function VerticalConnector({ height = 32, color = "var(--md-surface-variant)", dashed = false }) {
  return (
    <div style={{
      width: 0, height,
      borderLeft: `2px ${dashed ? "dashed" : "solid"} ${color}`,
      margin: "0 auto",
    }} />
  );
}

/* ─── Org Chart Tree View ─── */
function OrgChartTree({ agents, allReplicas, loading: replicasLoading, liveStatus = {} }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeAgents = agents.filter(a => a.status !== "disabled" && !a.manually_disabled);
  const agentMap = {};
  activeAgents.forEach(a => { agentMap[a.id || a.name] = a; });

  const roots = [];
  const childrenMap = {};
  activeAgents.forEach(a => {
    const id = a.id || a.name;
    const parentId = a.parent_agent;
    if (parentId && agentMap[parentId]) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(a);
    } else {
      roots.push(a);
    }
  });

  function getCardType(agent) {
    const id = agent.id || agent.name;
    const hasKids = (childrenMap[id] || []).length > 0;
    const name = (agent.name || "").toLowerCase();
    if (agent.tier === "human" || agent.tier === 0 || name === "dante") return "human";
    if (hasKids) return "manager";
    return "worker";
  }

  function renderCard(agent) {
    const type = getCardType(agent);
    const agentId = agent.id || agent.name;
    const tasks = liveStatus[agentId] || liveStatus[agent.name] || [];
    switch (type) {
      case "human": return <HumanCard agent={agent} replicas={allReplicas[agentId]} liveTasks={tasks} />;
      case "manager": return <ManagerCard agent={agent} replicas={allReplicas[agentId]} liveTasks={tasks} />;
      default: return <WorkerCard agent={agent} liveTasks={tasks} />;
    }
  }

  const sortedRoots = [...roots].sort((a, b) => {
    const typeOrder = { human: 0, manager: 1, worker: 2 };
    return (typeOrder[getCardType(a)] || 2) - (typeOrder[getCardType(b)] || 2);
  });

  function renderTree(agent, depth = 0) {
    const id = agent.id || agent.name;
    const kids = childrenMap[id] || [];
    return (
      <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {renderCard(agent)}
        {kids.length > 0 && (
          <>
            <VerticalConnector height={28} color={getCardType(agent) === "human" ? "#ffd700" : "#7c4dff"} />
            {kids.length > 1 && (
              <div style={{ display: "flex", justifyContent: "center", width: "100%", position: "relative" }}>
                <div style={{
                  position: "absolute", top: 0,
                  left: `calc(50% / ${kids.length})`,
                  right: `calc(50% / ${kids.length})`,
                  height: 0,
                  borderTop: `2px solid ${getCardType(agent) === "human" ? "#ffd70060" : "#7c4dff40"}`,
                }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "nowrap", position: "relative" }}>
              {kids.map((child) => {
                const connColor = getCardType(agent) === "human" ? "#ffd70060" : "#7c4dff40";
                return (
                  <div key={child.id || child.name} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <VerticalConnector height={20} color={connColor} />
                    {renderTree(child, depth + 1)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderMobileList() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {sortedRoots.map(root => {
          const rootId = root.id || root.name;
          const kids = childrenMap[rootId] || [];
          return (
            <div key={rootId}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: kids.length > 0 ? 12 : 0 }}>
                {renderCard(root)}
              </div>
              {kids.length > 0 && (
                <div style={{
                  marginLeft: 20, paddingLeft: 16,
                  borderLeft: `2px solid ${getCardType(root) === "human" ? "#ffd70040" : "#7c4dff30"}`,
                  display: "flex", flexDirection: "column", gap: 12,
                }}>
                  {kids.map(child => {
                    const childId = child.id || child.name;
                    const grandKids = childrenMap[childId] || [];
                    return (
                      <div key={childId}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: grandKids.length > 0 ? 12 : 0 }}>
                          {renderCard(child)}
                        </div>
                        {grandKids.length > 0 && (
                          <div style={{
                            marginLeft: 20, paddingLeft: 16,
                            borderLeft: "2px solid var(--md-surface-variant)",
                            display: "flex", flexDirection: "column", gap: 10, marginTop: 8,
                          }}>
                            {grandKids.map(gk => (
                              <div key={gk.id || gk.name} style={{ display: "flex", justifyContent: "center" }}>
                                {renderCard(gk)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (replicasLoading && Object.keys(allReplicas).length === 0) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)" }}>Loading org chart...</div>;
  }
  if (activeAgents.length === 0) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)" }}>No active agents found.</div>;
  }
  if (isMobile) return <div style={{ padding: "16px 0" }}>{renderMobileList()}</div>;

  return (
    <div style={{ overflowX: "auto", padding: "30px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "fit-content", gap: 0 }}>
        {sortedRoots.map(root => renderTree(root))}
      </div>
    </div>
  );
}

/* ─── Pipeline View ─── */
function PipelineView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/pipeline-stats?days=${days}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Failed to fetch pipeline stats:", e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchPipeline();
    const interval = setInterval(fetchPipeline, 30000);
    return () => clearInterval(interval);
  }, [fetchPipeline]);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--md-on-surface-variant)" }}>Loading pipeline...</div>;
  if (!data) return <div style={{ textAlign: "center", padding: 60, color: "var(--md-on-surface-variant)" }}>Failed to load pipeline data</div>;

  const { pipeline_state, current_by_stage, stage_durations, agent_summary, bottlenecks, agents } = data;

  const stages = [
    { key: "todo", label: "Backlog", icon: PingboardIcons.clipboard, color: "#79747E" },
    { key: "in_progress", label: "Coding", icon: PingboardIcons.wrench, color: "#2E7D32" },
    { key: "qa_testing", label: "QA Review", icon: PingboardIcons.flask, color: "#E65100" },
    { key: "completed", label: "Completed", icon: PingboardIcons.checkCircle, color: "#1565C0" },
    { key: "deployed", label: "Deployed", icon: PingboardIcons.rocket, color: "#6A1B9A" },
  ];

  const qaAgents = (agents || []).filter(a => (a.capabilities || []).includes("qa"));
  const codingAgents = (agents || []).filter(a => (a.capabilities || []).includes("coding") || (a.capabilities || []).includes("ops"));
  const totalQaSlots = qaAgents.reduce((sum, a) => sum + (a.max_capacity || 1), 0);
  const totalCodingSlots = codingAgents.reduce((sum, a) => sum + (a.max_capacity || 1), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 600 }}>Period:</span>
        {[7, 14, 30, 90].map(d => (
          <button key={d} onClick={() => { setDays(d); setLoading(true); }} style={{
            padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "none",
            background: days === d ? "var(--md-primary)" : "var(--md-surface-container)",
            color: days === d ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
            cursor: "pointer", fontFamily: "'Roboto', system-ui, sans-serif",
          }}>
            {d}d
          </button>
        ))}
      </div>

      {/* Bottleneck alerts */}
      {bottlenecks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bottlenecks.map((b, i) => (
            <div key={i} style={{
              padding: "10px 16px", borderRadius: 12,
              background: b.severity === "high" ? "rgba(186, 26, 26, 0.08)" : "rgba(230, 81, 0, 0.08)",
              border: `1px solid ${b.severity === "high" ? "rgba(186, 26, 26, 0.3)" : "rgba(230, 81, 0, 0.3)"}`,
              color: b.severity === "high" ? "#BA1A1A" : "#E65100",
              fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
            }}>
              {b.severity === "high"
                ? PingboardIcons.xCircle(16, "#BA1A1A")
                : PingboardIcons.warning(16, "#E65100")}
              {b.message}
            </div>
          ))}
        </div>
      )}

      {/* Pipeline flow diagram */}
      <div style={{
        background: "var(--md-surface-container)", borderRadius: 16, padding: 24,
        border: "1px solid var(--md-surface-variant)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--md-on-background)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          {PingboardIcons.chart(18, "var(--md-on-background)")} Task Pipeline
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
          {stages.map((stage, i) => {
            const count = pipeline_state[stage.key] || 0;
            const isBottleneck = bottlenecks.some(b => b.stage === stage.key);
            const tasks = current_by_stage[stage.key] || [];

            return (
              <div key={stage.key} style={{ display: "flex", alignItems: "center" }}>
                <div className="pingboard-tooltip-trigger" style={{
                  position: "relative",
                  minWidth: 130, padding: "16px 14px", borderRadius: 14, textAlign: "center",
                  background: isBottleneck ? `${stage.color}12` : "var(--md-surface)",
                  border: `2px solid ${isBottleneck ? "#BA1A1A" : count > 0 ? stage.color : "var(--md-surface-variant)"}`,
                  boxShadow: isBottleneck ? `0 0 12px ${stage.color}20` : "none",
                  transition: "all 200ms",
                }}>
                  <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}>
                    {stage.icon(24, stage.color)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: stage.color, marginBottom: 4 }}>
                    {stage.label}
                  </div>
                  <div style={{
                    fontSize: 28, fontWeight: 800,
                    color: count > 0 ? "var(--md-on-background)" : "var(--md-on-surface-variant)",
                    lineHeight: 1,
                  }}>
                    {count}
                  </div>
                  {isBottleneck && (
                    <div style={{
                      position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: "50%",
                      background: "#BA1A1A", color: "#fff", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>!</div>
                  )}
                  {tasks.length > 0 && (
                    <div className="pingboard-tooltip" style={{ minWidth: 240 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{stage.label} ({tasks.length})</div>
                      {tasks.slice(0, 5).map(t => (
                        <div key={t.id} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <span style={{ opacity: 0.6 }}>{t.agent || "unassigned"}</span> — {t.title?.length > 40 ? t.title.slice(0, 37) + "..." : t.title}
                        </div>
                      ))}
                      {tasks.length > 5 && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>+{tasks.length - 5} more</div>}
                    </div>
                  )}
                </div>

                {i < stages.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
                    <div style={{ width: 24, height: 0, borderTop: "2px solid var(--md-surface-variant)" }} />
                    <div style={{
                      width: 0, height: 0,
                      borderLeft: "8px solid var(--md-surface-variant)",
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(pipeline_state.blocked > 0 || pipeline_state.failed > 0) && (
          <div style={{ display: "flex", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--md-surface-variant)" }}>
            {pipeline_state.blocked > 0 && (
              <div style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(186, 26, 26, 0.06)", border: "1px solid rgba(186, 26, 26, 0.2)", fontSize: 12, fontWeight: 600, color: "#BA1A1A", display: "flex", alignItems: "center", gap: 6 }}>
                {PingboardIcons.block(14, "#BA1A1A")} {pipeline_state.blocked} blocked
              </div>
            )}
            {pipeline_state.failed > 0 && (
              <div style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(186, 26, 26, 0.06)", border: "1px solid rgba(186, 26, 26, 0.2)", fontSize: 12, fontWeight: 600, color: "#BA1A1A", display: "flex", alignItems: "center", gap: 6 }}>
                {PingboardIcons.xCircle(14, "#BA1A1A")} {pipeline_state.failed} failed
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent roles in pipeline */}
      <div style={{
        background: "var(--md-surface-container)", borderRadius: 16, padding: 24,
        border: "1px solid var(--md-surface-variant)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--md-on-background)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          {PingboardIcons.cog(18, "var(--md-on-background)")} Pipeline Roles
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260, padding: 16, borderRadius: 12, background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2E7D32", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              {PingboardIcons.wrench(14, "#2E7D32")} Coding Agents ({codingAgents.length}) — {totalCodingSlots} slots
            </div>
            {codingAgents.map(a => {
              const stats = agent_summary[a.id] || agent_summary[a.name] || {};
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--md-surface-variant)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusDotSvg status={a.status} size={8} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                    {stats.coding_tasks ? `${stats.coding_tasks} tasks · avg ${formatDuration(stats.avg_coding_ms)}` : "No tasks yet"}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
            {PingboardIcons.arrowRight(24, "var(--md-on-surface-variant)")}
          </div>

          <div style={{ flex: 1, minWidth: 260, padding: 16, borderRadius: 12, background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E65100", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              {PingboardIcons.flask(14, "#E65100")} QA Agents ({qaAgents.length}) — {totalQaSlots} slots
            </div>
            {qaAgents.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontStyle: "italic", padding: "8px 0" }}>No QA agents configured</div>
            )}
            {qaAgents.map(a => {
              const stats = agent_summary[a.id] || agent_summary[a.name] || {};
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--md-surface-variant)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusDotSvg status={a.status} size={8} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                    {stats.qa_tasks ? `${stats.qa_tasks} reviews · avg ${formatDuration(stats.avg_qa_ms)}` : "No reviews yet"}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
            {PingboardIcons.arrowRight(24, "var(--md-on-surface-variant)")}
          </div>

          <div style={{ minWidth: 140, padding: 16, borderRadius: 12, background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6A1B9A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {PingboardIcons.rocket(14, "#6A1B9A")} Deploy
            </div>
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>ArgoCD + Vercel</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{pipeline_state.deployed || 0}</div>
            <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>deployed ({days}d)</div>
          </div>
        </div>
      </div>

      {/* Flow stats */}
      <div style={{
        background: "var(--md-surface-container)", borderRadius: 16, padding: 24,
        border: "1px solid var(--md-surface-variant)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--md-on-background)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          {PingboardIcons.clock(18, "var(--md-on-background)")} Flow Statistics ({days} day window)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { label: "Avg Coding Time", value: formatDuration(stage_durations.coding.avg_ms), sub: `${stage_durations.coding.count} tasks · median ${formatDuration(stage_durations.coding.median_ms)}`, color: "#2E7D32" },
            { label: "Avg QA Time", value: formatDuration(stage_durations.qa.avg_ms), sub: `${stage_durations.qa.count} reviews · median ${formatDuration(stage_durations.qa.median_ms)}`, color: "#E65100" },
            { label: "Avg End-to-End", value: formatDuration(stage_durations.end_to_end.avg_ms), sub: `${stage_durations.end_to_end.count} tasks · median ${formatDuration(stage_durations.end_to_end.median_ms)}`, color: "#1565C0" },
          ].map((stat, i) => (
            <div key={i} style={{ padding: 16, borderRadius: 12, background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: stat.color, marginBottom: 8 }}>{stat.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--md-on-background)", marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Replica Card ─── */
function ReplicaCard({ pod, activeTasks, animState, hasActiveTasks }) {
  const podTasks = activeTasks || [];
  const statusColor = pod.ready ? "#2E7D32" : pod.status === "Running" ? "#E65100" : "#BA1A1A";
  const isWorking = hasActiveTasks || podTasks.length > 0;

  const animStyle = animState === "entering"
    ? { animation: "pb-slide-in 400ms ease-out forwards" }
    : animState === "exiting"
    ? { animation: "pb-fade-out 400ms ease-in forwards", pointerEvents: "none" }
    : animState === "status-changed"
    ? { animation: "pb-status-flash 800ms ease-out" }
    : {};

  return (
    <div style={{
      background: "var(--md-surface)", borderRadius: 12, padding: 14,
      border: "1px solid var(--md-surface-variant)", transition: "all 150ms", overflow: "hidden",
      ...(isWorking && !animState ? { animation: "pb-pulse-glow 2s ease-in-out infinite" } : {}),
      ...animStyle,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: `${statusColor}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {pod.ready
            ? PingboardIcons.check(18, statusColor)
            : PingboardIcons.warning(18, statusColor)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--md-on-background)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }} title={pod.name}>
            {pod.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
            {pod.ready ? "Ready" : pod.status || "Unknown"}
            {pod.restarts > 0 && ` · ${pod.restarts} restart${pod.restarts !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px",
        fontSize: 12, color: "var(--md-on-surface-variant)",
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>Uptime</div>
          <div style={{ fontWeight: 500, color: "var(--md-on-background)" }}>{formatUptime(pod.uptime)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>Node</div>
          <div style={{ fontWeight: 500, color: "var(--md-on-background)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pod.node}>
            {pod.node || "—"}
          </div>
        </div>
        {(pod.resources?.requests?.cpu || pod.resources?.limits?.cpu) && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>CPU</div>
            <div style={{ fontWeight: 500, color: "var(--md-on-background)" }}>{pod.resources.requests?.cpu || "—"} / {pod.resources.limits?.cpu || "—"}</div>
          </div>
        )}
        {(pod.resources?.requests?.memory || pod.resources?.limits?.memory) && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2, opacity: 0.7 }}>Memory</div>
            <div style={{ fontWeight: 500, color: "var(--md-on-background)" }}>{pod.resources.requests?.memory || "—"} / {pod.resources.limits?.memory || "—"}</div>
          </div>
        )}
      </div>

      {podTasks.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--md-surface-variant)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, opacity: 0.7, color: "var(--md-on-surface-variant)" }}>Active Tasks</div>
          {podTasks.map((t) => (
            <div key={t.id} style={{
              fontSize: 12, padding: "4px 8px", borderRadius: 6,
              background: "var(--md-surface-container)", marginBottom: 4,
              color: "var(--md-on-background)", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
            }} title={t.title}>
              <span style={{ opacity: 0.6 }}>{t.type || "task"}</span> · {t.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Agent Tile (Grid View) ─── */
function AgentTile({ agent, isSelected, onClick, liveTasks = [] }) {
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const load = liveTasks.length || agent.current_load || 0;
  const maxCap = agent.max_capacity || 0;
  const statusColor = STATUS_COLORS[agent.status] || "#79747E";
  const isWorking = liveTasks.length > 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--md-surface-container)",
        borderRadius: 16, padding: 20, cursor: "pointer",
        border: isSelected ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
        transition: "all 200ms ease", textAlign: "center",
        position: "relative", minHeight: 160,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.border = "1px solid var(--md-primary)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.border = "1px solid var(--md-surface-variant)";
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <StatusDotSvg status={agent.status} size={10} isWorking={isWorking} />
      </div>

      {load > 0 && (
        <div style={{
          position: "absolute", top: 10, left: 12,
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
          background: "var(--md-primary-container)", color: "var(--md-on-primary-container)",
        }}>
          {load} task{load !== 1 ? "s" : ""}
        </div>
      )}

      <AgentAvatar agent={agent} size={56} />

      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--md-on-background)", marginBottom: 2 }}>
          {agent.name}
        </div>
        {agent.role && (
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 500, marginBottom: 2 }}>
            {agent.role}
          </div>
        )}
        <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {STATUS_LABELS[agent.status] || agent.status}
        </div>
      </div>

      {maxCap > 0 && <CapacityBar load={load} max={maxCap} style={{ marginTop: 4 }} />}
      <CurrentTaskPreview tasks={liveTasks} compact />

      {caps.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 4 }}>
          {caps.slice(0, 3).map((c, i) => (
            <CapabilityTag key={i} capability={c} />
          ))}
          {caps.length > 3 && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
              +{caps.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Pingboard Component ─── */
export default function Pingboard() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [viewMode, setViewMode] = useState("orgchart");
  const [allReplicas, setAllReplicas] = useState({});
  const [allReplicasLoading, setAllReplicasLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState({});
  const [replicas, setReplicas] = useState(null);
  const [replicasLoading, setReplicasLoading] = useState(false);
  const prevPodsRef = useRef([]);
  const [animatingPods, setAnimatingPods] = useState(new Map());
  const exitingPodsRef = useRef([]);
  const [skillsOpen, setSkillsOpen] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/agents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : data.agents || []);
      }
    } catch (e) {
      console.error("Failed to fetch agents:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchReplicas = useCallback(async (agentName) => {
    setReplicasLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentName}/replicas`);
      if (res.ok) {
        const data = await res.json();
        const prevPods = prevPodsRef.current;
        const newPods = data.pods || [];
        const prevNames = new Set(prevPods.map(p => p.name));
        const newNames = new Set(newPods.map(p => p.name));
        const newAnims = new Map();

        for (const pod of newPods) {
          if (!prevNames.has(pod.name) && prevPods.length > 0) newAnims.set(pod.name, "entering");
        }
        for (const pod of newPods) {
          if (prevNames.has(pod.name) && !newAnims.has(pod.name)) {
            const prev = prevPods.find(p => p.name === pod.name);
            if (prev && (prev.ready !== pod.ready || prev.status !== pod.status)) newAnims.set(pod.name, "status-changed");
          }
        }
        const exiting = [];
        for (const pod of prevPods) {
          if (!newNames.has(pod.name)) { exiting.push({ ...pod, _exiting: true }); newAnims.set(pod.name, "exiting"); }
        }
        exitingPodsRef.current = exiting;
        setAnimatingPods(newAnims);
        setReplicas(data);
        prevPodsRef.current = newPods;
        if (newAnims.size > 0) setTimeout(() => { exitingPodsRef.current = []; setAnimatingPods(new Map()); }, 450);
      }
    } catch (e) {
      console.error("Failed to fetch replicas:", e);
      setReplicas({ agent: agentName, pods: [], activeTasks: [] });
    } finally {
      setReplicasLoading(false);
    }
  }, []);

  const fetchAllReplicas = useCallback(async () => {
    setAllReplicasLoading(true);
    try {
      const res = await fetch("/api/agents/all-replicas");
      if (res.ok) setAllReplicas(await res.json());
    } catch (e) {
      console.error("Failed to fetch all replicas:", e);
    } finally {
      setAllReplicasLoading(false);
    }
  }, []);

  const fetchLiveStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/live-status");
      if (res.ok) setLiveStatus(await res.json());
    } catch (e) {
      console.error("Failed to fetch live status:", e);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchLiveStatus();
    const interval = setInterval(fetchAgents, 10000);
    const liveInterval = setInterval(fetchLiveStatus, 30000);
    return () => { clearInterval(interval); clearInterval(liveInterval); };
  }, [fetchAgents, fetchLiveStatus]);

  useEffect(() => {
    if (viewMode === "orgchart") {
      fetchAllReplicas();
      const interval = setInterval(fetchAllReplicas, 15000);
      return () => clearInterval(interval);
    }
  }, [viewMode, fetchAllReplicas]);

  useEffect(() => {
    if (selectedAgent && viewMode === "grid") {
      prevPodsRef.current = [];
      exitingPodsRef.current = [];
      setAnimatingPods(new Map());
      fetchReplicas(selectedAgent.name || selectedAgent.id);
      const interval = setInterval(() => fetchReplicas(selectedAgent.name || selectedAgent.id), 12000);
      return () => clearInterval(interval);
    } else {
      setReplicas(null);
      prevPodsRef.current = [];
    }
  }, [selectedAgent, fetchReplicas, viewMode]);

  const filtered = agents.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      const caps = Array.isArray(a.capabilities) ? a.capabilities.join(" ") : "";
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        caps.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectAgent = (agent) => {
    setSelectedAgent(selectedAgent?.name === agent.name ? null : agent);
  };

  if (loading) return <SpeedLoader text="Loading agents..." />;

  const statusCounts = agents.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      minHeight: "100vh", background: "var(--md-background)",
      fontFamily: "'Roboto', system-ui, sans-serif", color: "var(--md-on-background)",
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--md-on-background)", display: "flex", alignItems: "center", gap: 10 }}>
              {PingboardIcons.robot(24, "var(--md-on-background)")} Agent Pingboard
            </div>
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", fontWeight: 400, marginTop: 4 }}>
              {agents.length} agent{agents.length !== 1 ? "s" : ""} registered
              {statusCounts.online ? ` · ${statusCounts.online} online` : ""}
              {statusCounts.busy ? ` · ${statusCounts.busy} busy` : ""}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setSkillsOpen(true)}
              style={{
                padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                border: "1px solid var(--md-surface-variant)",
                background: "var(--md-surface)", color: "var(--md-on-surface-variant)",
                cursor: "pointer", fontFamily: "'Roboto', system-ui, sans-serif",
                transition: "all 150ms", display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--md-primary-container)"; e.currentTarget.style.color = "var(--md-on-primary-container)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--md-surface)"; e.currentTarget.style.color = "var(--md-on-surface-variant)"; }}
            >
              {PingboardIcons.skills(14, "currentColor")} Skills
            </button>
            <div style={{ display: "flex", gap: 4, background: "var(--md-surface-container)", borderRadius: 12, padding: 3 }}>
              {[
                { key: "orgchart", label: "Org Chart", icon: PingboardIcons.orgChart },
                { key: "pipeline", label: "Pipeline", icon: PingboardIcons.pipeline },
                { key: "grid", label: "Grid", icon: PingboardIcons.grid },
              ].map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => { setViewMode(mode.key); setSelectedAgent(null); }}
                  style={{
                    padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: "none",
                    background: viewMode === mode.key ? "var(--md-primary)" : "transparent",
                    color: viewMode === mode.key ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
                    cursor: "pointer", fontFamily: "'Roboto', system-ui, sans-serif",
                    transition: "all 150ms", display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {mode.icon(14, viewMode === mode.key ? "var(--md-on-primary)" : "var(--md-on-surface-variant)")}
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center",
        }}>
          {STATUS_FILTERS.map((s) => {
            const isActive = statusFilter === s;
            const count = s === "all" ? agents.length : statusCounts[s] || 0;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                  border: isActive ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
                  background: isActive ? "var(--md-primary-container)" : "var(--md-surface)",
                  color: isActive ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
                  cursor: "pointer", textTransform: "capitalize",
                  fontFamily: "'Roboto', system-ui, sans-serif", transition: "all 150ms",
                }}
              >
                {s === "all" ? "All" : s}{" "}
                <span style={{ opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
              {PingboardIcons.search(14, "var(--md-on-surface-variant)")}
            </div>
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 16px 8px 32px", borderRadius: 12, fontSize: 13,
                border: "1px solid var(--md-surface-variant)",
                background: "var(--md-surface)", color: "var(--md-on-background)",
                fontFamily: "'Roboto', system-ui, sans-serif", outline: "none", width: 240,
              }}
            />
          </div>
        </div>

        {/* View content */}
        {viewMode === "orgchart" ? (
          <OrgChartTree agents={filtered} allReplicas={allReplicas} loading={allReplicasLoading} liveStatus={liveStatus} />
        ) : viewMode === "pipeline" ? (
          <PipelineView />
        ) : (
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--md-on-surface-variant)", padding: 60, fontSize: 14 }}>
                  No agents found
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: selectedAgent
                    ? "repeat(auto-fill, minmax(180px, 1fr))"
                    : "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16, transition: "all 200ms",
                }}>
                  {filtered.map((agent) => (
                    <AgentTile
                      key={agent.name}
                      agent={agent}
                      isSelected={selectedAgent?.name === agent.name}
                      onClick={() => handleSelectAgent(agent)}
                      liveTasks={liveStatus[agent.id || agent.name] || liveStatus[agent.name] || []}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedAgent && (
              <div style={{
                width: 420, flexShrink: 0,
                background: "var(--md-surface-container)", borderRadius: 16,
                border: "1px solid var(--md-surface-variant)", padding: 20,
                alignSelf: "flex-start", position: "sticky", top: 66,
                maxHeight: "calc(100vh - 90px)", overflowY: "auto",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <AgentAvatar agent={selectedAgent} size={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--md-on-background)" }}>
                      {selectedAgent.name}
                    </div>
                    <div style={{ fontSize: 12, color: STATUS_COLORS[selectedAgent.status], fontWeight: 600 }}>
                      {STATUS_LABELS[selectedAgent.status] || selectedAgent.status}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAgent(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
                  >
                    {PingboardIcons.close(18, "var(--md-on-surface-variant)")}
                  </button>
                </div>

                {selectedAgent.role && (
                  <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 500, marginBottom: 4 }}>
                    {selectedAgent.role}
                  </div>
                )}
                {selectedAgent.description && (
                  <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginBottom: 16, lineHeight: 1.5 }}>
                    {selectedAgent.description}
                  </div>
                )}

                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "12px 20px", marginBottom: 16, paddingBottom: 16,
                  borderBottom: "1px solid var(--md-surface-variant)",
                }}>
                  {selectedAgent.tier && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>Tier</div>
                      <TierBadge tier={selectedAgent.tier} size="small" />
                    </div>
                  )}
                  {selectedAgent.max_capacity != null && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>Capacity</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-background)" }}>
                        {selectedAgent.current_load || 0} / {selectedAgent.max_capacity}
                      </div>
                    </div>
                  )}
                  {selectedAgent.parent_agent && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>Parent</div>
                      <div style={{ fontSize: 13, color: "var(--md-on-background)" }}>{selectedAgent.parent_agent}</div>
                    </div>
                  )}
                </div>

                {Array.isArray(selectedAgent.capabilities) && selectedAgent.capabilities.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>Capabilities</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {selectedAgent.capabilities.map((c, i) => (
                        <CapabilityTag key={i} capability={c} />
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(selectedAgent.skills) && selectedAgent.skills.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      {PingboardIcons.skills(10, "var(--md-on-surface-variant)")} Skills
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {selectedAgent.skills.map((s, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: "var(--md-primary-container)", color: "var(--md-on-primary-container)", fontWeight: 500 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{
                    fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                    color: "var(--md-on-surface-variant)", marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      Pod Replicas
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%", background: "#2E7D32",
                        display: "inline-block", animation: "pb-pulse-glow 2s ease-in-out infinite",
                      }} title="Auto-refreshing every 12s" />
                    </span>
                    {replicas && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: "var(--md-primary-container)", color: "var(--md-on-primary-container)",
                      }}>
                        {replicas.pods.length}
                      </span>
                    )}
                  </div>

                  {replicasLoading && !replicas ? (
                    <div style={{ textAlign: "center", padding: 20, color: "var(--md-on-surface-variant)", fontSize: 13 }}>Loading replicas...</div>
                  ) : replicas && (replicas.pods.length > 0 || exitingPodsRef.current.length > 0) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[...replicas.pods, ...exitingPodsRef.current].map((pod) => (
                        <ReplicaCard
                          key={pod.name}
                          pod={pod}
                          activeTasks={replicas.activeTasks}
                          animState={animatingPods.get(pod.name) || null}
                          hasActiveTasks={(replicas.activeTasks || []).some(t => t.assigned_agent === (selectedAgent?.name || selectedAgent?.id))}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      textAlign: "center", padding: 20, color: "var(--md-on-surface-variant)",
                      fontSize: 13, background: "var(--md-surface)", borderRadius: 12,
                      border: "1px dashed var(--md-surface-variant)",
                    }}>
                      No K8s pods found for this agent.
                      <br />
                      <span style={{ fontSize: 11, opacity: 0.7 }}>Agent may not be K8s-deployed.</span>
                    </div>
                  )}
                </div>

                {selectedAgent.metrics &&
                  (selectedAgent.metrics.success_rate != null || selectedAgent.metrics.avg_completion_time != null) && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--md-surface-variant)" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>Performance</div>
                      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                        {selectedAgent.metrics.success_rate != null && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {PingboardIcons.checkCircle(14, "#2E7D32")} {Math.round(selectedAgent.metrics.success_rate * 100)}% success
                          </span>
                        )}
                        {selectedAgent.metrics.avg_completion_time != null && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {PingboardIcons.clock(14, "var(--md-on-surface-variant)")} {selectedAgent.metrics.avg_completion_time}s avg
                          </span>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
      <SkillsModal open={skillsOpen} onClose={() => setSkillsOpen(false)} />
    </div>
  );
}
