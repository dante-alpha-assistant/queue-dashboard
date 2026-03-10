import { useState, useEffect, useRef, useCallback } from "react";
import ImageModal from "./ImageModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { AlertTriangle, Lightbulb, MessageSquare, Paperclip } from 'lucide-react';
import TaskMentionDropdown from "./TaskMentionDropdown";

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function renderText(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line}
    </span>
  ));
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1536; // Max width/height for resizing (keeps quality, reduces payload)
const JPEG_QUALITY = 0.85;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress/resize an image file to a reasonable size for vision API.
 * Returns a base64 data URL (JPEG for photos, PNG for small images).
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    // GIFs: skip compression to preserve animation
    if (file.type === "image/gif") {
      return fileToBase64(file).then(resolve, reject);
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Use JPEG for photos (smaller), PNG if image has transparency
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputType === "image/jpeg" ? JPEG_QUALITY : undefined;
      resolve(canvas.toDataURL(outputType, quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback to raw base64 if canvas fails
      fileToBase64(file).then(resolve, reject);
    };
    img.src = url;
  });
}

function extractImages(dataTransfer) {
  const files = [];
  if (dataTransfer?.files) {
    for (const file of dataTransfer.files) {
      if (file.type.startsWith("image/")) {
        files.push(file);
      }
    }
  }
  return files;
}

function renderContent(content) {
  if (typeof content === "string") return renderText(content);
  if (!Array.isArray(content)) return null;
  return content.map((part, i) => {
    if (part.type === "text") return <span key={i}>{renderText(part.text)}</span>;
    if (part.type === "image_url") {
      return (
        <img key={i} src={part.image_url?.url} alt="uploaded" onClick={() => window.__openImageModal?.(part.image_url?.url)}
          style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginTop: 4, marginBottom: 4, display: "block", cursor: "zoom-in" }} />
      );
    }
    return null;
  });
}

/* Neo avatar component */
function NeoAvatar({ size = 24 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, #6750A4, #7B68EE)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.5, color: "#fff", fontWeight: 700,
    }}>N</div>
  );
}

/* Header icon button */
// SVG icon components for chat header toolbar
const ChatIcons = {
  newChat: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  ),
  history: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  clear: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
  ),
  expand: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  ),
  collapse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

function HeaderIconBtn({ icon, title, onClick, active, badge }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        background: active ? "rgba(103, 80, 164, 0.12)" : "none",
        border: "none",
        color: active ? "var(--md-primary, #6750A4)" : "var(--md-on-surface-variant)",
        fontSize: 15,
        cursor: "pointer",
        width: 36, height: 36,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 8,
        transition: "background 150ms, color 150ms",
        position: "relative",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--md-surface-container)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none"; }}
    >
      {icon}
      {badge > 0 && (
        <span style={{
          position: "absolute", top: 2, right: 2,
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--md-primary, #6750A4)",
        }} />
      )}
    </button>
  );
}

