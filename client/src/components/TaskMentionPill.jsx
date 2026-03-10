/**
 * TaskMentionPill — Renders @[Task Title] as Discord-style inline pills.
 *
 * Usage:
 *   <TaskMentionText text="Check @[Fix login bug] for details" />
 *   → "Check <pill>@Fix login bug</pill> for details"
 */

const MENTION_REGEX = /@\[([^\]]+)\]/g;

export function TaskMentionPill({ title, onClick }) {
  return (
    <span
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "1px 8px",
        borderRadius: 12,
        background: "rgba(103, 80, 164, 0.15)",
        color: "#6750A4",
        fontWeight: 600,
        fontSize: "0.92em",
        lineHeight: 1.6,
        cursor: onClick ? "pointer" : "default",
        verticalAlign: "baseline",
        transition: "background 120ms",
        whiteSpace: "nowrap",
        maxWidth: 280,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = "rgba(103, 80, 164, 0.25)"; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = "rgba(103, 80, 164, 0.15)"; }}
    >
      <span style={{ opacity: 0.7 }}>@</span>
      <span style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>{title}</span>
    </span>
  );
}

/**
 * Parse text containing @[Task Title] mentions and return an array of
 * React elements (strings + TaskMentionPill components).
 *
 * @param {string} text - Raw text with @[...] mentions
 * @param {function} [onMentionClick] - Called with the task title when a pill is clicked
 * @returns {Array} Array of React nodes
 */
export function parseTaskMentions(text, onMentionClick) {
  if (!text || typeof text !== "string") return text;

  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(MENTION_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const title = match[1];
    parts.push(
      <TaskMentionPill
        key={`mention-${match.index}`}
        title={title}
        onClick={onMentionClick ? () => onMentionClick(title) : undefined}
      />
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no mentions found, return original text
  return parts.length > 0 ? parts : text;
}

/**
 * Component that renders text with inline task mention pills.
 * Handles line breaks too.
 */
export default function TaskMentionText({ text, onMentionClick }) {
  if (!text) return null;

  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {parseTaskMentions(line, onMentionClick)}
    </span>
  ));
}
