import { useState, useEffect, useRef, useCallback } from "react";

function generateSessionId() {
  return `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Simple markdown-ish rendering: bold, code, links
function renderText(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line}
    </span>
  ));
}

export default function NewTaskChat({ isMobile }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId] = useState(() => {
    const saved = sessionStorage.getItem("neo-chat-session");
    if (saved) return saved;
    const id = generateSessionId();
    sessionStorage.setItem("neo-chat-session", id);
    return id;
  });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Load persisted messages
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("neo-chat-messages");
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  // Persist messages
  useEffect(() => {
    if (messages.length) {
      sessionStorage.setItem("neo-chat-messages", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: "user", content: text, time: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add placeholder for assistant
    const assistantMsg = { role: "assistant", content: "", time: new Date().toISOString() };
    setMessages([...newMessages, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch("/api/neo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `⚠️ Error: ${err.error || resp.statusText}`,
          };
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
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: acc,
                };
                return updated;
              });
            }
          } catch {}
        }
      }

      // If we got no content from streaming, try to get from non-delta format
      if (!accumulated) {
        setMessages(prev => {
          const updated = [...prev];
          if (!updated[updated.length - 1].content) {
            updated[updated.length - 1].content = "_(Neo is thinking... response may arrive shortly)_";
          }
          return updated;
        });
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `⚠️ Connection error: ${e.message}`,
          };
          return updated;
        });
      }
    }

    abortRef.current = null;
    setStreaming(false);
  }, [input, streaming, messages, sessionId]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem("neo-chat-messages");
    const newId = generateSessionId();
    sessionStorage.setItem("neo-chat-session", newId);
  };

  // FAB button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Chat with Neo to create a task"
        style={{
          position: "fixed",
          bottom: isMobile ? 80 : 24,
          right: isMobile ? 16 : 88,
          height: 48,
          paddingLeft: 16,
          paddingRight: 18,
          borderRadius: 24,
          background: "linear-gradient(135deg, #6750A4 0%, #7B68EE 100%)",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          zIndex: 1000,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 16px rgba(103, 80, 164, 0.4)",
          transition: "transform 150ms, box-shadow 150ms",
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
    ? {
        position: "fixed", inset: 0, background: "var(--md-background)", zIndex: 1001,
        display: "flex", flexDirection: "column",
      }
    : {
        position: "fixed", bottom: 24, right: 24, width: 440, height: 560,
        background: "var(--md-background)", borderRadius: 24,
        border: "1px solid var(--md-surface-variant)", zIndex: 1001,
        display: "flex", flexDirection: "column",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        overflow: "hidden",
      };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "linear-gradient(135deg, rgba(103,80,164,0.08) 0%, rgba(123,104,238,0.04) 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #6750A4, #7B68EE)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff",
          }}>✨</div>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-on-surface)" }}>
              Chat with Neo
            </span>
            <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)", marginTop: 1 }}>
              Describe what you need → Neo creates the task
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={clearChat}
            title="New conversation"
            style={{
              background: "none", border: "none", color: "var(--md-on-surface-variant)",
              fontSize: 14, cursor: "pointer", padding: "6px 8px", borderRadius: 8,
              minWidth: 36, minHeight: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >🗑</button>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "none", border: "none", color: "var(--md-on-surface-variant)",
              fontSize: 18, cursor: "pointer", padding: "6px 8px", borderRadius: 8,
              minWidth: 36, minHeight: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: "center", marginTop: 60, color: "var(--md-on-surface-variant)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--md-on-surface)" }}>
              Hey! I'm Neo.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
              Tell me what you need and I'll create a task for it.
              You can describe features, bugs, ops work — anything.
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: 6, marginTop: 20,
              maxWidth: 260, margin: "20px auto 0",
            }}>
              {[
                "Add dark mode toggle to settings",
                "Deploy the latest build to staging",
                "Research best auth libraries for Next.js",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(suggestion); }}
                  style={{
                    padding: "8px 14px", borderRadius: 12, fontSize: 12,
                    border: "1px solid var(--md-surface-variant)",
                    background: "var(--md-surface)", color: "var(--md-on-surface)",
                    cursor: "pointer", textAlign: "left",
                    fontFamily: "'Roboto', system-ui, sans-serif",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={e => e.target.style.background = "var(--md-surface-container)"}
                  onMouseLeave={e => e.target.style.background = "var(--md-surface)"}
                >
                  💡 {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} style={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}>
              <div style={{
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: isUser
                  ? "var(--md-primary)"
                  : "var(--md-surface-container)",
                color: isUser
                  ? "var(--md-on-primary)"
                  : "var(--md-on-surface)",
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {!isUser && (
                  <div style={{
                    fontSize: 10, fontWeight: 600, marginBottom: 4,
                    color: "var(--md-primary)", opacity: 0.8,
                  }}>Neo</div>
                )}
                {renderText(msg.content)}
                {!msg.content && streaming && i === messages.length - 1 && (
                  <span style={{ opacity: 0.5 }}>●●●</span>
                )}
                <div style={{
                  fontSize: 9, marginTop: 4, opacity: 0.5,
                  textAlign: isUser ? "right" : "left",
                }}>
                  {msg.time ? formatTime(new Date(msg.time)) : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 12,
        borderTop: "1px solid var(--md-surface-variant)",
        display: "flex",
        gap: 8,
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom, 12px))" : 12,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe what you need..."
          rows={1}
          style={{
            flex: 1,
            background: "var(--md-surface-container)",
            border: "1px solid var(--md-surface-variant)",
            color: "var(--md-on-background)",
            padding: "10px 14px",
            fontSize: 13,
            resize: "none",
            outline: "none",
            borderRadius: 12,
            fontFamily: "'Roboto', system-ui, sans-serif",
            minHeight: isMobile ? 44 : "auto",
          }}
          onFocus={e => e.target.style.borderColor = "var(--md-primary)"}
          onBlur={e => e.target.style.borderColor = "var(--md-surface-variant)"}
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          style={{
            background: input.trim() && !streaming
              ? "linear-gradient(135deg, #6750A4, #7B68EE)"
              : "var(--md-surface-variant)",
            color: input.trim() && !streaming ? "#fff" : "var(--md-on-surface-variant)",
            border: "none",
            padding: "10px 16px",
            borderRadius: 20,
            fontWeight: 600,
            fontSize: 13,
            cursor: input.trim() && !streaming ? "pointer" : "default",
            fontFamily: "'Roboto', system-ui, sans-serif",
            minHeight: isMobile ? 44 : "auto",
            minWidth: 60,
          }}
        >
          {streaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
