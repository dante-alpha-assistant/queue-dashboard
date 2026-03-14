import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const STATUS_LABELS = {
  todo: { label: "Queued", color: "#9ca3af" },
  assigned: { label: "Assigned", color: "#f59e0b" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  blocked: { label: "Blocked", color: "#ef4444" },
  qa_testing: { label: "QA Review", color: "#a78bfa" },
  completed: { label: "Completed", color: "#34d399" },
  deploying: { label: "Deploying", color: "#60a5fa" },
  deployed: { label: "Deployed", color: "#34d399" },
  deploy_failed: { label: "Deploy Failed", color: "#ef4444" },
  failed: { label: "Failed", color: "#ef4444" },
};

function TaskBadge({ taskId, initialStatus }) {
  const [task, setTask] = useState({ status: initialStatus, pull_request_url: null });
  const pollRef = useRef(null);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask({ status: data.status, pull_request_url: data.pull_request_url });
      }
    } catch {
      // silent
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    fetchTask();
    pollRef.current = setInterval(fetchTask, 5000);
    return () => clearInterval(pollRef.current);
  }, [taskId, fetchTask]);

  if (!taskId) return null;

  const statusInfo = STATUS_LABELS[task.status] || { label: task.status, color: "#9ca3af" };
  const prUrl = Array.isArray(task.pull_request_url)
    ? task.pull_request_url[0]
    : task.pull_request_url;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 8px",
          borderRadius: "12px",
          fontSize: "11px",
          fontWeight: "600",
          background: `${statusInfo.color}20`,
          color: statusInfo.color,
          border: `1px solid ${statusInfo.color}40`,
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: statusInfo.color,
            display: "inline-block",
          }}
        />
        {statusInfo.label}
      </span>
      {prUrl && (
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "11px",
            color: "#60a5fa",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          View PR →
        </a>
      )}
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  const taskId = msg.task_id || msg.metadata?.task_id;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isUser ? "#1d4ed8" : "#1e1e2e",
          border: isUser ? "none" : "1px solid #2d2d3a",
          color: "#f3f4f6",
          fontSize: "14px",
          lineHeight: "1.5",
          wordBreak: "break-word",
        }}
      >
        {msg.content}
        {taskId && (
          <TaskBadge taskId={taskId} initialStatus={msg.metadata?.task_status} />
        )}
      </div>
      <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px" }}>
        {msg.role === "user" ? "You" : "Neo"} ·{" "}
        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

export default function AppChatInterface({ appId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const realtimeRef = useRef(null);
  const pollRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/apps/${appId}/chat?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  // Initial load + poll fallback every 5s
  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  // Supabase Realtime subscription (if env vars available)
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    let channel = null;
    let client = null;

    import("@supabase/supabase-js").then(({ createClient }) => {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      channel = client
        .channel(`app_chat:${appId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "app_chat_messages",
            filter: `app_id=eq.${appId}`,
          },
          (payload) => {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();
      realtimeRef.current = { client, channel };
    });

    return () => {
      if (realtimeRef.current) {
        const { client, channel } = realtimeRef.current;
        client.removeChannel(channel);
      }
    };
  }, [appId]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInput("");

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      app_id: appId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
      task_id: null,
      metadata: {},
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/apps/${appId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh to get the real message + ack
      await fetchMessages();
    } catch (e) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(trimmed);
      setError(`Send failed: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const examples = [
    "Add a dark mode toggle",
    "Change the header color to blue",
    "Add an export to CSV button",
    "Add a search bar to the main table",
  ];

  return (
    <div
      style={{
        background: "#111827",
        borderRadius: "16px",
        border: "1px solid #1f2937",
        overflow: "hidden",
        marginTop: "32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #1f2937",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#0f172a",
        }}
      >
        <span style={{ fontSize: "20px" }}>💬</span>
        <div>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f3f4f6" }}>
            Evolve your app through conversation
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Describe a change — an agent will make it, open a PR, and deploy it
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          height: "360px",
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {loading ? (
          <div style={{ color: "#6b7280", textAlign: "center", marginTop: "80px" }}>
            Loading messages...
          </div>
        ) : error ? (
          <div style={{ color: "#ef4444", textAlign: "center", marginTop: "80px", fontSize: "13px" }}>
            ⚠️ {error}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>✨</div>
            <div style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "20px", textAlign: "center" }}>
              Ask me to change anything about your app
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "380px" }}>
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  style={{
                    background: "#1e1e2e",
                    border: "1px solid #2d2d3a",
                    borderRadius: "10px",
                    padding: "8px 14px",
                    color: "#9ca3af",
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.borderColor = "#4f46e5")}
                  onMouseLeave={(e) => (e.target.style.borderColor = "#2d2d3a")}
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #1f2937",
          display: "flex",
          gap: "8px",
          alignItems: "flex-end",
          background: "#0f172a",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Describe a change, e.g. "Add a dark mode toggle"'
          disabled={sending}
          rows={1}
          style={{
            flex: 1,
            background: "#1e1e2e",
            border: "1px solid #2d2d3a",
            borderRadius: "10px",
            color: "#f3f4f6",
            padding: "10px 14px",
            fontSize: "14px",
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: "1.5",
            maxHeight: "120px",
            overflow: "auto",
          }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() && !sending ? "#4f46e5" : "#1e1e2e",
            border: "none",
            borderRadius: "10px",
            color: input.trim() && !sending ? "#fff" : "#6b7280",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: input.trim() && !sending ? "pointer" : "not-allowed",
            transition: "background 0.2s",
            whiteSpace: "nowrap",
            minHeight: "42px",
          }}
        >
          {sending ? "Sending..." : "Send →"}
        </button>
      </div>
    </div>
  );
}
