import { useEffect, useState } from 'react';

/* ── Status display config ──────────────────────────────── */

const STATUS_LABELS = {
  todo: 'Todo',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  running: 'Running',
  done: 'Done',
  qa: 'QA',
  qa_testing: 'QA Testing',
  completed: 'Completed',
  deployed: 'Deployed',
  failed: 'Failed',
  deprecated: 'Deprecated',
};

const STATUS_COLORS = {
  todo: '#79747E',
  assigned: '#6750A4',
  in_progress: '#D97706',
  running: '#D97706',
  done: '#386A20',
  qa: '#5E35B1',
  qa_testing: '#5E35B1',
  completed: '#1B5E20',
  deployed: '#00838F',
  failed: '#BA1A1A',
  deprecated: '#9E9E9E',
};

const ACTIVE_STATUSES = new Set(['in_progress', 'assigned', 'running', 'qa_testing']);

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

/* ── Build duration steps from status_history ───────────── */

function buildSteps(statusHistory, currentStatus) {
  if (!statusHistory || !Array.isArray(statusHistory) || statusHistory.length === 0) {
    return null;
  }

  // Sort by timestamp
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
            title={`${STATUS_LABELS[step.status] || step.status}: ${formatDurationDetailed(step.duration)}`}
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

/* ── Main Component ─────────────────────────────────────── */

export default function StatusTimeline({ task }) {
  const [now, setNow] = useState(Date.now());
  const isActive = ACTIVE_STATUSES.has(task.status);

  // Live ticker for active tasks
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const steps = buildSteps(task.status_history, task.status);

  // Fallback: if no status_history, show a simple message
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
      {/* Proportional bar */}
      <DurationBar steps={steps} totalDuration={totalDuration} />

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((step, i) => {
          const color = STATUS_COLORS[step.status] || '#79747E';
          const label = STATUS_LABELS[step.status] || step.status;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0',
              fontSize: 11,
            }}>
              {/* Color dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color, flexShrink: 0,
                opacity: step.isTerminal ? 0.5 : 1,
                animation: step.isActive ? 'tdm-live-blink 2s ease-in-out infinite' : 'none',
              }} />

              {/* Status label */}
              <span style={{
                flex: 1, fontWeight: step.isCurrent ? 600 : 400,
                color: step.isCurrent
                  ? 'var(--md-on-surface, #1C1B1F)'
                  : 'var(--md-on-surface-variant, #49454F)',
              }}>
                {label}
              </span>

              {/* Duration */}
              <span style={{
                fontFamily: "'Roboto Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                color: step.isTerminal ? '#00838F' : color,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {step.isTerminal ? '✅' : formatDurationDetailed(step.duration)}
              </span>
            </div>
          );
        })}

        {/* Total */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 0 0',
          borderTop: '1px solid var(--md-surface-variant, #E7E0EC)',
          marginTop: 2,
          fontSize: 11,
        }}>
          <div style={{ width: 8, flexShrink: 0 }} />
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
    </div>
  );
}
