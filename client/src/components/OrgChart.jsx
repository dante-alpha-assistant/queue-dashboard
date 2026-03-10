import { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2 } from 'lucide-react';

const STATUS_COLORS = {
  online: "#2E7D32",
  busy: "#E65100",
  offline: "#79747E",
  disabled: "#BA1A1A",
};

const TIER_CONFIG = {
  leader: { width: 220, avatarSize: 56, fontSize: 15, padding: "18px 22px", borderWidth: 2 },
  manager: { width: 190, avatarSize: 48, fontSize: 13, padding: "14px 18px", borderWidth: 2 },
  worker: { width: 160, avatarSize: 38, fontSize: 12, padding: "10px 14px", borderWidth: 1 },
};

function getTierConfig(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG.worker;
}

function NodeAvatar({ node, size = 40 }) {
  const initials = (node.name || "?")
    .split("-")
    .map((w) => w[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#eab308", "#22c55e", "#14b8a6",
    "#06b6d4", "#3b82f6",
  ];
  const hash = (node.name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = colors[hash % colors.length];

  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: node.avatar ? `url(${node.avatar}) center/cover` : bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: size * 0.35,
        flexShrink: 0, position: "relative",
      }}
    >
      {!node.avatar && initials}
      {node.emoji && (
        <span style={{
          position: "absolute", bottom: -2, right: -2,
          fontSize: size * 0.3, background: "var(--md-surface-container)",
          borderRadius: "50%", padding: 2, lineHeight: 1,
        }}>
          {node.emoji}
        </span>
      )}
    </div>
  );
}

