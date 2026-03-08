import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";

const SESSION_KEY = "neo-chat-session";
const HISTORY_KEY = "neo-chat-history";

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = "dashboard-" + crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try {
    // Keep last 100 messages to avoid bloating localStorage
    const trimmed = messages.slice(-100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

export default function NeoChatPanel({ isMobile }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadHistory());
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Persist messages
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Focus input on open
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: "user", content: text, ts: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Build messages array for the API (just role + content)
    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

    const assistantMsg = { role: "assistant", content: "", ts: Date.now() };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch("/api/neo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sessionId: getSessionId(),
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Error: ${err.error || "Unknown error"}`, ts: Date.now() }]);
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      setMessages(prev => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              const acc = accumulated;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Connection error: ${e.message}`, ts: Date.now() }]);
      }
    }

    abortRef.current = null;
    setStreaming(false);
  }, [input, messages, streaming]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(HISTORY_KEY);
  };

  // Floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Talk to Neo"
        style={{
          position: "fixed",
          bottom: isMobile ? 80 : 24,
          right: isMobile ? 16 : 24,
          width: 56, height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6750A4 0%, #9C4DCC 100%)",
          border: "none",
          fontSize: 22, cursor: "pointer", zIndex: 999,
          color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(103, 80, 164, 0.4)",
          transition: "transform 150ms, box-shadow 150ms",
        }}
        onMouseEnter={e => { e.target.style.transform = "scale(1.08)"; e.target.style.boxShadow = "0 6px 20px rgba(103, 80, 164, 0.5)"; }}
        onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 16px rgba(103, 80, 164, 0.4)"; }}
      >✨</button>
    );
  }

  const containerStyle = isMobile ? {
    position: "fixed", inset: 0, background: "var(--md-background)", zIndex: 1000,
    display: "flex", flexDirection: "column",
  } : {
    position: "fixed", bottom: 24, right: 24, width: 440, height: 560,
    background: "var(--md-background)", borderRadius: 24,
    border: "1px solid var(--md-surface-variant)", zIndex: 1000,
    display: "flex", flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.16)",
    overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--md-surface-variant)",
        display: "flex", alignItems: "center", gap: 10,
        background: "linear-gradient(135deg, rgba(103,80,164,0.08) 0%, rgba(156,77,204,0.05) 100%)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, #6750A4, #9C4DCC)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: "#fff", fontWeight: 700,
        }}>N</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--md-on-surface)" }}>Neo</div>
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
            {streaming ? "Typing..." : "Ask me to create tasks, plan features, or anything"}
          </div>
        </div>
        <button onClick={clearChat} title="Clear chat" style={{
          background: "none", border: "none", color: "var(--md-on-surface-variant)",
          cursor: "pointer", fontSize: 14, padding: 4, minWidth: 32, minHeight: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8,
        }}>🗑️</button>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: "none", color: "var(--md-on-surface-variant)",
          fontSize: 18, cursor: "pointer", minWidth: 32, minHeight: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8,
        }}>✕</button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: "center", marginTop: 60, padding: "0 24px",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "var(--md-on-surface)", marginBottom: 8 }}>
              Talk to Neo
            </div>
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
              Describe what you need in natural language. I'll create tasks, ask clarifying questions, and help you plan.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              {[
                "Create a task to fix the login bug",
                "I need a new API endpoint for user profiles",
                "Plan a feature for notifications",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  style={{
                    padding: "8px 14px", borderRadius: 16,
                    border: "1px solid var(--md-surface-variant)",
                    background: "var(--md-surface)", color: "var(--md-on-surface-variant)",
                    fontSize: 12, cursor: "pointer",
                    fontFamily: "'Roboto', system-ui, sans-serif",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={e => e.target.style.background = "var(--md-surface-container)"}
                  onMouseLeave={e => e.target.style.background = "var(--md-surface)"}
                >{suggestion}</button>
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
              marginBottom: 12,
            }}>
              <div style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: isUser ? "var(--md-primary)" : "var(--md-surface-container)",
                color: isUser ? "var(--md-on-primary)" : "var(--md-on-surface)",
                fontSize: 13, lineHeight: 1.6,
                wordBreak: "break-word",
              }}>
                {isUser ? (
                  <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                ) : (
                  <div className="neo-chat-md" style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <ReactMarkdown>{msg.content || (streaming && i === messages.length - 1 ? "..." : "")}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: 12, borderTop: "1px solid var(--md-surface-variant)",
        display: "flex", gap: 8, alignItems: "flex-end",
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
            flex: 1, background: "var(--md-surface-container)",
            border: "1px solid var(--md-surface-variant)",
            color: "var(--md-on-background)", padding: "10px 14px", fontSize: 13,
            resize: "none", outline: "none", borderRadius: 18,
            fontFamily: "'Roboto', system-ui, sans-serif",
            minHeight: isMobile ? 44 : "auto",
            maxHeight: 120, overflow: "auto",
          }}
          onFocus={e => e.target.style.borderColor = "var(--md-primary)"}
          onBlur={e => e.target.style.borderColor = "var(--md-surface-variant)"}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
          style={{
            background: input.trim() && !streaming ? "var(--md-primary)" : "var(--md-surface-variant)",
            color: input.trim() && !streaming ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
            border: "none", width: 40, height: 40, borderRadius: "50%",
            cursor: input.trim() && !streaming ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
            transition: "background 150ms",
          }}
        >↑</button>
      </div>
    </div>
  );
}
