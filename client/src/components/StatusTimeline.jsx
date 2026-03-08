import { useEffect, useState } from 'react';

/* ── Status display config ──────────────────────────────── */

const STATUS_LABELS = {
  todo: 'Todo',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  running: 'Running',
  qa: 'QA',
  qa_testing: 'QA Testing',
  completed: 'Completed',
  deployed: 'Deployed',
  deploying: 'Deploying',
  deploy_failed: 'Deploy Failed',
  failed: 'Failed',
  deprecated: 'Deprecated',
  blocked: 'Blocked',
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
  deploying: '#F57C00',
  deploy_failed: '#C62828',
  failed: '#BA1A1A',
  deprecated: '#9E9E9E',
  blocked: '#E65100',
};

const STATUS_ICONS = {
  todo: '○',
  assigned: '◉',
  in_progress: '▶',
  running: '▶',
  qa_testing: '🔍',
  completed: '✓',
  deployed: '🚀',
  deploying: '⏳',
  deploy_failed: '💥',
  failed: '✕',
  blocked: '⏸',
  deprecated: '⊘',
};

const ACTIVE_STATUSES = new Set(['in_progress', 'running', 'qa_testing']);

/* ── Duration formatting ────────────────────────────────── */

function formatDurationDetailed(ms) {
  if (!ms || ms < 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm.toString().padStart(2, '0')}m`;
}

function formatTotalDuration(ms) {
  if (!ms || ms < 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm.toString().padStart(2, '0')}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

function formatTimestamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
  } catch { return ''; }
}

/* ── Build steps from status_history ────────────────────── */

function buildSteps(statusHistory, currentStatus) {
  if (!statusHistory || !Array.isArray(statusHistory) || statusHistory.length === 0) {
    return null;
  }

  const sorted = [...statusHistory].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  const steps = [];
  const now = Date.now();

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const next = sorted[i + 1];
    const startMs = new Date(entry.at).getTime();
    const endMs = next ? new Date(next.at).getTime() : now;
    const isLast = i === sorted.length - 1;
    const isCurrent = isLast && entry.status === currentStatus;
    const isTerminal = ['deployed', 'deprecated'].includes(entry.status);

    steps.push({
      status: entry.status,
      startTime: entry.at,
      duration: endMs - startMs,
      agent: entry.agent || null,
      reason: entry.reason || null,
      isCurrent,
      isTerminal,
      isActive: isCurrent && ACTIVE_STATUSES.has(entry.status),
    });
  }

  return steps;
}

/* ── Duration bar (proportional widths) ─────────────────── */

function DurationBar({ steps, totalDuration }) {
  if (!steps || steps.length === 0 || !totalDuration) return null;

  return (
    <div style={{
      display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden',
      background: 'var(--md-surface-variant, #E7E0EC)',
    }}>
      {steps.map((step, i) => {
        const pct = Math.max((step.duration / totalDuration) * 100, 1);
        const color = STATUS_COLORS[step.status] || '#79747E';
        return (
          <div
            key={i}
            title={`${STATUS_LABELS[step.status] || step.status}: ${formatDurationDetailed(step.duration)}${step.agent ? ` (${step.agent})` : ''}`}
            style={{
              width: `${pct}%`,
              background: color,
              opacity: step.isTerminal ? 0.5 : 0.8,
              transition: 'width 0.3s ease',
              borderRight: i < steps.length - 1 ? '1px solid var(--md-surface, #FFFBFE)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Vertical Timeline Step ─────────────────────────────── */

function TimelineStep({ step, isFirst, isLast }) {
  const color = STATUS_COLORS[step.status] || '#79747E';
  const label = STATUS_LABELS[step.status] || step.status;
  const icon = STATUS_ICONS[step.status] || '•';

  return (
    <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
      {/* Vertical line + dot */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: 16, flexShrink: 0,
      }}>
        {/* Connector line above */}
        {!isFirst && (
          <div style={{
            width: 2, height: 6,
            background: 'var(--md-surface-variant, #E7E0EC)',
          }} />
        )}
        {/* Status dot */}
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 8, color: 'white', fontWeight: 700,
          animation: step.isActive ? 'tdm-live-blink 2s ease-in-out infinite' : 'none',
          boxShadow: step.isActive ? `0 0 0 3px ${color}30` : 'none',
        }}>
          {step.isTerminal ? '✓' : step.status === 'failed' ? '✕' : ''}
        </div>
        {/* Connector line below */}
        {!isLast && (
          <div style={{
            width: 2, flex: 1, minHeight: 6,
            background: 'var(--md-surface-variant, #E7E0EC)',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 6,
        paddingTop: isFirst ? 0 : 0,
      }}>
        {/* Status + duration row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: -1,
        }}>
          <span style={{
            fontSize: 11, fontWeight: step.isCurrent ? 700 : 600,
            color: step.isCurrent
              ? 'var(--md-on-surface, #1C1B1F)'
              : 'var(--md-on-surface-variant, #49454F)',
          }}>
            {label}
          </span>
          <span style={{
            fontFamily: "'Roboto Mono', monospace",
            fontSize: 10, fontWeight: 600,
            color: step.isTerminal ? '#00838F' : color,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {step.isTerminal ? '✅' : formatDurationDetailed(step.duration)}
          </span>
        </div>

        {/* Timestamp + agent row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flexWrap: 'wrap',
          marginTop: 1,
        }}>
          <span style={{
            fontSize: 9, color: 'var(--md-outline, #79747E)',
            fontFamily: "'Roboto Mono', monospace",
          }}>
            {formatTimestamp(step.startTime)}
          </span>
          {step.agent && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              color: '#6750A4',
              background: '#6750A40D',
              padding: '1px 5px',
              borderRadius: 4,
            }}>
              {step.agent}
            </span>
          )}
        </div>

        {/* Reason (for blocked/failed) */}
        {step.reason && (
          <div style={{
            fontSize: 10, color: step.status === 'failed' ? '#BA1A1A' : '#E65100',
            marginTop: 2, lineHeight: 1.4,
            fontStyle: 'italic',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {step.reason}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */

export default function StatusTimeline({ task }) {
  const [now, setNow] = useState(Date.now());
  const isActive = ACTIVE_STATUSES.has(task.status);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const steps = buildSteps(task.status_history, task.status);

  if (!steps) {
    return (
      <div style={{
        fontSize: 11, color: 'var(--md-outline, #79747E)',
        fontStyle: 'italic', padding: '4px 0',
      }}>
        No status history available
      </div>
    );
  }

  const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Proportional duration bar */}
      <DurationBar steps={steps} totalDuration={totalDuration} />

      {/* Vertical timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step, i) => (
          <TimelineStep
            key={i}
            step={step}
            isFirst={i === 0}
            isLast={i === steps.length - 1}
          />
        ))}
      </div>

      {/* Total duration */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 0 0',
        borderTop: '1px solid var(--md-surface-variant, #E7E0EC)',
        marginTop: 2,
        fontSize: 11,
      }}>
        <div style={{ width: 16, flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: 700, color: 'var(--md-on-surface, #1C1B1F)' }}>
          Total
        </span>
        <span style={{
          fontFamily: "'Roboto Mono', monospace",
          fontSize: 10, fontWeight: 700,
          color: 'var(--md-on-surface, #1C1B1F)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTotalDuration(totalDuration)}
        </span>
      </div>
    </div>
  );
}
