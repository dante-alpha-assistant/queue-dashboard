import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

const STAGES = [
  {
    id: "app_created",
    label: "App Created",
    icon: "🎉",
    match: null, // always completed immediately
  },
  {
    id: "github_repo",
    label: "Creating GitHub Repo",
    icon: "🐙",
    match: /github|repo/i,
  },
  {
    id: "scaffold",
    label: "Scaffolding Template",
    icon: "🏗️",
    match: /scaffold|template|next\.?js|boilerplate/i,
  },
  {
    id: "ai_codegen",
    label: "AI Generating Code",
    icon: "🤖",
    match: /generat|codegen|ai.+code|pages|api.+route/i,
  },
  {
    id: "vercel_setup",
    label: "Setting Up Vercel",
    icon: "▲",
    match: /vercel|project.+creat/i,
  },
  {
    id: "first_deploy",
    label: "First Deployment",
    icon: "🚀",
    match: /deploy|build/i,
  },
  {
    id: "live",
    label: "Live!",
    icon: "🌐",
    match: null, // special: check app.vercel_preview_url or deployed tasks
  },
];

function getStageStatus(stage, tasks, app) {
  if (stage.id === "app_created") return "completed";
  if (stage.id === "live") {
    if (app?.vercel_preview_url) return "completed";
    if (tasks.some((t) => t.status === "deployed")) return "completed";
    return "pending";
  }

  const matching = tasks.filter(
    (t) => stage.match && stage.match.test(t.title || "")
  );
  if (matching.length === 0) return "pending";
  if (matching.some((t) => t.status === "failed")) return "failed";
  if (matching.every((t) => ["completed", "deployed"].includes(t.status)))
    return "completed";
  if (
    matching.some((t) =>
      ["in_progress", "qa_testing", "assigned", "deploying"].includes(t.status)
    )
  )
    return "in_progress";
  return "pending";
}

function StageRow({ stage, tasks, app }) {
  const status = getStageStatus(stage, tasks, app);
  const matchingTasks = stage.match
    ? tasks.filter((t) => stage.match.test(t.title || ""))
    : [];

  const statusColor = {
    pending: "#6b7280",
    in_progress: "#60a5fa",
    completed: "#34d399",
    failed: "#f87171",
  }[status];

  const statusIcon = {
    pending: "○",
    in_progress: "◉",
    completed: "✓",
    failed: "✗",
  }[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        padding: "16px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        opacity: status === "pending" ? 0.5 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: `2px solid ${statusColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: statusColor,
          fontWeight: "bold",
          fontSize: "14px",
          flexShrink: 0,
          animation:
            status === "in_progress"
              ? "buildPulse 1.5s ease-in-out infinite"
              : "none",
          background:
            status === "completed" ? `${statusColor}22` : "transparent",
        }}
      >
        {statusIcon}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "18px" }}>{stage.icon}</span>
          <span
            style={{
              color: status === "pending" ? "#9ca3af" : "#f3f4f6",
              fontWeight: status === "completed" ? "600" : "400",
              fontSize: "16px",
            }}
          >
            {stage.label}
          </span>
          {status === "in_progress" && (
            <span
              style={{
                fontSize: "12px",
                color: "#60a5fa",
                background: "rgba(96, 165, 250, 0.15)",
                padding: "2px 8px",
                borderRadius: "12px",
                animation: "buildBlink 1s ease-in-out infinite",
              }}
            >
              in progress
            </span>
          )}
        </div>
        {matchingTasks.length > 0 && (
          <div style={{ marginTop: "4px" }}>
            {matchingTasks.map((t) => (
              <div
                key={t.id}
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginTop: "2px",
                }}
              >
                {t.title}
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          color: statusColor,
          fontSize: "14px",
          fontWeight: "500",
          flexShrink: 0,
          paddingTop: "2px",
        }}
      >
        {status === "completed" && "Done"}
        {status === "in_progress" && "Running..."}
        {status === "failed" && "Failed"}
      </div>
    </div>
  );
}

