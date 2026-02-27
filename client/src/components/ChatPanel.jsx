import { useState, useEffect, useRef } from "react";

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

// Strip Discord mentions like <@12345> and [Dashboard Chat] prefix
function cleanText(text) {
  return text
    .replace(/<@!?\d+>/g, "")
    .replace(/\[Dashboard Chat\]\s*/g, "")
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

  // Load messages
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

  // Initial load
  useEffect(() => {
    if (!open) return;
    lastIdRef.current = null;
    loadMessages(null);
  }, [open]);

  // Poll every 3s for new messages
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      if (lastIdRef.current) loadMessages(lastIdRef.current);
    }, 3000);
    return () => clearInterval(interval);
  }, [open]);

  // Auto-scroll
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
      // Immediately poll for the sent message
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
          borderRadius: "50%", background: "#33ff00", border: "none",
          fontSize: 24, cursor: "pointer", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(51,255,0,0.3)",
        }}
      >💬</button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, width: 420, height: 520,
      background: "#0a0a0a", border: "1px solid #222", zIndex: 1000,
      display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #222",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>💬 #dante-agents</span>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer",
        }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
        {messages.length === 0 && (
          <div style={{ opacity: 0.3, textAlign: "center", marginTop: 40, fontSize: 13 }}>
            Loading messages...
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const cleaned = cleanText(msg.text);
          if (!cleaned) return null;
          return (
            <div key={msg.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                {msg.avatar && (
                  <img src={msg.avatar} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
                )}
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: isUser ? "#8888ff" : "#33ff00",
                }}>{msg.name}</span>
                <span style={{ fontSize: 10, opacity: 0.3 }}>{timeAgo(msg.timestamp)}</span>
              </div>
              <div style={{
                fontSize: 13, lineHeight: 1.5, paddingLeft: 24,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                opacity: 0.9,
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
        padding: "12px", borderTop: "1px solid #222",
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
            flex: 1, background: "#111", border: "1px solid #333",
            color: "#eee", padding: "8px 12px", fontSize: 13,
            resize: "none", outline: "none", fontFamily: "inherit",
          }}
          onFocus={e => e.target.style.borderColor = "#33ff00"}
          onBlur={e => e.target.style.borderColor = "#333"}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() ? "#33ff00" : "#222", color: "#000",
            border: "none", padding: "8px 16px", fontWeight: 700,
            fontSize: 13, cursor: input.trim() ? "pointer" : "default",
            fontFamily: "inherit",
          }}
        >Send</button>
      </div>
    </div>
  );
}
