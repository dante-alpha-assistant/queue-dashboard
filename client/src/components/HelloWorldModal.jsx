import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function HelloWorldModal({ onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--md-surface)', borderRadius: 16, padding: '32px 40px',
          textAlign: 'center', maxWidth: 400, minWidth: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
              color: 'var(--md-on-surface-variant)', padding: 4, display: 'flex',
              borderRadius: 8,
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <h2 style={{
          margin: '0 0 16px', color: 'var(--md-on-surface)',
          fontSize: 24, fontWeight: 700,
        }}>
          Hello World
        </h2>
        <button
          onClick={onClose}
          style={{
            padding: '8px 24px', borderRadius: 20, border: 'none',
            background: 'var(--md-primary)', color: 'var(--md-on-primary)',
            cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