export default function AppBuildProgress() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const taskIdsRef = useRef(new Set());
  const countdownRef = useRef(null);

  const fetchApp = useCallback(async () => {
    try {
      const res = await fetch(`/api/apps/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("App not found");
        return;
      }
      const data = await res.json();
      setApp(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/apps/${id}/tasks`);
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data || []);
      taskIdsRef.current = new Set((data || []).map((t) => t.id));
    } catch {
      // ignore fetch errors silently
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    fetchApp();
    fetchTasks();
  }, [fetchApp, fetchTasks]);

  // Polling
  useEffect(() => {
    const appInterval = setInterval(fetchApp, 3000);
    const taskInterval = setInterval(fetchTasks, 5000);
    return () => {
      clearInterval(appInterval);
      clearInterval(taskInterval);
    };
  }, [fetchApp, fetchTasks]);

  // SSE subscription for real-time task status changes
  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("task:status", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (taskIdsRef.current.has(data.taskId)) {
          fetchTasks();
          fetchApp();
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [fetchTasks, fetchApp]);

  // Determine if the app is live
  const liveStatus = app
    ? getStageStatus(STAGES[STAGES.length - 1], tasks, app)
    : "pending";

  // Start countdown when live
  useEffect(() => {
    if (liveStatus === "completed" && countdown === null) {
      setCountdown(8);
    }
  }, [liveStatus, countdown]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      navigate("/");
      return;
    }
    countdownRef.current = setTimeout(
      () => setCountdown((c) => c - 1),
      1000
    );
    return () => clearTimeout(countdownRef.current);
  }, [countdown, navigate]);

  const completedCount = app
    ? STAGES.filter((s) => getStageStatus(s, tasks, app) === "completed").length
    : 0;
  const progressPct = Math.round((completedCount / STAGES.length) * 100);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f0f1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9ca3af",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f0f1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          color: "#f87171",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ fontSize: "24px" }}>⚠️ {error}</div>
        <Link to="/" style={{ color: "#60a5fa" }}>
          ← Back to task board
        </Link>
      </div>
    );
  }

  const appName = app?.name || app?.slug || "your app";
  const vercelUrl = app?.vercel_preview_url;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f1a",
        color: "#f3f4f6",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: "40px 20px",
      }}
    >
      <style>{`
        @keyframes buildPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
        }
        @keyframes buildBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={{ maxWidth: "620px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginBottom: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            App Factory
          </div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "700",
              margin: "0 0 8px",
            }}
          >
            {liveStatus === "completed"
              ? `🎉 ${appName} is live!`
              : `Building ${appName}...`}
          </h1>
          {liveStatus !== "completed" && (
            <p
              style={{
                color: "#9ca3af",
                margin: 0,
                fontSize: "14px",
              }}
            >
              Watch your app come to life in real time
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: "8px",
            height: "8px",
            marginBottom: "32px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background:
                liveStatus === "completed"
                  ? "linear-gradient(90deg, #34d399, #10b981)"
                  : "linear-gradient(90deg, #60a5fa, #818cf8)",
              borderRadius: "8px",
              transition: "width 0.6s ease",
            }}
          />
        </div>

        {/* Stages list */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "8px 24px",
            marginBottom: "24px",
          }}
        >
          {STAGES.map((stage) => (
            <StageRow key={stage.id} stage={stage} tasks={tasks} app={app} />
          ))}
        </div>

        {/* Live banner */}
        {liveStatus === "completed" && (
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(16, 185, 129, 0.1))",
              border: "1px solid rgba(52, 211, 153, 0.3)",
              borderRadius: "12px",
              padding: "24px",
              textAlign: "center",
              marginBottom: "24px",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎊</div>
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: "22px",
                color: "#34d399",
                fontWeight: "700",
              }}
            >
              Your app is live!
            </h2>
            {vercelUrl && (
              <>
                <p
                  style={{
                    color: "#9ca3af",
                    margin: "0 0 16px",
                    fontSize: "14px",
                  }}
                >
                  {vercelUrl.replace(/^https?:\/\//, "")}
                </p>
                <a
                  href={
                    vercelUrl.startsWith("http")
                      ? vercelUrl
                      : `https://${vercelUrl}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    background: "#34d399",
                    color: "#0f0f1a",
                    padding: "12px 28px",
                    borderRadius: "8px",
                    fontWeight: "700",
                    textDecoration: "none",
                    fontSize: "15px",
                  }}
                >
                  Open App →
                </a>
              </>
            )}
          </div>
        )}

        {/* Countdown */}
        {countdown !== null && countdown > 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#6b7280",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            Redirecting to dashboard in {countdown}s...{" "}
            <button
              onClick={() => {
                clearTimeout(countdownRef.current);
                setCountdown(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                fontSize: "13px",
                padding: 0,
              }}
            >
              Stay here
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center" }}>
          <Link
            to="/"
            style={{
              color: "#6b7280",
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            View all tasks →
          </Link>
        </div>
      </div>
    </div>
  );
}
