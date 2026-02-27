import { useState, useEffect, useRef } from "react";

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

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
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
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: "50%", background: "var(--md-primary)", border: "none",
          fontSize: 24, cursor: "pointer", zIndex: 1000, color: "var(--md-on-primary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(103, 80, 164, 0.3)",
        }}
      >💬</button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, width: 400, height: 500,
      background: "var(--md-background)", borderRadius: 24,
      border: "1px solid var(--md-surface-variant)", zIndex: 1000,
      display: "flex", flexDirection: "column",
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>💬 #dante-agents</span>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: "none", color: "var(--md-border)",
          fontSize: 18, cursor: "pointer",
        }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--md-border)", textAlign: "center", marginTop: 40, fontSize: 13 }}>
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
                  fontSize: 11, fontWeight: 600,
                  color: isUser ? "var(--md-primary)" : "#386A20",
                }}>{msg.name}</span>
                <span style={{ fontSize: 10, color: "var(--md-border)" }}>{timeAgo(msg.timestamp)}</span>
              </div>
              <div style={{
                fontSize: 13, lineHeight: 1.5, paddingLeft: 24,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                color: "var(--md-on-background)",
              }}>
                {cleaned}
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
            color: "var(--md-on-background)", padding: "10px 14px", fontSize: 13,
            resize: "none", outline: "none", borderRadius: 12,
            fontFamily: "'Roboto', system-ui, sans-serif",
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
            fontFamily: "'Roboto', system-ui, sans-serif",
          }}
        >Send</button>
      </div>
    </div>
  );
}