function OrgNode({ node, onSelect, selectedId, collapsed, toggleCollapse, isMobile }) {
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = collapsed[node.id];
  const isSelected = selectedId === node.id;
  const load = node.current_load || 0;
  const statusColor = STATUS_COLORS[node.status] || "#79747E";
  const tier = node.tier || "worker";
  const tc = getTierConfig(tier);
  const childrenRef = useRef(null);
  const [hBarStyle, setHBarStyle] = useState(null);

  // Calculate horizontal connector bar after render
  useEffect(() => {
    if (!hasChildren || isCollapsed || !childrenRef.current || isMobile) {
      setHBarStyle(null);
      return;
    }
    const measure = () => {
      const cols = childrenRef.current.querySelectorAll(':scope > .org-child-col');
      if (cols.length < 2) { setHBarStyle(null); return; }
      const containerRect = childrenRef.current.getBoundingClientRect();
      const firstRect = cols[0].getBoundingClientRect();
      const lastRect = cols[cols.length - 1].getBoundingClientRect();
      const left = firstRect.left + firstRect.width / 2 - containerRect.left;
      const right = lastRect.left + lastRect.width / 2 - containerRect.left;
      setHBarStyle({ left, width: right - left });
    };
    // Measure after a frame so children have rendered
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [hasChildren, isCollapsed, isMobile, node.children?.length]);

  const tierGlow = tier === "leader"
    ? "0 0 20px rgba(99,102,241,0.15)"
    : tier === "manager"
      ? "0 0 12px rgba(139,92,246,0.1)"
      : "none";

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative",
    }}>
      {/* Card */}
      <div
        data-card="true"
        onClick={() => onSelect(node)}
        style={{
          background: "var(--md-surface-container)", borderRadius: tier === "leader" ? 18 : 14,
          padding: tc.padding, cursor: "pointer",
          border: isSelected
            ? "2px solid var(--md-primary)"
            : tc.borderWidth + "px solid var(--md-surface-variant)",
          width: tc.width, textAlign: "center", position: "relative",
          transition: "all 150ms ease",
          boxShadow: isSelected
            ? "0 6px 24px rgba(0,0,0,0.15), " + tierGlow
            : "0 1px 4px rgba(0,0,0,0.06), " + tierGlow,
          zIndex: 1,
        }}
      >
        {/* Status dot */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: tier === "leader" ? 12 : 10, height: tier === "leader" ? 12 : 10,
          borderRadius: "50%",
          background: statusColor, border: "2px solid var(--md-surface-container)",
        }} />
        {/* Load badge */}
        {load > 0 && (
          <div style={{
            position: "absolute", top: 8, left: 10,
            fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 8,
            background: "var(--md-primary-container)", color: "var(--md-on-primary-container)",
          }}>{load}</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: tier === "leader" ? 8 : 6 }}>
          <NodeAvatar node={node} size={tc.avatarSize} />
          <div style={{
            fontWeight: 700, fontSize: tc.fontSize,
            color: "var(--md-on-background)", lineHeight: 1.2,
          }}>
            {node.name}
          </div>
          {tier !== "worker" && (
            <div style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px",
              color: tier === "leader" ? "#6366f1" : "#8b5cf6",
              opacity: 0.8,
            }}>
              {tier}
            </div>
          )}
          {(node.role || node.description) && (
            <div style={{
              fontSize: 10, color: "var(--md-on-surface-variant)",
              lineHeight: 1.3, maxWidth: tc.width - 30, overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {node.role || node.description}
            </div>
          )}
        </div>
        {/* Expand/collapse */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
            style={{
              position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)",
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "var(--md-on-surface-variant)", zIndex: 2, fontFamily: "system-ui",
            }}
          >
            {isCollapsed ? "+" : "\u2212"}
          </button>
        )}
      </div>

      {/* Children tree */}
      {hasChildren && !isCollapsed && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 28, position: "relative",
        }}>
          {/* Vertical line from parent to children row */}
          <div style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: 2, height: 28, background: "var(--md-outline, #79747E)", opacity: 0.4,
          }} />

          <div
            ref={childrenRef}
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "center",
              alignItems: isMobile ? "center" : "flex-start",
              position: "relative",
            }}
          >
            {/* Horizontal connector bar */}
            {!isMobile && hBarStyle && node.children.length > 1 && (
              <div style={{
                position: "absolute", top: 0,
                height: 2, background: "var(--md-outline, #79747E)", opacity: 0.4,
                left: hBarStyle.left, width: hBarStyle.width,
              }} />
            )}

            {node.children.map((child) => (
              <div
                key={child.id}
                className="org-child-col"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  position: "relative",
                  padding: isMobile ? 0 : "0 6px",
                }}
              >
                {/* Vertical line from bar to child */}
                <div style={{
                  width: 2, height: isMobile ? 16 : 20,
                  background: "var(--md-outline, #79747E)", opacity: 0.4,
                }} />
                <OrgNode
                  node={child} onSelect={onSelect} selectedId={selectedId}
                  collapsed={collapsed} toggleCollapse={toggleCollapse}
                  isMobile={isMobile}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ agent, onClose }) {
  if (!agent) return null;
  const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const statusColor = STATUS_COLORS[agent.status] || "#79747E";

  return (
    <div style={{
      width: 360, flexShrink: 0,
      background: "var(--md-surface-container)", borderRadius: 16,
      border: "1px solid var(--md-surface-variant)", padding: 20,
      position: "fixed", right: 24, top: 80,
      maxHeight: "calc(100vh - 100px)", overflowY: "auto", zIndex: 100,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <NodeAvatar node={agent} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--md-on-background)" }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>
            {(agent.status || "unknown").charAt(0).toUpperCase() + (agent.status || "unknown").slice(1)}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 18, color: "var(--md-on-surface-variant)", padding: 4,
        }}>✕</button>
      </div>

      {(agent.role || agent.description) && (
        <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginBottom: 16, lineHeight: 1.5 }}>
          {agent.role || agent.description}
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px",
        marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--md-surface-variant)",
      }}>
        {agent.tier && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>Tier</div>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 8,
              background: agent.tier === "leader" ? "rgba(99,102,241,0.1)" : agent.tier === "manager" ? "rgba(139,92,246,0.1)" : "rgba(121,116,126,0.1)",
              color: agent.tier === "leader" ? "#6366f1" : agent.tier === "manager" ? "#8b5cf6" : "#79747E",
              textTransform: "uppercase",
            }}>{agent.tier}</span>
          </div>
        )}
        {agent.max_capacity != null && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>Capacity</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-background)" }}>
              {agent.current_load || 0} / {agent.max_capacity}
            </div>
          </div>
        )}
        {agent.parent_agent && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>Reports to</div>
            <div style={{ fontSize: 13, color: "var(--md-on-background)" }}>{agent.parent_agent}</div>
          </div>
        )}
        {agent.children && agent.children.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 4 }}>Direct Reports</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-background)" }}>{agent.children.length}</div>
          </div>
        )}
      </div>

      {caps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>Capabilities</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {caps.map((c, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 8,
                background: "var(--md-surface-variant)", color: "var(--md-on-surface-variant)", fontWeight: 500,
              }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {agent.metrics && (agent.metrics.success_rate != null || agent.metrics.avg_completion_time != null) && (
        <div style={{ paddingTop: 16, borderTop: "1px solid var(--md-surface-variant)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--md-on-surface-variant)", opacity: 0.7, marginBottom: 6 }}>Performance</div>
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            {agent.metrics.success_rate != null && <span><CheckCircle2 size={14} /> {Math.round(agent.metrics.success_rate * 100)}% success</span>}
            {agent.metrics.avg_completion_time != null && <span>⏱ {agent.metrics.avg_completion_time}s avg</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const zoomBtnStyle = {
  width: 30, height: 30, borderRadius: 8,
  background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 16, color: "var(--md-on-background)", fontFamily: "system-ui",
};

export default function OrgChart() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchHierarchy = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/hierarchy");
      if (res.ok) {
        const data = await res.json();
        setTree(data.tree);
      }
    } catch (e) {
      console.error("Failed to fetch hierarchy:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHierarchy();
    const interval = setInterval(fetchHierarchy, 15000);
    return () => clearInterval(interval);
  }, [fetchHierarchy]);

  const toggleCollapse = useCallback((id) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setScale((prev) => Math.min(2, Math.max(0.3, prev - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest("button") || e.target.closest("[data-card]")) return;
    setDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  }, [translate]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    setTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => { setDragging(false); }, []);

  const resetView = useCallback(() => { setScale(1); setTranslate({ x: 0, y: 0 }); }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest("button") || e.target.closest("[data-card]")) return;
    const touch = e.touches[0];
    setDragging(true);
    setDragStart({ x: touch.clientX - translate.x, y: touch.clientY - translate.y });
  }, [translate]);

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return;
    const touch = e.touches[0];
    setTranslate({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleTouchEnd = useCallback(() => { setDragging(false); }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, color: "var(--md-on-surface-variant)" }}>
        Loading org chart...
      </div>
    );
  }

  if (!tree) {
    return (
      <div style={{ textAlign: "center", color: "var(--md-on-surface-variant)", padding: 60, fontSize: 14 }}>
        No hierarchy data available
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 10,
        display: "flex", gap: 4, background: "var(--md-surface-container)",
        borderRadius: 10, padding: 4, border: "1px solid var(--md-surface-variant)",
      }}>
        <button onClick={() => setScale((s) => Math.min(2, s + 0.15))} style={zoomBtnStyle}>+</button>
        <button onClick={resetView} style={zoomBtnStyle} title="Reset view">⟲</button>
        <button onClick={() => setScale((s) => Math.max(0.3, s - 0.15))} style={zoomBtnStyle}>−</button>
        <span style={{ fontSize: 11, padding: "4px 8px", color: "var(--md-on-surface-variant)", alignSelf: "center" }}>
          {Math.round(scale * 100)}%
        </span>
      </div>

      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          overflow: "hidden", minHeight: "calc(100vh - 220px)",
          cursor: dragging ? "grabbing" : "grab",
          borderRadius: 16, background: "var(--md-background)",
          border: "1px solid var(--md-surface-variant)", position: "relative",
        }}
      >
        <div style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "top center",
          transition: dragging ? "none" : "transform 0.1s ease",
          display: "flex", justifyContent: "center",
          padding: "40px 20px 60px",
        }}>
          <OrgNode
            node={tree}
            onSelect={(n) => setSelectedAgent(selectedAgent?.id === n.id ? null : n)}
            selectedId={selectedAgent?.id}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            isMobile={isMobile}
          />
        </div>
      </div>

      <DetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  );
}
