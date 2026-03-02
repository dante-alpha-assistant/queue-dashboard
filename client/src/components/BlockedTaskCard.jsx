import { useState } from 'react';

export default function BlockedTaskCard({ task, onStatusChange, onCardClick, isMobile }) {
  const [humanInput, setHumanInput] = useState('');
  const [unblocking, setUnblocking] = useState(false);
  const [error, setError] = useState(null);

  const handleUnblock = async (e) => {
    e.stopPropagation();
    setUnblocking(true);
    setError(null);
    try {
      await onStatusChange?.(task.id, {
        status: 'todo',
        human_input: humanInput || null,
        blocked_reason: null,
        assigned_agent: null,
      });
    } catch (err) {
      setError(err.message || 'Unblock failed');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <div
      onClick={() => onCardClick?.(task)}
      style={{
        background: 'var(--md-surface, #FFFBFE)',
        borderRadius: 16,
        border: '2px solid #E65100',
        borderLeft: '5px solid #E65100',
        marginBottom: 12,
        cursor: 'pointer',
        overflow: 'hidden',
        fontFamily: "'Roboto', system-ui, sans-serif",
        boxShadow: '0 0 0 1px rgba(230, 81, 0, 0.1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(230, 81, 0, 0.15)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px rgba(230, 81, 0, 0.1)'; }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px 8px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100,
          background: '#FFF3E0', color: '#E65100',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>🚫 Blocked</span>
        {task.type && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100,
            background: '#6750A414', color: '#6750A4',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>{task.type}</span>
        )}
      </div>

      {/* Title */}
      <div style={{
        padding: '4px 16px 8px',
        fontWeight: 600, fontSize: 15, lineHeight: 1.45,
        color: 'var(--md-on-surface, #1C1B1F)',
      }}>
        {task.title}
      </div>

      {/* Blocked Reason */}
      {task.blocked_reason && (
        <div style={{
          margin: '0 12px 10px',
          padding: '10px 14px',
          background: '#FFF3E0',
          borderRadius: 10,
          border: '1px solid #FFE0B2',
          fontSize: 13, lineHeight: 1.5,
          color: '#BF360C',
          fontWeight: 500,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, color: '#E65100', letterSpacing: '0.04em' }}>
            Why blocked
          </div>
          {task.blocked_reason}
        </div>
      )}

      {/* Human Input + Unblock */}
      <div style={{
        padding: '0 12px 12px',
      }} onClick={(e) => e.stopPropagation()}>
        <textarea
          value={humanInput}
          onChange={(e) => setHumanInput(e.target.value)}
          placeholder="Provide instructions or info to unblock this task..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--md-surface-variant, #E7E0EC)',
            background: 'var(--md-surface-container-low, #F7F2FA)',
            color: 'var(--md-on-surface, #1C1B1F)',
            fontSize: 13,
            fontFamily: "'Roboto', system-ui, sans-serif",
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#E65100'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--md-surface-variant, #E7E0EC)'; }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          {error && (
            <span style={{ fontSize: 12, color: '#BA1A1A', fontWeight: 500 }}>⚠️ {error}</span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleUnblock}
              disabled={unblocking}
              style={{
                padding: isMobile ? '10px 20px' : '8px 18px',
                borderRadius: 100,
                border: 'none',
                background: unblocking ? '#79747E' : '#2E7D32',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: unblocking ? 'default' : 'pointer',
                fontFamily: "'Roboto', system-ui, sans-serif",
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: isMobile ? 44 : 36,
                transition: 'all 150ms ease',
              }}
            >
              {unblocking ? '⏳ Unblocking...' : '✅ Unblock'}
            </button>
          </div>
        </div>
      </div>

      {/* Agent + time footer */}
      <div style={{
        padding: '8px 16px 10px',
        borderTop: '1px solid var(--md-surface-variant, #E7E0EC)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--md-outline, #79747E)',
      }}>
        <span>{task.assigned_agent || 'Unassigned'}</span>
        <span style={{ fontSize: 11 }}>
          {task.created_at ? new Date(task.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      </div>
    </div>
  );
}
