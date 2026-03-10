import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, Unlock } from 'lucide-react';

/**
 * HumanInterventionForm — renders a dynamic form for blocked tasks
 * based on metadata.blocker.required_inputs schema.
 *
 * Expected blocker shape:
 * {
 *   type: "missing_credential" | "ambiguous_requirement" | "human_decision" | "external_dependency" | string,
 *   title: "Need API key for service X",
 *   description: "The agent cannot proceed without...",
 *   suggested_action: "Provide the API key below",
 *   required_inputs: [
 *     { key: "api_key", label: "API Key", type: "password", placeholder: "sk-...", required: true },
 *     { key: "region", label: "Region", type: "select", options: ["us-east-1", "eu-west-1"], required: true },
 *     { key: "notes", label: "Additional notes", type: "textarea", required: false },
 *   ]
 * }
 */

const BLOCKER_TYPE_CONFIG = {
  missing_credential: { color: '#D32F2F', bg: '#D32F2F0A', border: '#D32F2F25', icon: '🔑', label: 'Missing Credential' },
  ambiguous_requirement: { color: '#E65100', bg: '#E651000A', border: '#E6510025', icon: '❓', label: 'Needs Clarification' },
  human_decision: { color: '#6750A4', bg: '#6750A40A', border: '#6750A425', icon: '🧑‍⚖️', label: 'Decision Required' },
  external_dependency: { color: '#00838F', bg: '#00838F0A', border: '#00838F25', icon: '🔗', label: 'External Dependency' },
  approval_needed: { color: '#1565C0', bg: '#1565C00A', border: '#1565C025', icon: '✋', label: 'Approval Needed' },
};
const DEFAULT_TYPE_CONFIG = { color: '#E65100', bg: '#E651000A', border: '#E6510025', icon: '🚫', label: 'Blocked' };

