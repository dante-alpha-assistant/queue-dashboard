import { useEffect, useState } from 'react';

/* ── Constants ────────────────────────────────────────────── */

const FIELD_LABELS = {
  created: 'Task created',
  status: 'Status',
  title: 'Title',
  description: 'Description',
  type: 'Type',
  priority: 'Priority',
  assigned_agent: 'Assigned agent',
  stage: 'Stage',
  acceptance_criteria: 'Acceptance criteria',
  dispatched_by: 'Owner',
  result: 'Result',
  error: 'Error',
  qa_result: 'QA result',
  qa_agent: 'QA agent',
  project_id: 'Project',
  repository_id: 'Repository',
  blocked_reason: 'Blocked reason',
  pull_request_url: 'Pull request',
  comment: 'Comment',
};

const FIELD_ICONS = {
  created: '🆕',
  status: '🔄',
  title: '✏️',
  description: '📝',
  type: '🏷️',
  priority: '⚡',
  assigned_agent: '👤',
  stage: '🔧',
  acceptance_criteria: '✅',
  dispatched_by: '👑',
  result: '📦',
  error: '❌',
  qa_result: '🧪',
  qa_agent: '🔍',
  project_id: '📁',
  repository_id: '📂',
  blocked_reason: '🚫',
  pull_request_url: '🔗',
  comment: '💬',
};

const ERROR_CATEGORY_META = {
  merge_conflict: { label: 'Merge Conflict', color: '#E65100', icon: '🔀' },
  ci_failure: { label: 'CI Failure', color: '#D32F2F', icon: '🔴' },
  timeout: { label: 'Timeout', color: '#FF6F00', icon: '⏱️' },
  session_lost: { label: 'Session Lost', color: '#F57C00', icon: '💀' },
  qa_rejection: { label: 'QA Rejection', color: '#7B1FA2', icon: '🧪' },
  auth_error: { label: 'Auth Error', color: '#C62828', icon: '🔑' },
  resource_error: { label: 'Resource Error', color: '#AD1457', icon: '💾' },
  unknown: { label: 'Unknown', color: '#9E9E9E', icon: '❓' },
};

const STATUS_COLORS = {
  todo: '#79747E',
  assigned: '#6750A4',
  in_progress: '#D97706',
  running: '#D97706',
  qa: '#5E35B1',
  qa_testing: '#5E35B1',
  completed: '#1B5E20',
  deployed: '#00838F',
  failed: '#BA1A1A',
  deprecated: '#9E9E9E',
  blocked: '#E65100',
};

const PRIORITY_COLORS = {
  urgent: '#D32F2F',
  high: '#E65100',
  normal: '#79747E',
  low: '#757575',
};

/* ── Helpers ──────────────────────────────────────────────── */

/** Rename "system" to a friendlier label */
function displayAuthor(name) {
  if (!name || name === 'system') return 'orchestration layer';
  return name;
}

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

const TRUNCATE_LIMIT = 60;

