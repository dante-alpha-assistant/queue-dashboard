import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { MessageSquare } from 'lucide-react';

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

function cleanText(text) {
  return text
    .replace(/<@!?\d+>/g, "")
    .replace(/\*\*\[Dante via Dashboard\]\*\*\s*/g, "")
    .trim();
}

export default function ChatPanel({ isMobile, open: controlledOpen, onClose }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onClose ? (v) => { if (!v) { setExpanded(false); onClose(); } } : setInternalOpen;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const lastIdRef = useRef(null);

  const loadMessages = async (after) => {
    try {
      const url = after ? `/api/chat?limit=30&after=${after}` : "/api/chat?limit=30";
      const resp = await fetch(url);
      const msgs = await resp.json();
      if (Array.isArray(msgs) && msgs.length) {
        if (after) {
          setMessages(prev => [...prev, ...msgs]);
        } else {
          setMessages(msgs);
        }
        lastIdRef.current = msgs[msgs.length - 1].id;
      }
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    lastIdRef.current = null;
    loadMessages(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      if (lastIdRef.current) loadMessages(lastIdRef.current);
    }, 3000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setTimeout(() => {
        if (lastIdRef.current) loadMessages(lastIdRef.current);
      }, 500);
    } catch {}
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) {
    return null;
  }

  const containerStyle = isMobile ? {
    position: "fixed", inset: 0, background: "var(--md-background)", zIndex: 1000,
    display: "flex", flexDirection: "column",
  } : expanded ? {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 450,
    background: "var(--md-background)", zIndex: 1000,
    display: "flex", flexDirection: "column",
    borderLeft: "1px solid var(--md-surface-variant)",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
  } : {
    position: "fixed", bottom: 24, right: 24, width: 400, height: 500,
    background: "var(--md-background)", borderRadius: 24,
    border: "1px solid var(--md-surface-variant)", zIndex: 1000,
    display: "flex", flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}><MessageSquare size={14} /> #dante-agents</span>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {!isMobile && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              title={expanded ? "Collapse to popup" : "Expand to panel"}
              style={{
                background: "none", border: "none", color: "var(--md-on-surface-variant)",
                fontSize: 16, cursor: "pointer", minWidth: 36, minHeight: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--md-surface-container)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >{expanded ? "↙" : "↗"}</button>
          )}
          <button onClick={() => setOpen(false)} style={{
            background: "none", border: "none", color: "var(--md-on-surface-variant)",
            fontSize: 18, cursor: "pointer", minWidth: 44, minHeight: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--md-on-surface-variant)", textAlign: "center", marginTop: 40, fontSize: 13 }}>
            No messages yet
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const cleaned = cleanText(msg.text);
          if (!cleaned) return null;
          return (
            <div key={msg.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                {msg.avatar && (
                  <img src={msg.avatar} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
                )}
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: isUser ? "var(--md-primary)" : "#386A20",
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  letterSpacing: "0.02em",
                }}>{msg.name}</span>
                <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", letterSpacing: "0.01em" }}>{timeAgo(msg.timestamp)}</span>
              </div>
              <div style={{
                fontSize: 14, lineHeight: 1.55, paddingLeft: 24,
                wordBreak: "break-word",
                color: "var(--md-on-background)",
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                letterSpacing: "0.01em",
                ...(isUser ? { whiteSpace: "pre-wrap" } : {}),
              }}
              className={isUser ? "" : "chat-markdown"}
              >
                {isUser ? cleaned : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: "var(--md-primary)", textDecoration: "none" }} />,
                      p: ({ node, ...props }) => <p {...props} style={{ margin: "0 0 8px 0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }} />,
                      h1: ({ node, ...props }) => <h1 {...props} style={{ fontSize: 20, fontWeight: 600, margin: "12px 0 6px 0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }} />,
                      h2: ({ node, ...props }) => <h2 {...props} style={{ fontSize: 17, fontWeight: 600, margin: "10px 0 4px 0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }} />,
                      h3: ({ node, ...props }) => <h3 {...props} style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 4px 0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }} />,
                      strong: ({ node, ...props }) => <strong {...props} style={{ fontWeight: 600 }} />,
                      em: ({ node, ...props }) => <em {...props} />,
                      blockquote: ({ node, ...props }) => <blockquote {...props} style={{ borderLeft: "3px solid var(--md-primary)", paddingLeft: 12, margin: "6px 0", color: "var(--md-on-surface-variant)" }} />,
                      ul: ({ node, ...props }) => <ul {...props} style={{ margin: "4px 0", paddingLeft: 20 }} />,
                      ol: ({ node, ...props }) => <ol {...props} style={{ margin: "4px 0", paddingLeft: 20 }} />,
                      li: ({ node, ...props }) => <li {...props} style={{ marginBottom: 2 }} />,
                      code: ({ node, inline, className, children, ...props }) => {
                        if (inline) {
                          return <code style={{
                            background: "var(--md-surface-container-highest, rgba(0,0,0,0.08))",
                            padding: "2px 6px", borderRadius: 4, fontSize: 13,
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          }} {...props}>{children}</code>;
                        }
                        return <code className={className} style={{
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          fontSize: 13,
                        }} {...props}>{children}</code>;
                      },
                      pre: ({ node, ...props }) => <pre {...props} style={{
                        background: "#1e1e2e",
                        color: "#cdd6f4",
                        padding: 12, borderRadius: 8, overflow: "auto",
                        fontSize: 13, margin: "8px 0",
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        lineHeight: 1.5,
                      }} />,
                    }}
                  >
                    {cleaned}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 12, borderTop: "1px solid var(--md-surface-variant)",
        display: "flex", gap: 8,
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom, 12px))" : 12,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message #dante-agents..."
          rows={1}
          style={{
            flex: 1, background: "var(--md-surface-container)",
            border: "1px solid var(--md-surface-variant)",
            color: "var(--md-on-background)", padding: "10px 14px", fontSize: 14,
            resize: "none", outline: "none", borderRadius: 12,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            lineHeight: 1.5, letterSpacing: "0.01em",
            minHeight: isMobile ? 44 : "auto",
          }}
          onFocus={e => e.target.style.borderColor = "var(--md-primary)"}
          onBlur={e => e.target.style.borderColor = "var(--md-surface-variant)"}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() ? "var(--md-primary)" : "var(--md-surface-variant)",
            color: input.trim() ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
            border: "none", padding: "10px 16px", borderRadius: 20,
            fontWeight: 500, fontSize: 13, cursor: input.trim() ? "pointer" : "default",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            minHeight: isMobile ? 44 : "auto",
          }}
        >Send</button>
      </div>
    </div>
  );
}