function InputField({ input, value, onChange }) {
  const baseStyle = {
    width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
    border: '1px solid var(--md-surface-variant, #E7E0EC)',
    background: 'var(--md-surface, #FFFBFE)',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif", outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const handleFocus = e => e.target.style.borderColor = 'var(--md-primary, #6750A4)';
  const handleBlur = e => e.target.style.borderColor = 'var(--md-surface-variant, #E7E0EC)';

  switch (input.type) {
    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={e => onChange(input.key, e.target.value)}
          placeholder={input.placeholder || ''}
          rows={4}
          style={{ ...baseStyle, resize: 'vertical', minHeight: 80 }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      );
    case 'select':
      return (
        <select
          value={value || ''}
          onChange={e => onChange(input.key, e.target.value)}
          style={{ ...baseStyle, cursor: 'pointer' }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          <option value="">{input.placeholder || 'Select...'}</option>
          {(input.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'password':
      return (
        <input
          type="password"
          value={value || ''}
          onChange={e => onChange(input.key, e.target.value)}
          placeholder={input.placeholder || ''}
          style={{ ...baseStyle, fontFamily: "'Roboto Mono', monospace" }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      );
    default: // text
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(input.key, e.target.value)}
          placeholder={input.placeholder || ''}
          style={baseStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      );
  }
}

export default function HumanInterventionForm({ task, onStatusChange, onClose }) {
  const blocker = task.metadata?.blocker;
  const blockedReason = task.blocked_reason;
  const [values, setValues] = useState({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // If no blocker metadata, show a simple unblock form with comment
  const hasBlocker = !!blocker;
  const blockerType = blocker?.type || 'unknown';
  const typeConfig = BLOCKER_TYPE_CONFIG[blockerType] || DEFAULT_TYPE_CONFIG;
  const requiredInputs = blocker?.required_inputs || [];
  const needsComment = ['ambiguous_requirement', 'human_decision'].includes(blockerType) || requiredInputs.length === 0;

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const isValid = () => {
    if (requiredInputs.length > 0) {
      return requiredInputs
        .filter(i => i.required !== false)
        .every(i => values[i.key]?.trim());
    }
    // For comment-only forms, require at least a comment
    return comment.trim().length > 0;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tasks/${task.id}/intervene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provided_values: requiredInputs.length > 0 ? values : undefined,
          human_response: comment.trim() || undefined,
          changed_by: 'dashboard',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Intervention failed');
      setSuccess(true);
      // Refresh parent
      if (onStatusChange) await onStatusChange(task.id, {});
      setTimeout(() => { if (onClose) onClose(); }, 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{
        padding: '20px 16px', borderRadius: 12, textAlign: 'center',
        background: '#1B5E200A', border: '1px solid #1B5E2025',
      }}>
        <span style={{ fontSize: 32 }}><CheckCircle2 size={14} /></span>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1B5E20', marginTop: 8 }}>
          Input provided — task unblocked
        </div>
        <div style={{ fontSize: 12, color: 'var(--md-outline, #79747E)', marginTop: 4 }}>
          The task has been moved back to the queue for an agent to pick up.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${typeConfig.border}`,
      background: typeConfig.bg,
    }}>
      {/* Banner */}
      <div style={{
        padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
        borderBottom: `1px solid ${typeConfig.border}`,
        background: `${typeConfig.color}08`,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.2 }}>{typeConfig.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: typeConfig.color,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              background: `${typeConfig.color}14`, padding: '2px 8px', borderRadius: 100,
            }}>
              {typeConfig.label}
            </span>
          </div>
          {blocker?.title && (
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--md-on-surface, #1C1B1F)', marginBottom: 4 }}>
              {blocker.title}
            </div>
          )}
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--md-on-surface-variant, #49454F)' }}>
            {blocker?.description || blockedReason || 'This task is blocked and requires human intervention.'}
          </div>
          {blocker?.suggested_action && (
            <div style={{
              marginTop: 8, fontSize: 12, color: typeConfig.color, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span><Lightbulb size={14} /></span> {blocker.suggested_action}
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div style={{ padding: '16px' }}>
        {requiredInputs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {requiredInputs.map(input => (
              <div key={input.key}>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 600,
                  color: 'var(--md-on-surface, #1C1B1F)', marginBottom: 5,
                  letterSpacing: '0.02em',
                }}>
                  {input.label || input.key}
                  {input.required !== false && <span style={{ color: '#D32F2F', marginLeft: 2 }}>*</span>}
                </label>
                {input.description && (
                  <div style={{ fontSize: 11, color: 'var(--md-outline, #79747E)', marginBottom: 5, lineHeight: 1.4 }}>
                    {input.description}
                  </div>
                )}
                <InputField input={input} value={values[input.key]} onChange={handleChange} />
              </div>
            ))}
          </div>
        )}

        {/* Comment / clarification */}
        {needsComment && (
          <div style={{ marginTop: requiredInputs.length > 0 ? 14 : 0 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 600,
              color: 'var(--md-on-surface, #1C1B1F)', marginBottom: 5,
            }}>
              {blockerType === 'human_decision' ? 'Your Decision' :
               blockerType === 'ambiguous_requirement' ? 'Clarification' :
               'Response / Instructions'}
              {requiredInputs.length === 0 && <span style={{ color: '#D32F2F', marginLeft: 2 }}>*</span>}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                blockerType === 'human_decision' ? 'Describe your decision...' :
                blockerType === 'ambiguous_requirement' ? 'Provide the clarification needed...' :
                'Provide instructions or context to unblock this task...'
              }
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--md-surface-variant, #E7E0EC)',
                background: 'var(--md-surface, #FFFBFE)',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif", outline: 'none',
                boxSizing: 'border-box', resize: 'vertical',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--md-primary, #6750A4)'}
              onBlur={e => e.target.style.borderColor = 'var(--md-surface-variant, #E7E0EC)'}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: '#D32F2F0A', border: '1px solid #D32F2F25',
            fontSize: 12, color: '#D32F2F',
          }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || !isValid()}
            style={{
              border: 'none', padding: '10px 20px', borderRadius: 100,
              fontWeight: 600, fontSize: 13, cursor: submitting || !isValid() ? 'not-allowed' : 'pointer',
              background: submitting || !isValid() ? 'var(--md-outline-variant, #CAC4D0)' : '#1B5E20',
              color: '#fff', transition: 'all 0.15s',
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: submitting || !isValid() ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <>
                <span style={{
                  display: 'inline-block', width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                  borderRadius: '50%', animation: 'tdm-spin 0.6s linear infinite',
                }} />
                Submitting…
              </>
            ) : (
              <><Unlock size={14} /> Provide & Unblock</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
