import { useEffect, useCallback } from "react";

/**
 * Full-size image modal overlay.
 * Props:
 *  - src: image URL to display
 *  - onClose: callback to close the modal
 */
export default function ImageModal({ src, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!src) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        cursor: "zoom-out",
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.15)",
          border: "none",
          borderRadius: "50%",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
      <img
        src={src}
        alt="Full size"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: 8,
          cursor: "default",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}