function ExpandableValue({ value, color }) {
  const [expanded, setExpanded] = useState(false);

  if (!value || value === 'null') {
    return <span style={{ color: 'var(--md-outline, #79747E)', fontStyle: 'italic', fontSize: 11 }}>none</span>;
  }

  const isLong = value.length > TRUNCATE_LIMIT;
  const displayVal = (!isLong || expanded) ? value : value.slice(0, TRUNCATE_LIMIT) + '…';

  return (
    <span
      onClick={isLong ? () => setExpanded(!expanded) : undefined}
      style={{
        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
        background: color ? `${color}14` : 'var(--md-surface-container-low, #F7F2FA)',
        color: color || 'var(--md-on-surface-variant, #49454F)',
        maxWidth: expanded ? 'none' : 220,
        overflow: 'hidden',
        textOverflow: expanded ? 'unset' : 'ellipsis',
        whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
        wordBreak: expanded ? 'break-all' : undefined,
        display: 'inline-block', verticalAlign: 'middle',
        cursor: isLong ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      title={isLong && !expanded ? 'Click to expand' : undefined}
    >
      {displayVal}
    </span>
  );
}

/* ── Activity Entry ───────────────────────────────────────── */

function ActivityEntry({ entry, isLast }) {
  const label = FIELD_LABELS[entry.field] || entry.field;
  const icon = FIELD_ICONS[entry.field] || '•';
  const isCreation = entry.field === 'created';
  const author = displayAuthor(entry.changed_by);

  const getValueColor = (field, val) => {
    if (field === 'status') return STATUS_COLORS[val] || null;
    if (field === 'priority') return PRIORITY_COLORS[val] || null;
    return null;
  };

  return (
    <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
      {/* Timeline connector */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: 20, flexShrink: 0,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: isCreation ? '#6750A414' : 'var(--md-surface-container-low, #F7F2FA)',
          border: `1.5px solid ${isCreation ? '#6750A4' : 'var(--md-surface-variant, #E7E0EC)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, flexShrink: 0,
        }}>
          {icon}
        </div>
        {!isLast && (
          <div style={{
            width: 1.5, flex: 1, minHeight: 10,
            background: 'var(--md-surface-variant, #E7E0EC)',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 12,
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flexWrap: 'wrap', marginTop: 1,
        }}>
          {author && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: entry.field === 'comment'
                ? (entry.author_type === 'agent' ? '#E65100' : '#1B5E20')
                : author === 'orchestration layer' ? '#9C27B0' : '#6750A4',
            }}>
              {author}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant, #49454F)' }}>
            {isCreation ? 'created this task' : entry.field === 'comment' ? 'added a comment' : `changed ${label.toLowerCase()}`}
          </span>
          <span style={{
            fontSize: 9, color: 'var(--md-outline, #79747E)',
            fontFamily: "'Roboto Mono', monospace",
            marginLeft: 'auto', flexShrink: 0,
          }}>
            {formatTimestamp(entry.changed_at)}
          </span>
        </div>

        {/* Value change row (skip for creation) */}
        {!isCreation && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 4, flexWrap: 'wrap',
          }}>
            <ExpandableValue value={entry.old_value} color={getValueColor(entry.field, entry.old_value)} />
            <span style={{ fontSize: 10, color: 'var(--md-outline, #79747E)' }}>→</span>
            <ExpandableValue value={entry.new_value} color={getValueColor(entry.field, entry.new_value)} />
          </div>
        )}

        {/* Comment body */}
        {entry.field === 'comment' && entry.new_value && (
          <div style={{
            marginTop: 6, padding: '8px 12px', borderRadius: 8,
            background: entry.author_type === 'agent' ? '#FFF3E0' : '#E8F5E9',
            borderLeft: `3px solid ${entry.author_type === 'agent' ? '#E65100' : '#1B5E20'}`,
            fontSize: 12, color: 'var(--md-on-surface, #1C1B1F)',
            lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxWidth: 500,
          }}>
            {entry.new_value}
          </div>
        )}

        {/* Error category badge */}
        {entry.error_category && ERROR_CATEGORY_META[entry.error_category] && (
          <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: `${ERROR_CATEGORY_META[entry.error_category].color}18`,
              color: ERROR_CATEGORY_META[entry.error_category].color,
              border: `1px solid ${ERROR_CATEGORY_META[entry.error_category].color}30`,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              {ERROR_CATEGORY_META[entry.error_category].icon} {ERROR_CATEGORY_META[entry.error_category].label}
            </span>
          </div>
        )}

        {/* Show reason when assigned_agent is cleared without a separate error entry */}
        {entry.reason && (
          <div style={{
            marginTop: 4, padding: '4px 8px', borderRadius: 6,
            background: '#BA1A1A0A', borderLeft: '2px solid #BA1A1A',
            fontSize: 11, color: '#BA1A1A',
            maxWidth: 400, wordBreak: 'break-word',
          }}>
            ⚠️ {entry.reason}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */

export default function ActivityLog({ taskId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    const fetchActivity = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/activity?limit=${PAGE_SIZE}&offset=0`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setEntries(data.entries || data);
          setTotal(data.total || 0);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    };

    fetchActivity();
    const id = setInterval(fetchActivity, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [taskId]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/activity?limit=${PAGE_SIZE}&offset=${entries.length}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(prev => [...prev, ...(data.entries || data)]);
      setTotal(data.total || total);
    } catch (e) {
      console.error('Failed to load more activity:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--md-outline, #79747E)', fontSize: 12 }}>
        Loading activity…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#BA1A1A', fontSize: 12 }}>
        Failed to load activity: {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: 'var(--md-outline, #79747E)', fontSize: 13, fontStyle: 'italic' }}>
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {entries.map((entry, i) => (
        <ActivityEntry
          key={entry.id}
          entry={entry}
          isLast={i === entries.length - 1}
        />
      ))}
      {entries.length < total && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          style={{
            display: 'block', width: '100%', padding: '10px 0',
            marginTop: 8, background: 'none', border: '1px solid var(--md-surface-variant, #E7E0EC)',
            borderRadius: 8, cursor: loadingMore ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 500, color: 'var(--md-primary, #6750A4)',
          }}
        >
          {loadingMore ? '⏳ Loading…' : `Show more (${entries.length}/${total})`}
        </button>
      )}
    </div>
  );
}
