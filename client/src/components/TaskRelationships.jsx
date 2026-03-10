import { useState, useEffect, useRef, useCallback } from 'react';
const CircleDot = ({ size = 14, color = "currentColor", ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" {...p}><circle cx="12" cy="12" r="8" /></svg>;

/* ── Status color mapping ─────────────────────────────────── */
const STATUS_INDICATOR = {
  completed: { icon: '✅', color: '#1B5E20', bg: '#1B5E2014' },
  deployed:  { icon: '✅', color: '#00838F', bg: '#00838F14' },
  in_progress: { icon: '🔄', color: '#E8A317', bg: '#E8A31714' },
  running:   { icon: '🔄', color: '#E8A317', bg: '#E8A31714' },
  qa_testing: { icon: '🔍', color: '#5E35B1', bg: '#5E35B114' },
  blocked:   { icon: '🔴', color: '#BA1A1A', bg: '#BA1A1A14' },
  failed:    { icon: '🔴', color: '#BA1A1A', bg: '#BA1A1A14' },
  todo:      { icon: '⚪', color: '#79747E', bg: '#79747E14' },
  assigned:  { icon: '⚪', color: '#6750A4', bg: '#6750A414' },
};

function getStatusIndicator(status) {
  return STATUS_INDICATOR[status] || STATUS_INDICATOR.todo;
}

const RELATIONSHIP_TYPES = [
  { value: 'depends_on', label: 'Depends on' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'related_to', label: 'Related to' },
  { value: 'subtask_of', label: 'Subtask of' },
];

/* ── Relationship Chip ────────────────────────────────────── */
function RelChip({ rel, onRemove, onNavigate }) {
  const task = rel.task;
  const si = getStatusIndicator(task.status);
  const title = task.title || task.id?.slice(0, 8);
  const truncated = title.length > 40 ? title.slice(0, 37) + '…' : title;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 8px 4px 10px', borderRadius: 100,
      background: si.bg, border: `1px solid ${si.color}30`,
      fontSize: 12, maxWidth: '100%', cursor: 'pointer',
      transition: 'all 0.15s',
    }}
    onClick={() => onNavigate && onNavigate(task.id)}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    title={`${task.title || task.id}\nStatus: ${task.status || 'unknown'}`}
    >
      <span style={{ fontSize: 10, flexShrink: 0 }}>{si.icon}</span>
      <span style={{ fontWeight: 500, color: 'var(--md-on-surface, #1C1B1F)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {truncated}
      </span>
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(rel.id); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--md-outline, #79747E)', fontSize: 12, padding: '0 2px',
            lineHeight: 1, borderRadius: 4, flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#BA1A1A'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--md-outline, #79747E)'; }}
          title="Remove relationship"
        >✕</button>
      )}
    </div>
  );
}

