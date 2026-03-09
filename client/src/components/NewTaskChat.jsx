import { useState, useEffect, useRef, useCallback } from "react";

function generateSessionId() {
  return `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

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

// Render inline images from message content array
function renderContent(content) {
  if (typeof content === "string") return renderText(content);
  if (!Array.isArray(content)) return null;

  return content.map((part, i) => {
    if (part.type === "text") return <span key={i}>{renderText(part.text)}</span>;
    if (part.type === "image_url") {
      return (
        <img
          key={i}
          src={part.image_url?.url}
          alt="uploaded"
          style={{
            maxWidth: "100%",
            maxHeight: 200,
            borderRadius: 8,
            marginTop: 4,
            marginBottom: 4,
            display: "block",
          }}
        />
      );
    }
    return null;
  });
}

export default function NewTaskChat({ isMobile }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingImages, setPendingImages] = useState([]); // [{dataUrl, name}]
  const [dragging, setDragging] = useState(false);
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
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

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
    if (newImages.length) {
      setPendingImages(prev => [...prev, ...newImages]);
    }
  }, []);

  const removeImage = useCallback((index) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Paste handler
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e) => {
      const files = extractImages(e.clipboardData);
      if (files.length) {
        e.preventDefault();
        addImages(files);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, addImages]);

  // Build message content (text + images)
  const buildContent = useCallback((text, images) => {
    if (!images.length) return text;
    const parts = [];
    if (text) parts.push({ type: "text", text });
    for (const img of images) {
      parts.push({
        type: "image_url",
        image_url: { url: img.dataUrl },
      });
    }
    return parts;
  }, []);

  // For sending to API: flatten content to serializable format
  const contentForApi = (content) => {
    if (typeof content === "string") return content;
    // Send as OpenAI vision content parts
    return content;
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImages.length) || streaming) return;

    const content = buildContent(text, pendingImages);
    const userMsg = { role: "user", content, time: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImages([]);
    setStreaming(true);

    const assistantMsg = { role: "assistant", content: "", time: new Date().toISOString() };
    setMessages([...newMessages, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch("/api/neo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: contentForApi(m.content) })),
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
  }, [input, streaming, messages, sessionId, pendingImages, buildContent]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPendingImages([]);
    sessionStorage.removeItem("neo-chat-messages");
    const newId = generateSessionId();
    sessionStorage.setItem("neo-chat-session", newId);
  };

  // Drag & drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.types?.includes("Files")) {
      setDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    const files = extractImages(e.dataTransfer);
    if (files.length) addImages(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []).filter(
      f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_IMAGE_SIZE
    );
    if (files.length) addImages(files);
    e.target.value = "";
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

  const hasInput = input.trim() || pendingImages.length > 0;

  return (
    <div
      style={{ ...containerStyle, position: "fixed" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {dragging && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(103, 80, 164, 0.15)",
          border: "3px dashed var(--md-primary, #6750A4)",
          borderRadius: isMobile ? 0 : 24,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(2px)",
        }}>
          <div style={{
            background: "var(--md-surface, #fff)",
            padding: "20px 32px",
            borderRadius: 16,
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--md-on-surface)",
            }}>
              Drop image here
            </div>
            <div style={{
              fontSize: 11,
              color: "var(--md-on-surface-variant)",
              marginTop: 4,
            }}>
              PNG, JPG, GIF, WebP
            </div>
          </div>
        </div>
      )}

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
              fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 8, opacity: 0.7,
            }}>
              📎 You can also drag & drop or paste images
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
                {renderContent(msg.content)}
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

      {/* Image previews */}
      {pendingImages.length > 0 && (
        <div style={{
          padding: "8px 12px 0",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderTop: "1px solid var(--md-surface-variant)",
        }}>
          {pendingImages.map((img, i) => (
            <div key={i} style={{ position: "relative", display: "inline-block" }}>
              <img
                src={img.dataUrl}
                alt={img.name}
                style={{
                  width: 56,
                  height: 56,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid var(--md-surface-variant)",
                }}
              />
              <button
                onClick={() => removeImage(i)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--md-error, #B3261E)",
                  color: "#fff",
                  border: "none",
                  fontSize: 10,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  padding: 0,
                }}
                title="Remove image"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: 12,
        borderTop: pendingImages.length ? "none" : "1px solid var(--md-surface-variant)",
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom, 12px))" : 12,
      }}>
        {/* Paperclip button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach image"
          style={{
            background: "none",
            border: "none",
            color: "var(--md-on-surface-variant)",
            fontSize: 18,
            cursor: "pointer",
            padding: "6px",
            borderRadius: 8,
            minWidth: 36,
            minHeight: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >📎</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

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
          disabled={!hasInput || streaming}
          style={{
            background: hasInput && !streaming
              ? "linear-gradient(135deg, #6750A4, #7B68EE)"
              : "var(--md-surface-variant)",
            color: hasInput && !streaming ? "#fff" : "var(--md-on-surface-variant)",
            border: "none",
            padding: "10px 16px",
            borderRadius: 20,
            fontWeight: 600,
            fontSize: 13,
            cursor: hasInput && !streaming ? "pointer" : "default",
            fontFamily: "'Roboto', system-ui, sans-serif",
            minHeight: isMobile ? 44 : "auto",
            minWidth: 60,
            flexShrink: 0,
          }}
        >
          {streaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
