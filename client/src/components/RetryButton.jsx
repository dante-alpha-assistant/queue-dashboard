import { useState } from 'react';
import { showToast } from './Toast';

const SPINNER_KEYFRAMES = `
@keyframes retry-spin {
  to { transform: rotate(360deg); }
}
`;

function Spinner({ size = 14, color = '#fff' }) {
  return (
    <>
      <style>{SPINNER_KEYFRAMES}</style>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'retry-spin 0.8s linear infinite' }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.3" />
        <path d="M12 2a10 10 0 019.8 8" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </>
  );
}

function CheckIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const RetryIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 105.64-12.48L1 10" />
  </svg>
);

/**
 * RetryButton — handles loading spinner, success feedback, and error toasts.
 * @param {object} props
 * @param {function} props.onRetry - async function to call. Receives (taskId, updates).
 * @param {string} props.taskId
 * @param {object} props.updates - status change payload
 * @param {object} props.style - button style
 * @param {string} [props.className]
 * @param {boolean} [props.stopPropagation]
 * @param {number} [props.iconSize]
 */
export default function RetryButton({ onRetry, taskId, updates, style, className, stopPropagation = false, iconSize = 14 }) {
  const [state, setState] = useState('idle'); // idle | loading | success

  const handleClick = async (e) => {
    if (stopPropagation) e.stopPropagation();
    if (state !== 'idle') return;

    setState('loading');
    try {
      await onRetry(taskId, updates);
      setState('success');
      const isNewTask = updates.status === 'todo' || updates.status === 'assigned';
      showToast(isNewTask ? 'Task retried — moved to queue' : 'Retried successfully', 'success', 2500);
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      setState('idle');
      showToast(err?.message || 'Retry failed — please try again', 'error');
    }
  };

  const successStyle = state === 'success' ? { background: '#386A20' } : {};

  return (
    <button
      className={className}
      onClick={handleClick}
      disabled={state !== 'idle'}
      style={{
        ...style,
        ...successStyle,
        opacity: state === 'loading' ? 0.85 : 1,
        cursor: state === 'idle' ? 'pointer' : 'default',
      }}
    >
      {state === 'loading' && <Spinner size={iconSize} />}
      {state === 'success' && <CheckIcon size={iconSize} />}
      {state === 'idle' && <RetryIcon size={iconSize} />}
      {state === 'loading' ? 'Retrying…' : state === 'success' ? 'Retried' : 'Retry'}
    </button>
  );
}
