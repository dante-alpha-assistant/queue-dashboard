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
  project_id: 'Project',
  repository_id: 'Repository',
  blocked_reason: 'Blocked reason',
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
  project_id: '📁',
  repository_id: '📂',
  blocked_reason: '🚫',
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

function truncateValue(val, max = 60) {
  if (!val) return null;
  if (val.length <= max) return val;
  return val.slice(0, max) + '…';
}

function ValueChip({ value, color }) {
  if (!value || value === 'null') return <span style={{ color: 'var(--md-outline, #79747E)', fontStyle: 'italic', fontSize: 11 }}>none</span>;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
      background: color ? `${color}14` : 'var(--md-surface-container-low, #F7F2FA)',
      color: color || 'var(--md-on-surface-variant, #49454F)',
      maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      display: 'inline-block', verticalAlign: 'middle',
    }} title={value}>
      {truncateValue(value)}
    </span>
  );
}

/* ── Activity Entry ───────────────────────────────────────── */

function ActivityEntry({ entry, isLast }) {
  const label = FIELD_LABELS[entry.field] || entry.field;
  const icon = FIELD_ICONS[entry.field] || '•';
  const isCreation = entry.field === 'created';

  // Color logic for status/priority changes
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
          {entry.changed_by && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: '#6750A4',
            }}>
              {entry.changed_by}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant, #49454F)' }}>
            {isCreation ? 'created this task' : `changed ${label.toLowerCase()}`}
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
            <ValueChip value={entry.old_value} color={getValueColor(entry.field, entry.old_value)} />
            <span style={{ fontSize: 10, color: 'var(--md-outline, #79747E)' }}>→</span>
            <ValueChip value={entry.new_value} color={getValueColor(entry.field, entry.new_value)} />
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
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    const fetchActivity = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/activity`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setEntries(data);
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
    // Poll every 10s for live updates
    const id = setInterval(fetchActivity, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [taskId]);

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
        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
          Activity will appear here once the database trigger is applied.
        </div>
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
    </div>
  );
}
