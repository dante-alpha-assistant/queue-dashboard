import { useState, useEffect } from "react";
import { Bot, Puzzle } from 'lucide-react';

const TABS = [
  { key: "matrix", label: "Skills Matrix", Icon: Puzzle },
  { key: "agents", label: "Per Agent", Icon: Bot },
];

function AgentAvatar({ agent, size = 32 }) {
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
        flexShrink: 0,
      }}
    >
      {!agent.avatar && initials}
    </div>
  );
}

function MatrixView({ skills, agents }) {
  // Only show agents that have at least one skill
  const agentsWithSkills = agents.filter(a => (a.skills || []).length > 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{
        borderCollapse: "collapse", width: "100%", fontSize: 13,
        fontFamily: "'Roboto', system-ui, sans-serif",
      }}>
        <thead>
          <tr>
            <th style={{
              padding: "10px 14px", textAlign: "left", position: "sticky", left: 0,
              background: "var(--md-surface-container)", zIndex: 2,
              borderBottom: "2px solid var(--md-surface-variant)",
              fontSize: 12, fontWeight: 700, color: "var(--md-on-surface-variant)",
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              Skill
            </th>
            {agentsWithSkills.map(agent => (
              <th key={agent.id} style={{
                padding: "10px 8px", textAlign: "center",
                borderBottom: "2px solid var(--md-surface-variant)",
                minWidth: 70,
              }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <AgentAvatar agent={agent} size={28} />
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: "var(--md-on-background)",
                    maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {agent.name}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skills.map(skill => {
            const agentCount = agentsWithSkills.filter(a => (a.skills || []).includes(skill.name)).length;
            return (
              <tr key={skill.name} style={{ borderBottom: "1px solid var(--md-surface-variant)" }}>
                <td style={{
                  padding: "10px 14px", position: "sticky", left: 0,
                  background: "var(--md-surface-container)", zIndex: 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--md-on-background)" }}>
                        {skill.name}
                      </div>
                      {skill.description && (
                        <div style={{
                          fontSize: 11, color: "var(--md-on-surface-variant)",
                          maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }} title={skill.description}>
                          {skill.description}
                        </div>
                      )}
                    </div>
                    {skill.github_url && (
                      <a
                        href={skill.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "var(--md-primary)", textDecoration: "none", flexShrink: 0 }}
                        title="View on GitHub"
                      >
                        📄
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", opacity: 0.6, marginTop: 2 }}>
                    {agentCount} agent{agentCount !== 1 ? "s" : ""}
                  </div>
                </td>
                {agentsWithSkills.map(agent => {
                  const has = (agent.skills || []).includes(skill.name);
                  return (
                    <td key={agent.id} style={{ padding: "10px 8px", textAlign: "center" }}>
                      {has ? (
                        <span style={{
                          display: "inline-block", width: 24, height: 24, borderRadius: "50%",
                          background: "rgba(46,125,50,0.12)", color: "#2E7D32",
                          lineHeight: "24px", fontSize: 14,
                        }}>
                          ✓
                        </span>
                      ) : (
                        <span style={{ color: "var(--md-surface-variant)", fontSize: 16 }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PerAgentView({ skills, agents }) {
  const [expandedAgent, setExpandedAgent] = useState(null);
  const skillMap = {};
  skills.forEach(s => { skillMap[s.name] = s; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {agents.map(agent => {
        const agentSkills = (agent.skills || []);
        const isExpanded = expandedAgent === agent.id;
        return (
          <div
            key={agent.id}
            style={{
              background: "var(--md-surface)",
              borderRadius: 12,
              border: "1px solid var(--md-surface-variant)",
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
              style={{
                padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer",
                transition: "background 150ms",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <AgentAvatar agent={agent} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--md-on-background)" }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                  {agentSkills.length} skill{agentSkills.length !== 1 ? "s" : ""}
                  {Array.isArray(agent.capabilities) && agent.capabilities.length > 0 && (
                    <span> · {agent.capabilities.join(", ")}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 200 }}>
                {agentSkills.slice(0, 4).map(s => (
                  <span key={s} style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 8,
                    background: "var(--md-primary-container)",
                    color: "var(--md-on-primary-container)",
                    fontWeight: 500,
                  }}>
                    {s}
                  </span>
                ))}
                {agentSkills.length > 4 && (
                  <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>
                    +{agentSkills.length - 4}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10, transition: "transform 200ms",
                transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                color: "var(--md-on-surface-variant)",
              }}>▼</span>
            </div>

            {isExpanded && agentSkills.length > 0 && (
              <div style={{
                padding: "0 16px 14px",
                borderTop: "1px solid var(--md-surface-variant)",
              }}>
                {agentSkills.map(skillName => {
                  const meta = skillMap[skillName];
                  return (
                    <div key={skillName} style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--md-surface-variant)",
                      display: "flex", alignItems: "flex-start", gap: 10,
                    }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}><Puzzle size={14} /></span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>
                          {skillName}
                        </div>
                        {meta?.description && (
                          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 2, lineHeight: 1.4 }}>
                            {meta.description}
                          </div>
                        )}
                      </div>
                      {meta?.github_url && (
                        <a
                          href={meta.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11, color: "var(--md-primary)", textDecoration: "none",
                            padding: "4px 10px", borderRadius: 8,
                            background: "var(--md-primary-container)",
                            fontWeight: 500, whiteSpace: "nowrap",
                          }}
                        >
                          View SKILL.md →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isExpanded && agentSkills.length === 0 && (
              <div style={{
                padding: "16px", textAlign: "center",
                color: "var(--md-on-surface-variant)", fontSize: 13,
                borderTop: "1px solid var(--md-surface-variant)",
              }}>
                No skills installed
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SkillsModal({ open, onClose }) {
  const [tab, setTab] = useState("matrix");
  const [skills, setSkills] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/skills")
      .then(r => r.json())
      .then(data => {
        setSkills(data.skills || []);
        setAgents(data.agents || []);
      })
      .catch(e => console.error("Failed to fetch skills:", e))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--md-surface-container)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 900,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--md-on-background)" }}>
              <Puzzle size={14} /> Agent Skills
            </h2>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 4 }}>
              {skills.length} skill{skills.length !== 1 ? "s" : ""} across {agents.filter(a => (a.skills || []).length > 0).length} agents
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "var(--md-on-surface-variant)", padding: 8,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, padding: "16px 24px 0",
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: tab === t.key ? "var(--md-primary)" : "var(--md-surface)",
                color: tab === t.key ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
                fontFamily: "'Roboto', system-ui, sans-serif",
                transition: "all 150ms",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)" }}>
              Loading skills...
            </div>
          ) : tab === "matrix" ? (
            <MatrixView skills={skills} agents={agents} />
          ) : (
            <PerAgentView skills={skills} agents={agents} />
          )}
        </div>
      </div>
    </div>
  );
}