/* ── Add Relationship Form ────────────────────────────────── */
function AddRelationshipForm({ taskId, onAdd, onCancel }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [relType, setRelType] = useState('depends_on');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const resp = await fetch(`/api/tasks?search=${encodeURIComponent(q)}`);
      const tasks = await resp.json();
      const filtered = (Array.isArray(tasks) ? tasks : [])
        .filter(t => t.id !== taskId)
        .slice(0, 8);
      setResults(filtered);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, doSearch]);

  const handleSubmit = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(selectedTask.id, relType);
      onCancel();
    } catch (e) {
      setError(e.message || 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      padding: 12, background: 'var(--md-surface-container-low, #F7F2FA)',
      border: '1px solid var(--md-surface-variant, #E7E0EC)',
      borderRadius: 10, marginTop: 8,
    }}>
      {/* Type selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <select
          value={relType}
          onChange={e => setRelType(e.target.value)}
          style={{
            padding: '5px 8px', borderRadius: 6, border: '1px solid var(--md-surface-variant, #E7E0EC)',
            fontSize: 12, fontWeight: 500, background: 'var(--md-surface, #FFFBFE)',
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {RELATIONSHIP_TYPES.map(rt => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>
      </div>

      {/* Search input */}
      {!selectedTask ? (
        <div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search tasks by title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--md-surface-variant, #E7E0EC)',
                fontSize: 13, fontFamily: 'inherit', outline: 'none',
                background: 'var(--md-surface, #FFFBFE)',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--md-primary, #6750A4)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--md-surface-variant, #E7E0EC)'; }}
            />
            {loading && <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 12, color: 'var(--md-outline)' }}><Clock size={14} /></span>}
          </div>

          {/* Results list — rendered inline to avoid overflow clipping in modals */}
          {results.length > 0 && (
            <div style={{
              background: 'var(--md-surface, #FFFBFE)',
              border: '1px solid var(--md-surface-variant, #E7E0EC)',
              borderRadius: 8, marginTop: 4,
              maxHeight: 200, overflowY: 'auto',
            }}>
              {results.map(t => {
                const si = getStatusIndicator(t.status);
                return (
                  <div key={t.id}
                    onClick={() => { setSelectedTask(t); setSearch(''); setResults([]); }}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid var(--md-surface-variant, #E7E0EC)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-low, #F7F2FA)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 10 }}>{si.icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {t.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--md-outline)', fontFamily: "'Roboto Mono', monospace", flexShrink: 0 }}>
                      {t.id.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {search.length >= 2 && !loading && results.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--md-outline, #79747E)', marginTop: 4, padding: '4px 2px' }}>
              No tasks found for &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
          <div style={{
            flex: 1, padding: '6px 10px', background: 'var(--md-surface, #FFFBFE)',
            borderRadius: 8, border: '1px solid var(--md-primary, #6750A4)',
            fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {getStatusIndicator(selectedTask.status).icon} {selectedTask.title}
          </div>
          <button onClick={() => setSelectedTask(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
            color: 'var(--md-outline)', padding: '2px 4px',
          }}>✕</button>
        </div>
      )}

      {error && <div style={{ color: '#BA1A1A', fontSize: 11, marginTop: 6 }}>{error}</div>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          background: 'none', border: '1px solid var(--md-surface-variant, #E7E0EC)',
          borderRadius: 100, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit', color: 'var(--md-on-surface-variant)',
        }}>Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!selectedTask || submitting}
          style={{
            background: selectedTask ? 'var(--md-primary, #6750A4)' : 'var(--md-outline-variant, #CAC4D0)',
            color: '#fff', border: 'none', borderRadius: 100, padding: '5px 14px',
            fontSize: 12, fontWeight: 600, cursor: selectedTask ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
          }}
        >{submitting ? <><Clock size={12} /> Adding…</> : 'Add'}</button>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function TaskRelationships({ taskId, onNavigateToTask }) {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState(null);

  const fetchRelationships = useCallback(async () => {
    try {
      const resp = await fetch(`/api/tasks/${taskId}/relationships`);
      const data = await resp.json();
      if (data.ok) setRelationships(data.relationships || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { fetchRelationships(); }, [fetchRelationships]);

  const handleAdd = async (targetId, type) => {
    const resp = await fetch(`/api/tasks/${taskId}/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_task_id: targetId, relationship_type: type }),
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    await fetchRelationships();
  };

  const handleRemove = async (relId) => {
    setRemoving(relId);
    try {
      await fetch(`/api/relationships/${relId}`, { method: 'DELETE' });
      setRelationships(prev => prev.filter(r => r.id !== relId));
    } catch { /* ignore */ }
    finally { setRemoving(null); }
  };

  // Group relationships
  const groups = {
    depends_on: [],  // outgoing depends_on: this task depends on X
    blocks: [],      // incoming depends_on: X depends on this task (this blocks X)
    related_to: [],
    subtask_of: [],
  };

  for (const rel of relationships) {
    if (rel.type === 'depends_on' && rel.direction === 'outgoing') {
      groups.depends_on.push(rel);
    } else if (rel.type === 'depends_on' && rel.direction === 'incoming') {
      groups.blocks.push(rel);
    } else if (rel.type === 'related_to') {
      groups.related_to.push(rel);
    } else if (rel.type === 'subtask_of' && rel.direction === 'outgoing') {
      groups.subtask_of.push(rel);
    } else if (rel.type === 'blocks' && rel.direction === 'outgoing') {
      groups.blocks.push(rel);
    } else {
      // Fallback: put in related
      groups.related_to.push(rel);
    }
  }

  const hasAny = relationships.length > 0;
  if (loading) return null;
  if (!hasAny && !showAdd) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--md-outline, #79747E)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ fontSize: 11 }}><Link size={14} /></span> Dependencies
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            background: 'none', border: '1px dashed var(--md-outline-variant, #CAC4D0)',
            borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 500,
            color: 'var(--md-outline, #79747E)', cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--md-primary, #6750A4)'; e.currentTarget.style.color = 'var(--md-primary, #6750A4)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--md-outline-variant, #CAC4D0)'; e.currentTarget.style.color = 'var(--md-outline, #79747E)'; }}
        >+ Add dependency</button>
        {showAdd && <AddRelationshipForm taskId={taskId} onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}
      </div>
    );
  }

  const GROUP_CONFIG = [
    { key: 'depends_on', label: 'Depends on', icon: ArrowUp },
    { key: 'blocks', label: 'Blocks', icon: '⬇️' },
    { key: 'subtask_of', label: 'Subtask of', icon: Paperclip },
    { key: 'related_to', label: 'Related to', icon: '↔️' },
  ];

  return (
    <div style={{
      marginBottom: 16, padding: 14,
      background: 'var(--md-surface-container-low, #F7F2FA)',
      borderRadius: 10, border: '1px solid var(--md-surface-variant, #E7E0EC)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--md-outline, #79747E)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{ fontSize: 11 }}><Link size={14} /></span> Dependencies
      </div>

      {GROUP_CONFIG.map(({ key, label, icon }) => {
        const items = groups[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--md-outline, #79747E)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10 }}>{icon}</span> {label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map(rel => (
                <RelChip
                  key={rel.id}
                  rel={rel}
                  onRemove={removing === rel.id ? null : handleRemove}
                  onNavigate={onNavigateToTask}
                />
              ))}
            </div>
          </div>
        );
      })}

      <button
        onClick={() => setShowAdd(true)}
        style={{
          background: 'none', border: '1px dashed var(--md-outline-variant, #CAC4D0)',
          borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 500,
          color: 'var(--md-outline, #79747E)', cursor: 'pointer',
          fontFamily: 'inherit', transition: 'all 0.15s', marginTop: 4,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--md-primary, #6750A4)'; e.currentTarget.style.color = 'var(--md-primary, #6750A4)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--md-outline-variant, #CAC4D0)'; e.currentTarget.style.color = 'var(--md-outline, #79747E)'; }}
      >+ Add dependency</button>

      {showAdd && <AddRelationshipForm taskId={taskId} onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}
    </div>
  );
}
