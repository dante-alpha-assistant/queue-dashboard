import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractImages(dataTransfer) {
  const files = [];
  if (dataTransfer?.files) {
    for (const file of dataTransfer.files) {
      if (ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE) {
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
        <img key={i} src={part.image_url?.url} alt="uploaded"
          style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginTop: 4, marginBottom: 4, display: "block" }} />
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

/* History dropdown */
function HistoryDropdown({ conversations, activeConvoId, onSelect, onDelete, onClose, onViewAll }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={dropdownRef} style={{
      position: "absolute", top: "100%", right: 0, marginTop: 4,
      width: 280, maxHeight: 380,
      background: "var(--md-surface, #fff)",
      border: "1px solid var(--md-surface-variant)",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
      zIndex: 100,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid var(--md-surface-variant)",
        fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)",
      }}>
        Recent Conversations
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {conversations.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            No conversations yet
          </div>
        )}
        {conversations.slice(0, 10).map(c => (
          <div
            key={c.id}
            onClick={() => { onSelect(c.id); onClose(); }}
            className="history-item"
            style={{
              padding: "10px 14px", cursor: "pointer",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              background: c.id === activeConvoId ? "rgba(103, 80, 164, 0.08)" : "transparent",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              transition: "background 100ms",
            }}
            onMouseEnter={e => { if (c.id !== activeConvoId) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
            onMouseLeave={e => { if (c.id !== activeConvoId) e.currentTarget.style.background = c.id === activeConvoId ? "rgba(103, 80, 164, 0.08)" : "transparent"; }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: c.id === activeConvoId ? 600 : 400,
                color: "var(--md-on-surface)", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{c.title || "New conversation"}</div>
              <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
                {timeAgo(c.updated_at)}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(c.id, e); }}
              title="Delete"
              className="history-delete-btn"
              style={{
                background: "none", border: "none", fontSize: 12, cursor: "pointer",
                color: "var(--md-on-surface-variant)", padding: "4px 6px", borderRadius: 6,
                opacity: 0, transition: "opacity 150ms, background 150ms",
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(179,38,30,0.08)"; e.currentTarget.style.color = "var(--md-error, #B3261E)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--md-on-surface-variant)"; }}
            >🗑</button>
          </div>
        ))}
      </div>
      {conversations.length > 10 && (
        <div style={{
          padding: "8px 14px", borderTop: "1px solid var(--md-surface-variant)",
          textAlign: "center",
        }}>
          <button onClick={onViewAll} style={{
            background: "none", border: "none", color: "var(--md-primary, #6750A4)",
            fontSize: 12, fontWeight: 500, cursor: "pointer",
          }}>View all ({conversations.length})</button>
        </div>
      )}
    </div>
  );
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
        <img key={i} src={part.image_url?.url} alt="uploaded"
          style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginTop: 4, marginBottom: 4, display: "block" }}
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
  const [dragging, setDragging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const loadAbortRef = useRef(null);
  const headerRef = useRef(null);

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
        setMessages(data.map(m => ({
          role: m.role,
          content: m.content,
          time: m.created_at,
          id: m.id,
        })));
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
    for (const file of files) {
      try {
        const dataUrl = await fileToBase64(file);
        newImages.push({ dataUrl, name: file.name });
      } catch (e) {
        console.error("Failed to read image:", e);
      }
    }
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
    const userMsg = { role: "user", content, time: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    const imageUrls = pendingImages.map(img => img.dataUrl);
    setPendingImages([]);
    setStreaming(true);

    const assistantMsg = { role: "assistant", content: "", time: new Date().toISOString() };
    setMessages([...newMessages, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(`/api/neo-chat/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, images: imageUrls.length ? imageUrls : undefined }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: `⚠️ Error: ${err.error || resp.statusText}` };
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
              accumulated += delta;
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
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: `⚠️ Connection error: ${e.message}` };
          return updated;
        });
      }
    }

    abortRef.current = null;
    setStreaming(false);
  }, [input, streaming, messages, activeConvoId, pendingImages, loadConversations]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer?.types?.includes("Files")) setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragging(false); const files = extractImages(e.dataTransfer); if (files.length) addImages(files); };
  const handleFileSelect = (e) => { const files = Array.from(e.target.files || []).filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_IMAGE_SIZE); if (files.length) addImages(files); e.target.value = ""; };

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
          fontFamily: "'Roboto', system-ui, sans-serif",
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
          <div style={{ position: "relative" }}>
            <HeaderIconBtn
              icon={ChatIcons.history}
              title="History"
              onClick={() => setHistoryOpen(prev => !prev)}
              active={historyOpen}
              badge={conversations.length}
            />
            {historyOpen && (
              <HistoryDropdown
                conversations={conversations}
                activeConvoId={activeConvoId}
                onSelect={(id) => setActiveConvoId(id)}
                onDelete={deleteConversation}
                onClose={() => setHistoryOpen(false)}
                onViewAll={() => setHistoryOpen(false)}
              />
            )}
          </div>
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

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {loadingMessages && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--md-on-surface-variant)", fontSize: 13 }}>Loading messages...</div>
        )}
        {!loadingMessages && messages.length === 0 && !activeConvoId && (
          <div style={{ textAlign: "center", marginTop: 48, color: "var(--md-on-surface-variant)" }}>
            <NeoAvatar size={48} />
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12, marginBottom: 6, color: "var(--md-on-surface)" }}>Hey! I'm Neo.</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 280, margin: "0 auto", color: "var(--md-on-surface-variant)" }}>
              Tell me what you need and I'll create a task for it. You can describe features, bugs, ops work — anything.
            </div>
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 8, opacity: 0.6 }}>📎 Drag & drop or paste images</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 20, maxWidth: 260, margin: "20px auto 0" }}>
              {["Add dark mode toggle to settings", "Deploy the latest build to staging", "Research best auth libraries for Next.js"].map((suggestion, i) => (
                <button key={i} onClick={() => setInput(suggestion)}
                  style={{ padding: "8px 14px", borderRadius: 16, fontSize: 12, border: "1px solid var(--md-surface-variant)", background: "var(--md-surface)", color: "var(--md-on-surface)", cursor: "pointer", textAlign: "left", fontFamily: "'Roboto', system-ui, sans-serif", transition: "background 150ms" }}
                  onMouseEnter={e => e.target.style.background = "var(--md-surface-container)"}
                  onMouseLeave={e => e.target.style.background = "var(--md-surface)"}
                >💡 {suggestion}</button>
              ))}
            </div>
          </div>
        )}
        {!loadingMessages && messages.length === 0 && activeConvoId && (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--md-on-surface-variant)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 13 }}>No messages yet. Start the conversation!</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
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
                color: isUser ? "#fff" : "var(--md-on-surface)",
                fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {renderContent(msg.content)}
                {!msg.content && streaming && i === messages.length - 1 && <span style={{ opacity: 0.5 }}>●●●</span>}
                color: isUser
                  ? "var(--md-on-primary)"
                  : "var(--md-on-surface)",
                fontSize: 13,
                lineHeight: 1.6,
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
                {!msg.content && streaming && i === messages.length - 1 && (
                  <span style={{ opacity: 0.5 }}>●●●</span>
                )}
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
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "8px 14px", margin: "0 12px", borderRadius: 8,
          background: "rgba(179, 38, 30, 0.12)", color: "var(--md-error, #B3261E)",
          fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>⚠️ {error}</span>
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

      {/* Input area — polished */}
      <div style={{
        padding: "10px 12px",
        borderTop: pendingImages.length ? "none" : "1px solid var(--md-surface-variant)",
        display: "flex", gap: 8, alignItems: "flex-end",
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom, 12px))" : 12,
      }}>
        <button onClick={() => fileInputRef.current?.click()} title="Attach image"
          style={{
            background: "none", border: "none", color: "var(--md-on-surface-variant)",
            fontSize: 16, cursor: "pointer", padding: "6px", borderRadius: 8,
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 150ms",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >📎</button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple style={{ display: "none" }} onChange={handleFileSelect} />
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Describe what you need..." rows={1}
          style={{
            flex: 1, background: "var(--md-surface-container)",
            border: "1px solid var(--md-surface-variant)",
            color: "var(--md-on-background)", padding: "9px 14px", fontSize: 13,
            resize: "none", outline: "none", borderRadius: 20,
            fontFamily: "'Roboto', system-ui, sans-serif",
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
            fontFamily: "'Roboto', system-ui, sans-serif",
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: hasInput && !streaming ? "0 2px 8px rgba(103,80,164,0.3)" : "none",
            transition: "background 150ms, box-shadow 150ms",
          }}>↑</button>
      </div>
    </div>
  );
}
