import { useState, useCallback, useRef, useEffect } from "react";
import { Image, Paperclip, Upload, X, ZoomIn } from "lucide-react";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Lightbox overlay ──────────────────────────────── */
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.15)", border: "none",
          color: "#fff", width: 36, height: 36, borderRadius: "50%",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, backdropFilter: "blur(4px)",
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}

/* ── Attachment thumbnail ──────────────────────────── */
function AttachmentThumb({ attachment, index, onDelete, readonly }) {
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <div
        style={{
          position: "relative", width: 80, height: 80, borderRadius: 8,
          overflow: "hidden", border: "1px solid var(--md-surface-variant, #E7E0EC)",
          cursor: "pointer", flexShrink: 0, background: "var(--md-surface-container-low, #F7F2FA)",
        }}
        onClick={() => setLightbox(true)}
      >
        <img
          src={attachment.url}
          alt={attachment.filename}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        <div
          style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
            transition: "background 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.3)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
        >
          <ZoomIn size={18} style={{ color: "#fff", opacity: 0 }} className="thumb-zoom-icon" />
        </div>
        {!readonly && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
            style={{
              position: "absolute", top: 2, right: 2,
              width: 18, height: 18, borderRadius: "50%",
              background: "rgba(186,26,26,0.85)", border: "none",
              color: "#fff", cursor: "pointer", fontSize: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, padding: 0,
            }}
            title="Remove attachment"
          >
            <X size={10} />
          </button>
        )}
      </div>
      {lightbox && <Lightbox src={attachment.url} alt={attachment.filename} onClose={() => setLightbox(false)} />}
    </>
  );
}

/* ── Upload drop zone ──────────────────────────────── */
function UploadZone({ taskId, onUploaded, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const dragCounter = useRef(0);

  const upload = useCallback(async (files) => {
    setError(null);
    setUploading(true);
    const errors = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: unsupported format`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        errors.push(`${file.name}: too large (max 10MB)`);
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        const resp = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64, filename: file.name, type: file.type }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          errors.push(`${file.name}: ${err.error || resp.statusText}`);
        } else {
          const result = await resp.json();
          onUploaded?.(result.attachment);
        }
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    if (errors.length) setError(errors.join("; "));
    setUploading(false);
  }, [taskId, onUploaded]);

  // Paste handler
  useEffect(() => {
    const onPaste = (e) => {
      const files = [];
      if (e.clipboardData?.files) {
        for (const f of e.clipboardData.files) {
          if (f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        upload(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [upload]);

  return (
    <div>
      <div
        onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault(); dragCounter.current = 0; setDragging(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
          if (files.length) upload(files);
        }}
        onClick={() => !disabled && !uploading && fileRef.current?.click()}
        style={{
          padding: "14px 16px", borderRadius: 10,
          border: `2px dashed ${dragging ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant, #E7E0EC)"}`,
          background: dragging ? "rgba(103,80,164,0.06)" : "var(--md-surface-container-low, #F7F2FA)",
          cursor: disabled || uploading ? "default" : "pointer",
          textAlign: "center", transition: "all 0.15s",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {uploading ? (
          <div style={{ fontSize: 13, color: "var(--md-primary, #6750A4)", fontWeight: 500 }}>
            Uploading...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <Upload size={18} style={{ color: "var(--md-outline, #79747E)" }} />
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant, #49454F)" }}>
              Drop images, paste, or <span style={{ color: "var(--md-primary, #6750A4)", fontWeight: 600 }}>browse</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--md-outline, #79747E)" }}>
              PNG, JPG, GIF, WebP · Max 10MB
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) upload(files);
          e.target.value = "";
        }}
      />
      {error && (
        <div style={{ fontSize: 11, color: "#BA1A1A", marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────── */
export default function TaskAttachments({ taskId, attachments: initialAttachments, onAttachmentsChange, readonly }) {
  const [attachments, setAttachments] = useState(initialAttachments || []);

  useEffect(() => {
    setAttachments(initialAttachments || []);
  }, [initialAttachments]);

  const handleUploaded = useCallback((attachment) => {
    setAttachments((prev) => {
      const next = [...prev, attachment];
      onAttachmentsChange?.(next);
      return next;
    });
  }, [onAttachmentsChange]);

  const handleDelete = useCallback(async (index) => {
    try {
      const resp = await fetch(`/api/tasks/${taskId}/attachments/${index}`, { method: "DELETE" });
      if (resp.ok) {
        setAttachments((prev) => {
          const next = prev.filter((_, i) => i !== index);
          onAttachmentsChange?.(next);
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to delete attachment:", e);
    }
  }, [taskId, onAttachmentsChange]);

  return (
    <div>
      {/* Thumbnails */}
      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {attachments.map((a, i) => (
            <AttachmentThumb key={a.url || i} attachment={a} index={i} onDelete={handleDelete} readonly={readonly} />
          ))}
        </div>
      )}

      {/* Upload zone */}
      {!readonly && <UploadZone taskId={taskId} onUploaded={handleUploaded} />}

      {/* Empty state */}
      {attachments.length === 0 && readonly && (
        <div style={{ padding: 16, textAlign: "center", color: "var(--md-outline, #79747E)", fontSize: 13, fontStyle: "italic" }}>
          No attachments
        </div>
      )}
    </div>
  );
}

/* ── Indicator icon for task cards ──────────────────── */
export function AttachmentIndicator({ count }) {
  if (!count) return null;
  return (
    <span
      title={`${count} attachment${count > 1 ? "s" : ""}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 10, color: "var(--md-outline, #79747E)",
        padding: "1px 5px", borderRadius: 6,
        background: "var(--md-surface-container-low, #F7F2FA)",
      }}
    >
      <Paperclip size={10} />
      {count}
    </span>
  );
}
