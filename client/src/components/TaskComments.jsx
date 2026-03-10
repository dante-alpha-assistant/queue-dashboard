import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, Bot, Brain, Clock, Glasses, Hammer, MessageSquare, Settings, User, Waves, Wrench, Zap } from 'lucide-react';
import AgentMentionDropdown from './AgentMentionDropdown';

const AUTHOR_ICONS = {
  dante: "👤", neo: "👓", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊", ifra: "🔨",
  'neo-worker': "👓", 'beta-worker': "⚡", 'ifra-worker': "🔨",
  'research-worker': "🔬", 'neo-chat-worker': "💬", system: "⚙️",
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

// Render @agent-name mentions as styled badges
function renderBodyWithMentions(text) {
  return text.replace(/@\[([^\]]+)\]/g, '**@$1**');
}

export default function TaskComments({ taskId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  // Agent mention state
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed
  const [mentionStart, setMentionStart] = useState(null); // cursor pos of @
  const [mentionedAgents, setMentionedAgents] = useState([]); // resolved agents

  const fetchComments = async () => {
    try {
      const resp = await fetch(`/api/tasks/${taskId}/comments`);
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `Server error (${resp.status})`);
      }
      const data = await resp.json();
      setComments([...data].reverse());
      setError(null); // Clear any previous errors on success
    } catch (e) {
      // Only show error if we have no cached comments (don't disrupt view on transient poll failures)
      if (comments.length === 0) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setComments([]);
    fetchComments();
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, [taskId]);

  // Detect @mention in textarea
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setBody(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Look backwards for an unmatched @ that isn't part of a resolved mention @[name]
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      const ch = textBeforeCursor[i];
      if (ch === ' ' || ch === '\n') break;
      if (ch === '@') {
        // Skip if followed by [ (already resolved)
        if (textBeforeCursor[i + 1] === '[') break;
        const query = textBeforeCursor.slice(i + 1);
        setMentionQuery(query);
        setMentionStart(i);
        return;
      }
    }
    setMentionQuery(null);
    setMentionStart(null);
  }, []);

  const handleAgentSelect = useCallback((agent) => {
    const before = body.slice(0, mentionStart);
    const afterCursor = body.slice(textareaRef.current?.selectionStart || (mentionStart + (mentionQuery?.length || 0) + 1));
    const mentionText = `@[${agent.id}] `;
    const newBody = before + mentionText + afterCursor;
    setBody(newBody);
    setMentionQuery(null);
    setMentionStart(null);

    // Track mentioned agent
    setMentionedAgents(prev => {
      if (prev.find(a => a.id === agent.id)) return prev;
      return [...prev, agent];
    });

    // Refocus
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [body, mentionStart, mentionQuery]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);

    // Extract mentioned agent IDs from the body text
    const mentionMatches = [...body.matchAll(/@\[([^\]]+)\]/g)];
    const mentions = mentionMatches.map(m => m[1]);

    try {
      const resp = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          author: 'dante',
          author_type: 'human',
          mentions: mentions.length > 0 ? mentions : undefined,
        }),
      });
      if (!resp.ok) throw new Error('Failed to post comment');
      const newComment = await resp.json();
      setComments(prev => [newComment, ...prev]);
      setBody('');
      setMentionedAgents([]);
      textareaRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e) => {
    // Don't intercept keys if mention dropdown is open
    if (mentionQuery !== null && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab')) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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
            No comments yet. Type @ to mention an agent.
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
                  {c.mentions && c.mentions.length > 0 && (
                    <span style={{ fontSize: 9, color: '#2E7D32', fontWeight: 500 }}>
                      → {c.mentions.join(', ')}
                    </span>
                  )}
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
                  >{renderBodyWithMentions(c.body)}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input with @mention dropdown */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
        <AgentMentionDropdown
          query={mentionQuery}
          onSelect={handleAgentSelect}
          onClose={() => { setMentionQuery(null); setMentionStart(null); }}
          inputRef={textareaRef}
        />
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment… @ to mention an agent (Shift+Enter for newline)"
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
      {/* Mention badges */}
      {mentionedAgents.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: -4 }}>
          {mentionedAgents.map(a => (
            <span key={a.id} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 12,
              background: 'rgba(46, 125, 50, 0.1)', color: '#2E7D32',
              fontWeight: 500,
            }}>
              🤖 {a.id}
            </span>
          ))}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#BA1A1A', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> {error}
          <button
            onClick={() => { setError(null); setLoading(true); fetchComments(); }}
            style={{
              marginLeft: 8, padding: '2px 10px', borderRadius: 100, border: '1px solid #BA1A1A',
              background: 'transparent', color: '#BA1A1A', fontSize: 11, cursor: 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >Retry</button>
        </div>
      )}
    </div>
  );
}
