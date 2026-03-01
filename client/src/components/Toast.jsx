import { useState, useEffect, useCallback } from 'react';

const TOAST_STYLES = {
  error: { bg: '#BA1A1A', color: '#fff', icon: '✕' },
  success: { bg: '#386A20', color: '#fff', icon: '✓' },
  info: { bg: '#6750A4', color: '#fff', icon: 'ℹ' },
};

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), toast.duration || 4000);
    const t2 = setTimeout(() => onRemove(toast.id), (toast.duration || 4000) + 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast, onRemove]);

  return (
    <div style={{
      background: style.bg, color: style.color,
      padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 500,
      fontFamily: "'Roboto', system-ui, sans-serif",
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      opacity: exiting ? 0 : 1,
      transform: exiting ? 'translateY(10px)' : 'translateY(0)',
      transition: 'opacity 300ms ease, transform 300ms ease',
      maxWidth: 360,
    }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{style.icon}</span>
      <span>{toast.message}</span>
    </div>
  );
}

let _addToast = null;
let _nextId = 0;

export function showToast(message, type = 'info', duration = 4000) {
  _addToast?.({ id: ++_nextId, message, type, duration });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  _addToast = useCallback((t) => setToasts(prev => [...prev, t]), []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
    }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={remove} />)}
    </div>
  );
}
