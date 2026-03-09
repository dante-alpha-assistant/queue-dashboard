/**
 * PingboardIcons — Clean SVG icon set for the Pingboard page.
 * Replaces emoji status indicators, action icons, tier badges, and capability icons.
 */

/* ─── Status Dot SVG ─── */
export function StatusDotSvg({ status, size = 10, isWorking = false }) {
  const colors = {
    online: "#2E7D32",
    busy: "#E65100",
    offline: "#79747E",
    disabled: "#BA1A1A",
  };
  const color = colors[status] || "#79747E";

  return (
    <svg width={size + 4} height={size + 4} viewBox="0 0 16 16" style={{ flexShrink: 0, display: "block" }}>
      {isWorking && (
        <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4">
          <animate attributeName="r" from="6" to="11" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="8" cy="8" r="5" fill={color}>
        {isWorking && (
          <animate attributeName="r" values="5;5.8;5" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
    </svg>
  );
}

/* ─── Action Icons ─── */
export const PingboardIcons = {
  expand: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
  ),
  collapse: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
  ),
  details: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
  ),
  skills: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 01-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 10-3.214 3.214c.446.166.855.497.925.968a.979.979 0 01-.276.837l-1.61 1.61a2.404 2.404 0 01-1.705.707 2.402 2.402 0 01-1.704-.706l-1.568-1.568a1.026 1.026 0 00-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 11-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 00-.289-.877l-1.568-1.568A2.402 2.402 0 011.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 103.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0112 2c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 113.237 3.237c-.464.18-.894.527-.967 1.02z" /></svg>
  ),
  close: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  ),
  wrench: (size = 14, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
  ),
  search: (size = 14, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  robot: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg>
  ),
  crown: (size = 16, color = "#ffd700") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1}><path d="M2 20h20L19 8l-5 6-2-8-2 8-5-6z" /><rect x="2" y="20" width="20" height="2" rx="1" /></svg>
  ),
  shield: (size = 16, color = "#7c4dff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
  ),
  cog: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
  ),
  clipboard: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
  ),
  flask: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v7.4a2 2 0 01-.6 1.4L4 17.2A2 2 0 005.4 21h13.2a2 2 0 001.4-3.8l-5.4-5.4a2 2 0 01-.6-1.4V3" /></svg>
  ),
  checkCircle: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
  ),
  rocket: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>
  ),
  warning: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
  block: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
  ),
  xCircle: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
  ),
  check: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ),
  arrowRight: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
  ),
  chart: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
  ),
  clock: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  orgChart: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" /><rect x="2" y="18" width="8" height="4" rx="1" /><rect x="14" y="18" width="8" height="4" rx="1" /><path d="M12 6v6M6 18v-4a2 2 0 012-2h8a2 2 0 012 2v4" /></svg>
  ),
  grid: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
  ),
  pipeline: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>
  ),
  tag: (size = 12, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
  ),
  chat: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
  ),
};

/* ─── Tier Badge Component ─── */
export function TierBadge({ tier, size = "normal" }) {
  const config = {
    human: { icon: PingboardIcons.crown, label: "Leader", bg: "rgba(255, 215, 0, 0.12)", color: "#ffd700", border: "#ffd700" },
    leader: { icon: PingboardIcons.crown, label: "Leader", bg: "rgba(255, 215, 0, 0.12)", color: "#ffd700", border: "#ffd700" },
    manager: { icon: PingboardIcons.shield, label: "Manager", bg: "rgba(124, 77, 255, 0.1)", color: "#7c4dff", border: "#7c4dff" },
    core: { icon: PingboardIcons.shield, label: "Core", bg: "rgba(46, 125, 50, 0.1)", color: "#2E7D32", border: "#2E7D32" },
    worker: { icon: PingboardIcons.cog, label: "Worker", bg: "rgba(230, 81, 0, 0.08)", color: "#E65100", border: "transparent" },
    specialist: { icon: PingboardIcons.wrench, label: "Specialist", bg: "rgba(230, 81, 0, 0.08)", color: "#E65100", border: "transparent" },
  };
  const c = config[tier] || config.worker;
  const isSmall = size === "small";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: isSmall ? 3 : 5,
      fontSize: isSmall ? 9 : 11, fontWeight: 700, padding: isSmall ? "2px 8px" : "3px 12px",
      borderRadius: isSmall ? 8 : 10, background: c.bg, color: c.color,
      textTransform: "uppercase", letterSpacing: "1px",
      border: "1px solid " + c.border + "30",
    }}>
      {c.icon(isSmall ? 10 : 12, c.color)}
      {c.label}
    </span>
  );
}

/* ─── Capability Tag with Icon ─── */
const CAPABILITY_ICONS = {
  coding: PingboardIcons.wrench,
  ops: PingboardIcons.cog,
  qa: PingboardIcons.flask,
  review: PingboardIcons.details,
  research: PingboardIcons.search,
  chat: PingboardIcons.chat,
  general: PingboardIcons.grid,
};

export function CapabilityTag({ capability, variant = "default" }) {
  const iconFn = CAPABILITY_ICONS[capability];
  const isHighlight = variant === "highlight";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 9, padding: "2px 7px", borderRadius: 6,
      background: isHighlight ? "rgba(124, 77, 255, 0.1)" : "var(--md-surface-variant)",
      color: isHighlight ? "#7c4dff" : "var(--md-on-surface-variant)",
      fontWeight: isHighlight ? 600 : 500,
    }}>
      {iconFn && iconFn(9, isHighlight ? "#7c4dff" : "var(--md-on-surface-variant)")}
      {capability}
    </span>
  );
}
