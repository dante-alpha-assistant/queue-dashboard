import { StatusIcon } from './Icons';

const TITLE_TO_STATUS = {
  "Todo": "todo",
  "In Progress": "in_progress",
  "Blocked": "blocked",
  "QA Testing": "qa_testing",
  "Completed": "completed",
  "Deployed": "deployed",
  "Deploying": "deploying",
  "Deploy Failed": "deploy_failed",
  "Failed": "failed",
};

export default function Column({ title, color, count, agentCount, children, isTablet, collapsible, collapsed, onToggleCollapse, headerAction }) {
  if (collapsible && collapsed) {
    return (
      <div
        onClick={onToggleCollapse}
        style={{
          flex: "0 0 56px",
          minWidth: 56,
          maxWidth: 56,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "var(--md-surface-container)",
          borderRadius: 16,
          cursor: "pointer",
          padding: "14px 0",
          gap: 8,
          transition: "all 200ms ease",
          overflow: "hidden",
        }}
        title={`${title} — click to expand`}
      >
        <StatusIcon status={TITLE_TO_STATUS[title] || "todo"} size={16} color={color} />
        <span style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          fontWeight: 600,
          fontSize: 12,
          color: "var(--md-on-surface-variant)",
          letterSpacing: "0.5px",
        }}>{title}</span>
        <span style={{
          background: `${color}20`,
          color,
          padding: "2px 8px",
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}>{count}</span>
        {agentCount > 0 && (
          <span style={{
            background: "#0097A720",
            color: "#0097A7",
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          display: "inline-flex", alignItems: "center", gap: 2,
          }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>{agentCount}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      flex: isTablet ? "0 0 280px" : "1 1 0",
      minWidth: isTablet ? 280 : 260,
      maxWidth: isTablet ? 320 : 340,
      display: "flex", flexDirection: "column",
      background: "var(--md-surface-container)", borderRadius: 16,
      overflow: "hidden",
      transition: "all 200ms ease",
    }}>
      <div style={{
        padding: "14px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        cursor: collapsible ? "pointer" : "default",
      }} onClick={collapsible ? onToggleCollapse : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusIcon status={TITLE_TO_STATUS[title] || "todo"} size={16} color={color} />
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-background)" }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            background: `${color}20`, color,
            padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
          }}>{count}</span>
          {agentCount > 0 && (
            <span style={{
              background: "#0097A720",
              color: "#0097A7",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 2,
            }} title={`${agentCount} active task${agentCount !== 1 ? 's' : ''}`}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>{agentCount}</span>
          )}
          {headerAction && <span onClick={e => e.stopPropagation()}>{headerAction}</span>}
          {collapsible && (
            <span style={{
              fontSize: 10,
              color: "var(--md-on-surface-variant)",
              opacity: 0.6,
            }}>◀</span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
        {children}
      </div>
    </div>
  );
}
