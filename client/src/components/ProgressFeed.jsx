import { useState } from 'react';

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTimestamp(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* Compact: latest entry only (for TaskCard) */
export function ProgressLatest({ progressLog }) {
  if (!Array.isArray(progressLog) || progressLog.length === 0) return null;
  const latest = progressLog[progressLog.length - 1];
  if (!latest?.message) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 0 2px',
      fontSize: 12, color: 'var(--md-on-surface-variant, #49454F)',
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#E8A317',
        animation: 'timeline-pulse 2s ease-in-out infinite',
        flexShrink: 0,
      }} />
      <span style={{ opacity: 0.6, flexShrink: 0 }}>{timeAgo(latest.at)}: </span>
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {latest.message}
      </span>
    </div>
  );
}

/* Full timeline (for TaskDetailModal) */
export function ProgressTimeline({ progressLog }) {
  const [expanded, setExpanded] = useState(false);
  if (!Array.isArray(progressLog) || progressLog.length === 0) return null;

  const entries = [...progressLog].reverse(); // newest first
  const visible = expanded ? entries : entries.slice(0, 5);
  const hasMore = entries.length > 5;

  return (
    <div style={{
      margin: '16px 0',
      background: 'var(--md-surface-container-low, #F7F2FA)',
      borderRadius: 12,
      padding: '12px 16px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: 'var(--md-on-surface, #1C1B1F)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Activity Log
          <span style={{
            fontSize: 11, fontWeight: 500, color: 'var(--md-outline, #79747E)',
          }}>({progressLog.length})</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {visible.map((entry, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '6px 0',
            borderLeft: '2px solid var(--md-surface-variant, #E7E0EC)',
            marginLeft: 4,
            paddingLeft: 12,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === 0 ? '#E8A317' : 'var(--md-outline-variant, #CAC4D0)',
              flexShrink: 0, marginTop: 4, marginLeft: -17,
              animation: i === 0 ? 'timeline-pulse 2s ease-in-out infinite' : 'none',
            }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{
                fontSize: 12, color: 'var(--md-on-surface, #1C1B1F)',
                lineHeight: 1.4, wordBreak: 'break-word',
              }}>
                {entry.message}
              </span>
              <span style={{
                fontSize: 10, color: 'var(--md-outline, #79747E)',
                marginLeft: 8, whiteSpace: 'nowrap',
                fontFamily: "'Roboto Mono', monospace",
              }}>
                {formatTimestamp(entry.at)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 8, background: 'none', border: 'none',
            color: 'var(--md-primary, #6750A4)', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, padding: '4px 0',
            fontFamily: "'Roboto', system-ui, sans-serif",
          }}
        >
          {expanded ? '▲ Show less' : `▼ Show all ${entries.length} entries`}
        </button>
      )}
    </div>
  );
}