/* Inline history view — replaces message container */
function HistoryView({ conversations, activeConvoId, onSelect, onDelete, onClose }) {
  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      {/* History header bar */}
      <div style={{
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--md-surface-variant)",
        position: "sticky", top: 0, background: "var(--md-background)", zIndex: 2,
      }}>
        <button onClick={onClose} title="Back to chat" style={{
          background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
          borderRadius: 8, color: "var(--md-on-surface-variant)", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 150ms",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-on-surface)" }}>
          Conversations
        </span>
        <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginLeft: "auto" }}>
          {conversations.length} total
        </span>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {conversations.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--md-on-surface-variant)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 13 }}>No conversations yet</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>Start a new chat to get going</div>
          </div>
        )}
        {conversations.map(c => {
          const isActive = c.id === activeConvoId;
          const preview = c.title || c.first_message || "New conversation";
          const msgCount = c.message_count || 0;
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="history-item"
              style={{
                padding: "14px 16px", cursor: "pointer",
                borderBottom: "1px solid rgba(0,0,0,0.04)",
                background: isActive ? "rgba(103, 80, 164, 0.08)" : "transparent",
                display: "flex", alignItems: "center", gap: 12,
                transition: "background 150ms",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
              onMouseLeave={e => e.currentTarget.style.background = isActive ? "rgba(103, 80, 164, 0.08)" : "transparent"}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: isActive ? "linear-gradient(135deg, #6750A4, #7B68EE)" : "var(--md-surface-container)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isActive ? "#fff" : "var(--md-on-surface-variant)", fontSize: 14,
              }}>
                <MessageSquare size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  color: "var(--md-on-surface)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{preview}</div>
                <div style={{
                  fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 3,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>{timeAgo(c.updated_at)}</span>
                  {msgCount > 0 && <span>· {msgCount} message{msgCount !== 1 ? "s" : ""}</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(c.id, e); }}
                title="Delete"
                className="history-delete-btn"
                style={{
                  background: "none", border: "none", fontSize: 14, cursor: "pointer",
                  color: "var(--md-on-surface-variant)", padding: "6px 8px", borderRadius: 8,
                  opacity: 0, transition: "opacity 150ms, background 150ms",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(179,38,30,0.08)"; e.currentTarget.style.color = "var(--md-error, #B3261E)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--md-on-surface-variant)"; }}
              >🗑</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const markdownComponents = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  p: ({ node, ...props }) => <p {...props} style={{ margin: "0 0 8px 0" }} />,
  ul: ({ node, ...props }) => <ul {...props} style={{ margin: "4px 0", paddingLeft: 20 }} />,
  ol: ({ node, ...props }) => <ol {...props} style={{ margin: "4px 0", paddingLeft: 20 }} />,
  li: ({ node, ...props }) => <li {...props} style={{ marginBottom: 2 }} />,
  code: ({ node, inline, className, children, ...props }) => {
    if (inline) {
      return <code style={{
        background: "rgba(0,0,0,0.08)", padding: "2px 5px", borderRadius: 4, fontSize: 12,
      }} {...props}>{children}</code>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
  pre: ({ node, ...props }) => <pre {...props} style={{
    background: "rgba(0,0,0,0.08)", padding: 10, borderRadius: 8,
    overflow: "auto", fontSize: 12, margin: "6px 0",
  }} />,
};

function renderMarkdownText(text) {
  if (!text) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
}

function renderMarkdownContent(content) {
  if (typeof content === "string") return renderMarkdownText(content);
  if (!Array.isArray(content)) return null;
  return content.map((part, i) => {
    if (part.type === "text") return <span key={i}>{renderMarkdownText(part.text)}</span>;
    if (part.type === "image_url") {
      return (
        <img key={i} src={part.image_url?.url} alt="uploaded" onClick={() => window.__openImageModal?.(part.image_url?.url)}
          style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginTop: 4, marginBottom: 4, display: "block", cursor: "zoom-in" }}
        />
      );
    }
    return null;
  });
}

export default function NewTaskChat({ isMobile }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem("neo-chat-expanded") === "true"; } catch { return false; }
  });
  const [animating, setAnimating] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  useEffect(() => { window.__openImageModal = setModalImage; return () => { delete window.__openImageModal; }; }, []);
  const [dragging, setDragging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed, string = open with query
  const [mentionStart, setMentionStart] = useState(null); // cursor position of the @ character
  const [taskMentions, setTaskMentions] = useState([]); // [{id, title, ...}] attached to current message

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const loadAbortRef = useRef(null);
  const headerRef = useRef(null);
  const skipConvoLoadRef = useRef(false);

  const toggleExpanded = useCallback(() => {
    setAnimating(true);
    setExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem("neo-chat-expanded", String(next)); } catch {}
      return next;
    });
    setTimeout(() => setAnimating(false), 350);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const resp = await fetch("/api/neo-chat/conversations");
      if (!resp.ok) {
        console.error("Failed to load conversations:", resp.status);
        setError("Failed to load conversations. The chat service may be unavailable.");
        return;
      }
      const data = await resp.json();
      if (Array.isArray(data)) setConversations(data);
    } catch (e) {
      console.error("Failed to load conversations:", e);
      setError("Failed to connect to chat service.");
    }
  }, []);

  const loadMessages = useCallback(async (convoId) => {
    if (!convoId) return;
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setLoadingMessages(true);
    try {
      const resp = await fetch(`/api/neo-chat/conversations/${convoId}/messages`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!resp.ok) {
        console.error("Failed to load messages:", resp.status);
        setError("Failed to load messages.");
        setLoadingMessages(false);
        return;
      }
      const data = await resp.json();
      if (controller.signal.aborted) return;
      if (Array.isArray(data)) {
        setMessages(data.map(m => {
          // Reconstruct multipart content if images stored in metadata
          let content = m.content;
          if (m.role === "user" && m.metadata?.images?.length) {
            const parts = [];
            if (m.content) parts.push({ type: "text", text: m.content });
            for (const url of m.metadata.images) {
              parts.push({ type: "image_url", image_url: { url } });
            }
            content = parts;
          }
          return { role: m.role, content, time: m.created_at, id: m.id };
        }));
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Failed to load messages:", e);
      setError("Failed to load messages.");
    }
    if (!controller.signal.aborted) setLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (open) loadConversations();
  }, [open, loadConversations]);

  useEffect(() => {
    if (activeConvoId) {
      // Skip wiping messages when we just created this conversation in send() —
      // the optimistic user message + assistant placeholder are already in state.
      if (skipConvoLoadRef.current) {
        skipConvoLoadRef.current = false;
        return;
      }
      setMessages([]);
      setLoadingMessages(true);
      loadMessages(activeConvoId);
    } else {
      setMessages([]);
      setLoadingMessages(false);
    }
  }, [activeConvoId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const addImages = useCallback(async (files) => {
    const newImages = [];
    const errors = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: unsupported format (use PNG, JPG, GIF, or WebP)`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
        continue;
      }
      try {
        const dataUrl = await compressImage(file);
        // Upload immediately to get a permanent URL
        try {
          const uploadResp = await fetch('/api/neo-chat/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl, filename: file.name }),
          });
          if (uploadResp.ok) {
            const uploadData = await uploadResp.json();
            newImages.push({ dataUrl, name: file.name, uploadedUrl: uploadData.url });
          } else {
            // Fallback: keep base64 if upload fails
            newImages.push({ dataUrl, name: file.name });
          }
        } catch {
          newImages.push({ dataUrl, name: file.name });
        }
      } catch (e) {
        errors.push(`${file.name}: failed to read`);
      }
    }
    if (errors.length) setError(errors.join("; "));
    if (newImages.length) setPendingImages(prev => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((index) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePaste = (e) => {
      const files = extractImages(e.clipboardData);
      if (files.length) { e.preventDefault(); addImages(files); }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, addImages]);

  const newConversation = useCallback(async () => {
    setActiveConvoId(null);
    setMessages([]);
    setPendingImages([]);
    setError(null);
    setHistoryOpen(false);
    inputRef.current?.focus();
  }, []);

  const clearConversation = useCallback(() => {
    setActiveConvoId(null);
    setMessages([]);
    setPendingImages([]);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const deleteConversation = useCallback(async (id, e) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/neo-chat/conversations/${id}`, { method: "DELETE" });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConvoId === id) {
        setActiveConvoId(null);
        setMessages([]);
      }
    } catch {}
  }, [activeConvoId]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImages.length) || streaming) return;

    let convoId = activeConvoId;
    if (!convoId) {
      try {
        const resp = await fetch("/api/neo-chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          setError(`Failed to create conversation: ${errData.error || resp.statusText}`);
          return;
        }
        const convo = await resp.json();
        if (convo?.id) {
          convoId = convo.id;
          setConversations(prev => [convo, ...prev]);
          skipConvoLoadRef.current = true;
          setActiveConvoId(convoId);
        } else {
          setError("Failed to create conversation: unexpected response");
          return;
        }
      } catch (e) {
        setError(`Failed to create conversation: ${e.message}`);
        return;
      }
    }

    setError(null);
    const content = text;
    // Prefer uploaded URLs (permanent) over base64 data URLs
    const imageUrls = pendingImages.map(img => img.uploadedUrl || img.dataUrl);

    // Collect task mention IDs referenced in this message
    const mentionedTaskIds = taskMentions
      .filter(t => text.includes(`@[${t.title}]`))
      .map(t => t.id);

    // Build user message content: include images as multipart array if present
    let userContent;
    if (imageUrls.length) {
      const parts = [];
      if (content) parts.push({ type: "text", text: content });
      for (const url of imageUrls) {
        parts.push({ type: "image_url", image_url: { url } });
      }
      userContent = parts;
    } else {
      userContent = content;
    }

    const userMsg = { role: "user", content: userContent, time: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImages([]);
    setTaskMentions([]);
    setMentionQuery(null);
    setMentionStart(null);
    setStreaming(true);

    const assistantMsg = { role: "assistant", content: "", time: new Date().toISOString() };
    setMessages([...newMessages, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(`/api/neo-chat/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          images: imageUrls.length ? imageUrls : undefined,
          taskMentions: mentionedTaskIds.length ? mentionedTaskIds : undefined,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${err.error || resp.statusText}` };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              // Handle \r as "clear last line" (used by server during tool execution)
              if (delta === "\r") {
                // Remove the last line (e.g., "⏳ Creating task...")
                const lastNewline = accumulated.lastIndexOf("\n\n");
                if (lastNewline >= 0) accumulated = accumulated.slice(0, lastNewline);
              } else {
                accumulated += delta;
              }
              const acc = accumulated;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: acc };
                return updated;
              });
            }
          } catch {}
        }
      }

      if (!accumulated) {
        setMessages(prev => {
          const updated = [...prev];
          if (!updated[updated.length - 1].content) {
            updated[updated.length - 1].content = "_(Neo is thinking... response may arrive shortly)_";
          }
          return updated;
        });
      }

      loadConversations();
    } catch (e) {
      if (e.name !== "AbortError") {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Connection error: ${e.message}` };
          return updated;
        });
      }
    }

    abortRef.current = null;
    setStreaming(false);
  }, [input, streaming, messages, activeConvoId, pendingImages, loadConversations]);

  // Detect @mention in input
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart;
    // Look backwards from cursor to find an unmatched @
    const textBeforeCursor = val.slice(0, cursor);
    // Find last @ that isn't part of a resolved mention (@[Task Title])
    let lastAt = -1;
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      if (textBeforeCursor[i] === "@") {
        // Skip if followed by [ (resolved mention)
        if (textBeforeCursor[i + 1] === "[") continue;
        lastAt = i;
        break;
      }
    }

    if (lastAt >= 0) {
      const charBefore = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if ((charBefore === " " || charBefore === "\n" || lastAt === 0) && !textAfterAt.includes("\n")) {
        setMentionQuery(textAfterAt);
        setMentionStart(lastAt);
        return;
      }
    }
    setMentionQuery(null);
    setMentionStart(null);
  }, []);

  const handleMentionSelect = useCallback((task) => {
    // Replace @query with @[Task Title]
    const before = input.slice(0, mentionStart);
    const after = input.slice(inputRef.current?.selectionStart || input.length);
    const mentionText = `@[${task.title}] `;
    setInput(before + mentionText + after);
    setMentionQuery(null);
    setMentionStart(null);
    setTaskMentions(prev => {
      if (prev.find(t => t.id === task.id)) return prev;
      return [...prev, task];
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input, mentionStart]);

  const handleMentionClose = useCallback(() => {
    setMentionQuery(null);
    setMentionStart(null);
  }, []);

  const handleKey = (e) => {
    // Don't send on Enter if mention dropdown is open
    if (mentionQuery !== null && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab")) return;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer?.types?.includes("Files")) setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragging(false); const files = extractImages(e.dataTransfer); if (files.length) addImages(files); };
  const handleFileSelect = (e) => { const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/")); if (files.length) addImages(files); e.target.value = ""; };

  // FAB button
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Chat with Neo to create a task"
        style={{
          position: "fixed",
          bottom: isMobile ? 80 : 24,
          right: isMobile ? 16 : 24,
          height: 48,
          paddingLeft: 16,
          paddingRight: 18,
          borderRadius: 24,
          background: "linear-gradient(135deg, #6750A4 0%, #7B68EE 100%)",
          border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", zIndex: 1000,
          color: "#fff", display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 16px rgba(103, 80, 164, 0.4)", transition: "transform 150ms, box-shadow 150ms",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
        onMouseEnter={e => { e.target.style.transform = "scale(1.05)"; e.target.style.boxShadow = "0 6px 20px rgba(103, 80, 164, 0.5)"; }}
        onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 16px rgba(103, 80, 164, 0.4)"; }}
      >
        <span style={{ fontSize: 18 }}>✨</span>
        <span>New Task</span>
      </button>
    );
  }

  const containerStyle = isMobile
    ? { position: "fixed", inset: 0, background: "var(--md-background)", zIndex: 1001, display: "flex", flexDirection: "column" }
    : expanded
    ? {
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: "var(--md-background)", zIndex: 1001,
        display: "flex", flexDirection: "column",
        borderLeft: "1px solid var(--md-surface-variant)",
        boxShadow: "-4px 0 32px rgba(0,0,0,0.12)",
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        transform: animating ? "translateX(10px)" : "translateX(0)",
      }
    : {
        position: "fixed", bottom: 24, right: 24, width: 420, height: 560,
        background: "var(--md-background)", borderRadius: 20,
        border: "1px solid var(--md-surface-variant)", zIndex: 1001,
        display: "flex", flexDirection: "column",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)", overflow: "hidden",
        transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      };

  const hasInput = input.trim() || pendingImages.length > 0;

  return (
    <div style={containerStyle} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Inject hover styles for history delete buttons */}
      <style>{`
        .history-item:hover .history-delete-btn { opacity: 1 !important; }
        @keyframes typingDot {
          0%, 20% { opacity: 0.2; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0.2; }
        }
      `}</style>

      {/* Drop zone overlay */}
      {dragging && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(103, 80, 164, 0.15)", border: "3px dashed var(--md-primary, #6750A4)", borderRadius: isMobile ? 0 : 20, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "var(--md-surface, #fff)", padding: "20px 32px", borderRadius: 16, textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)" }}>Drop image here</div>
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 4 }}>PNG, JPG, GIF, WebP</div>
          </div>
        </div>
      )}

      {/* Header — clean, icon-based */}
      <div ref={headerRef} style={{
        padding: "10px 12px 10px 16px",
        borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NeoAvatar size={28} />
          <div>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-on-surface)" }}>Neo</span>
            <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 0 }}>Task assistant</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <HeaderIconBtn icon={ChatIcons.newChat} title="New chat" onClick={newConversation} />
          <HeaderIconBtn
            icon={ChatIcons.history}
            title="History"
            onClick={() => setHistoryOpen(prev => !prev)}
            active={historyOpen}
            badge={conversations.length}
          />
          <HeaderIconBtn icon={ChatIcons.clear} title="Clear conversation" onClick={clearConversation} />
          <div style={{ width: 1, height: 18, background: "var(--md-surface-variant)", margin: "0 4px" }} />
          {!isMobile && (
            <HeaderIconBtn
              icon={expanded ? ChatIcons.collapse : ChatIcons.expand}
              title={expanded ? "Collapse to popup" : "Expand to side panel"}
              onClick={toggleExpanded}
            />
          )}
          <HeaderIconBtn icon={ChatIcons.close} title="Close" onClick={() => { setExpanded(false); setOpen(false); }} />
        </div>
      </div>

      {/* History view (inline, replaces messages) */}
      {historyOpen && (
        <HistoryView
          conversations={conversations}
          activeConvoId={activeConvoId}
          onSelect={(id) => { setActiveConvoId(id); setHistoryOpen(false); }}
          onDelete={deleteConversation}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Messages */}
      {!historyOpen && <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {loadingMessages && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--md-on-surface-variant)", fontSize: 13 }}>Loading messages...</div>
        )}
        {!loadingMessages && messages.length === 0 && !activeConvoId && (
          <div style={{ textAlign: "center", marginTop: 48, color: "var(--md-on-surface-variant)" }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>✨</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, marginBottom: 6, color: "var(--md-on-surface)" }}>Hey! I'm Neo.</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 280, margin: "0 auto", color: "var(--md-on-surface-variant)" }}>
              Tell me what you need and I'll create a task for it. You can describe features, bugs, ops work — anything.
            </div>
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 8, opacity: 0.6 }}><Paperclip size={14} /> Drag & drop or paste images</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 20, maxWidth: 260, margin: "20px auto 0" }}>
              {["Add dark mode toggle to settings", "Deploy the latest build to staging", "Research best auth libraries for Next.js"].map((suggestion, i) => (
                <button key={i} onClick={() => setInput(suggestion)}
                  style={{ padding: "8px 14px", borderRadius: 16, fontSize: 12, border: "1px solid var(--md-surface-variant)", background: "var(--md-surface)", color: "var(--md-on-surface)", cursor: "pointer", textAlign: "left", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", transition: "background 150ms" }}
                  onMouseEnter={e => e.target.style.background = "var(--md-surface-container)"}
                  onMouseLeave={e => e.target.style.background = "var(--md-surface)"}
                ><Lightbulb size={14} /> {suggestion}</button>
              ))}
            </div>
          </div>
        )}
        {!loadingMessages && messages.length === 0 && activeConvoId && (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--md-on-surface-variant)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}><MessageSquare size={14} /></div>
            <div style={{ fontSize: 13 }}>No messages yet. Start the conversation!</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          // Skip empty assistant message while streaming (typing indicator shows instead)
          if (!isUser && !msg.content && streaming && i === messages.length - 1) return null;
          return (
            <div key={msg.id || i} style={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
              alignItems: "flex-end",
              gap: 8,
              marginBottom: 8,
            }}>
              {!isUser && <NeoAvatar size={22} />}
              <div style={{
                maxWidth: "78%", padding: "8px 12px",
                borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: isUser
                  ? "linear-gradient(135deg, #6750A4, #7B68EE)"
                  : "var(--md-surface-container)",
                color: isUser ? "var(--md-on-primary)" : "var(--md-on-surface)",
                fontSize: 13, lineHeight: 1.6,
                ...(isUser ? { whiteSpace: "pre-wrap" } : {}),
                wordBreak: "break-word",
              }}>
                {!isUser && (
                  <div style={{
                    fontSize: 10, fontWeight: 600, marginBottom: 4,
                    color: "var(--md-primary)", opacity: 0.8,
                  }}>Neo</div>
                )}
                {isUser ? renderContent(msg.content) : renderMarkdownContent(msg.content)}
                <div style={{
                  fontSize: 9, marginTop: 3, textAlign: isUser ? "right" : "left",
                  color: isUser ? "rgba(255,255,255,0.5)" : "var(--md-on-surface-variant)",
                  opacity: 0.6,
                }}>
                  {msg.time ? formatTime(new Date(msg.time)) : ""}
                </div>
              </div>
            </div>
          );
        })}
        {streaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4,
          }}>
            <NeoAvatar size={22} />
            <div style={{
              padding: "8px 14px", borderRadius: "16px 16px 16px 4px",
              background: "var(--md-surface-container)",
              color: "var(--md-on-surface-variant)", fontSize: 13,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span>Neo is typing</span>
              <span className="typing-dots" style={{ display: "inline-flex", gap: 2 }}>
                <span style={{ animation: "typingDot 1.4s infinite", animationDelay: "0s" }}>.</span>
                <span style={{ animation: "typingDot 1.4s infinite", animationDelay: "0.2s" }}>.</span>
                <span style={{ animation: "typingDot 1.4s infinite", animationDelay: "0.4s" }}>.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>}

      {!historyOpen && <>
      {/* Error banner */}
      {error && (
        <div style={{
          padding: "8px 14px", margin: "0 12px", borderRadius: 8,
          background: "rgba(179, 38, 30, 0.12)", color: "var(--md-error, #B3261E)",
          fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span><AlertTriangle size={14} /> {error}</span>
          <button onClick={() => setError(null)} style={{
            background: "none", border: "none", color: "var(--md-error, #B3261E)",
            cursor: "pointer", fontSize: 14, padding: "0 4px",
          }}>✕</button>
        </div>
      )}

      {/* Image previews */}
      {pendingImages.length > 0 && (
        <div style={{ padding: "8px 12px 0", display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--md-surface-variant)" }}>
          {pendingImages.map((img, i) => (
            <div key={i} style={{ position: "relative", display: "inline-block" }}>
              <img src={img.dataUrl} alt={img.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--md-surface-variant)" }} />
              <button onClick={() => removeImage(i)}
                style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--md-error, #B3261E)", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}
                title="Remove image">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Task mention badges */}
      {taskMentions.length > 0 && (
        <div style={{
          padding: "4px 12px", display: "flex", gap: 6, flexWrap: "wrap",
          borderTop: "1px solid var(--md-surface-variant)",
        }}>
          {taskMentions.map(t => (
            <span key={t.id} style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 10,
              background: "rgba(103,80,164,0.1)", color: "var(--md-primary, #6750A4)",
              fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              📌 {t.title.length > 30 ? t.title.slice(0, 30) + "…" : t.title}
              <button onClick={() => setTaskMentions(prev => prev.filter(x => x.id !== t.id))}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Input area — polished */}
      <div style={{
        padding: "10px 12px",
        borderTop: pendingImages.length || taskMentions.length ? "none" : "1px solid var(--md-surface-variant)",
        display: "flex", gap: 8, alignItems: "flex-end",
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom, 12px))" : 12,
        position: "relative",
      }}>
        {/* Task mention autocomplete dropdown */}
        {mentionQuery !== null && (
          <TaskMentionDropdown
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={handleMentionClose}
            inputRef={inputRef}
          />
        )}
        <button onClick={() => fileInputRef.current?.click()} title="Attach image"
          style={{
            background: "none", border: "none", color: "var(--md-on-surface-variant)",
            fontSize: 16, cursor: "pointer", padding: "6px", borderRadius: 8,
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 150ms",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        ><Paperclip size={14} /></button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple style={{ display: "none" }} onChange={handleFileSelect} />
        <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKey}
          placeholder="Describe what you need..." rows={1}
          style={{
            flex: 1, background: "var(--md-surface-container)",
            border: "1px solid var(--md-surface-variant)",
            color: "var(--md-on-background)", padding: "9px 14px", fontSize: 13,
            resize: "none", outline: "none", borderRadius: 20,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            minHeight: isMobile ? 44 : 36,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            transition: "border-color 150ms, box-shadow 150ms",
          }}
          onFocus={e => { e.target.style.borderColor = "var(--md-primary)"; e.target.style.boxShadow = "0 0 0 2px rgba(103,80,164,0.12)"; }}
          onBlur={e => { e.target.style.borderColor = "var(--md-surface-variant)"; e.target.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
        />
        <button onClick={send} disabled={!hasInput || streaming}
          style={{
            background: hasInput && !streaming ? "linear-gradient(135deg, #6750A4, #7B68EE)" : "var(--md-surface-variant)",
            color: hasInput && !streaming ? "#fff" : "var(--md-on-surface-variant)",
            border: "none", width: 36, height: 36, borderRadius: "50%",
            fontWeight: 600, fontSize: 15,
            cursor: hasInput && !streaming ? "pointer" : "default",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: hasInput && !streaming ? "0 2px 8px rgba(103,80,164,0.3)" : "none",
            transition: "background 150ms, box-shadow 150ms",
          }}>↑</button>
      </div>
      </>}
      {modalImage && <ImageModal src={modalImage} onClose={() => setModalImage(null)} />}
    </div>
  );
}
