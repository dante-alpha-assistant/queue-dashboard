import { useState, useEffect, useRef } from "react";

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load initial messages
  useEffect(() => {
    if (!open) return;
    fetch("/api/chat?limit=50")
      .then(r => r.json())
      .then(msgs => {
        setMessages(msgs);
        if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
      })
      .catch(() => {});
  }, [open]);

  // Poll for new messages
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      const after = lastIdRef.current || "-";
      const url = after === "-" ? "/api/chat?limit=50" : `/api/chat?after=${after}`;
      fetch(url)
        .then(r => r.json())
        .then(newMsgs => {
          if (newMsgs.length) {
            setMessages(prev => after === "-" ? newMsgs : [...prev, ...newMsgs]);
            lastIdRef.current = newMsgs[newMsgs.length - 1].id;
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
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
        body: JSON.stringify({ text, sender: "user", name: "Dante" }),
      });
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
      position: "fixed", bottom: 24, right: 24, width: 400, height: 500,
      background: "#0a0a0a", border: "1px solid #222", zIndex: 1000,
      display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #222",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Chat with Neo 🕶️</span>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer",
        }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {messages.length === 0 && (
          <div style={{ opacity: 0.3, textAlign: "center", marginTop: 40, fontSize: 13 }}>
            No messages yet. Say something.
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div key={msg.id} style={{
              display: "flex", flexDirection: "column",
              alignItems: isUser ? "flex-end" : "flex-start",
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 2 }}>
                {msg.name || msg.sender} · {timeAgo(msg.timestamp)}
              </div>
              <div style={{
                background: isUser ? "#1a3a1a" : "#1a1a2a",
                padding: "8px 12px", maxWidth: "80%",
                borderRadius: 4, fontSize: 13, lineHeight: 1.4,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid #222",
        display: "flex", gap: 8,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Neo..."
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
