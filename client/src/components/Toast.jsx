import { useState, useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

// Module-level listener registry — allows showToast() to work from anywhere
const _listeners = [];
let _nextId = 0;

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'} type
 * @param {number} durationMs
 */
export function showToast(message, type = "success", durationMs = 3500) {
  const toast = { id: ++_nextId, message, type, durationMs };
  _listeners.forEach((fn) => fn(toast));
}

/**
 * Mount this once near the app root (e.g. in App.jsx).
 * Renders toasts in a fixed overlay — no portal needed.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.durationMs);
    };
    _listeners.push(handler);
    return () => {
      const idx = _listeners.indexOf(handler);
      if (idx > -1) _listeners.splice(idx, 1);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: toast.type === "error" ? "#BA1A1A" : "#1B5E20",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            whiteSpace: "nowrap",
            animation: "toastSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {toast.type === "error" ? (
            <XCircle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {toast.message}
        </div>
      ))}
      <style>{`
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
