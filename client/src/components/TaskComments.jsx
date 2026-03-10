import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, Bot, Brain, Clock, Glasses, Hammer, MessageSquare, Settings, User, Waves, Wrench, Zap } from 'lucide-react';

const AUTHOR_ICONS = {
  dante: "👤", neo: "👓", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊", ifra: "🔨",
  'neo-worker': "👓", 'beta-worker': "⚡", 'ifra-worker': "🔨", system: "⚙️",
};
const AUTHOR_TYPE_COLORS = {
  human: '#6750A4',
  agent: '#2E7D32',
  system: '#79747E',
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TaskComments({ taskId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  const fetchComments = async () => {
    try {
      const resp = await fetch(`/api/tasks/${taskId}/comments`);
      if (!resp.ok) throw new Error('Failed to load comments');
      const data = await resp.json();
      setComments([...data].reverse());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // Poll every 10s for new comments
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, [taskId]);

  // No auto-scroll needed — newest comments are already at the top

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), author: 'dante', author_type: 'human' }),
      });
      if (!resp.ok) throw new Error('Failed to post comment');
      const newComment = await resp.json();
      setComments(prev => [newComment, ...prev]);
      setBody('');
      textareaRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Comments list */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: comments.length ? '2px 0' : 0,
      }}>
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--md-outline, #79747E)', fontSize: 13 }}>
            Loading comments…
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--md-outline, #79747E)', fontSize: 13, fontStyle: 'italic' }}>
            No comments yet. Add a comment to communicate with agents.
          </div>
        )}
        {comments.map(c => {
          const icon = AUTHOR_ICONS[c.author] || (c.author_type === 'agent' ? "🤖" : "👤");
          const typeColor = AUTHOR_TYPE_COLORS[c.author_type] || '#79747E';
          return (
            <div key={c.id} style={{
              display: 'flex', gap: 10, padding: '8px 12px',
              background: c.author_type === 'system' ? 'var(--md-surface-container-low, #F7F2FA)' : 'transparent',
              borderRadius: 8,
              borderLeft: `3px solid ${typeColor}20`,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: typeColor }}>{c.author}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 500, color: typeColor, opacity: 0.7,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{c.author_type}</span>
                  <span style={{ fontSize: 10, color: 'var(--md-outline, #79747E)', marginLeft: 'auto', fontFamily: "'Roboto Mono', monospace" }}>
                    {formatTime(c.created_at)}
                  </span>
                </div>
                <div className="tdm-md" style={{
                  fontSize: 13, lineHeight: 1.6, color: 'var(--md-on-surface, #1C1B1F)',
                  wordBreak: 'break-word',
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                      p: ({ node, ...props }) => <p {...props} style={{ margin: '4px 0' }} />,
                    }}
                  >{c.body}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}

      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment… (Ctrl+Enter to send)"
          rows={2}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 10,
            border: '1px solid var(--md-surface-variant, #E7E0EC)',
            background: 'var(--md-surface, #FFFBFE)',
            color: 'var(--md-on-surface, #1C1B1F)',
            fontSize: 13, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            outline: 'none', resize: 'vertical', minHeight: 44, maxHeight: 120,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--md-primary, #6750A4)'}
          onBlur={e => e.target.style.borderColor = 'var(--md-surface-variant, #E7E0EC)'}
        />
        <button
          type="submit"
          disabled={!body.trim() || posting}
          style={{
            padding: '8px 16px', borderRadius: 100, border: 'none',
            background: body.trim() && !posting ? 'var(--md-primary, #6750A4)' : 'var(--md-surface-variant, #E7E0EC)',
            color: body.trim() && !posting ? '#fff' : 'var(--md-outline, #79747E)',
            fontSize: 13, fontWeight: 600, cursor: body.trim() && !posting ? 'pointer' : 'default',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            transition: 'all 0.15s', minHeight: 38, whiteSpace: 'nowrap',
          }}
        >
          {posting ? <Clock size={14} /> : <MessageSquare size={14} />} Send
        </button>
      </form>
      {error && <div style={{ fontSize: 12, color: '#BA1A1A' }}><AlertTriangle size={14} /> {error}</div>}
    </div>
  );
}
