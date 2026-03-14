import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

// Stages ordered to match the actual pipeline execution sequence in scaffold.js:
//   app_created → github_repo → vercel_setup → vercel_deploy → first_deploy → scaffold → ai_codegen → live
//
// IMPORTANT: order matters — sequential halt logic (getSequentialStatuses) relies on it.
// If a stage fails, all subsequent stages are forced to "pending" so we never show
// contradictory states like "Failed + Running simultaneously".
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
    match: null, // derived from app.repo_url
  },
  {
    id: "vercel_setup",
    label: "Setting Up Vercel",
    icon: "▲",
    match: null, // derived from app.vercel_project_id
  },
  {
    id: "vercel_deploy",
    label: "Deploying to Vercel",
    icon: "🚀",
    match: null, // derived from app.vercel_deploy_status
  },
  {
    id: "first_deploy",
    label: "First Deployment",
    icon: "⚙️",
    match: null, // derived from vercel_deploy_status = "ready"
  },
  {
    id: "scaffold",
    label: "Scaffolding Template",
    icon: "🏗️",
    match: /scaffold|template|boilerplate/i,
  },
  {
    id: "ai_codegen",
    label: "AI Generating Code",
    icon: "🤖",
    match: /generat|codegen|ai.+code|build.+initial|initial.+version/i,
  },
  {
    id: "live",
    label: "Live!",
    icon: "🌐",
    match: null, // derived from app.vercel_preview_url or deployed tasks
  },
];

/**
 * Compute the raw status for a single stage (no halt applied).
 * Halt logic is applied separately in getSequentialStatuses.
 */
function getStageStatus(stage, tasks, app) {
  if (stage.id === "app_created") return "completed";

  // Check build_steps from app record (authoritative for scaffold pipeline steps)
  // build_steps is written by scaffold.js as each step runs
  const buildSteps = Array.isArray(app?.build_steps) ? app.build_steps : [];
  const buildStep = buildSteps.find((s) => s.id === stage.id);
  if (buildStep) {
    if (buildStep.status === "done") return "completed";
    if (buildStep.status === "in_progress") return "in_progress";
    if (buildStep.status === "failed") return "failed";
  }

  // github_repo: completed once repo_url is set on the app
  if (stage.id === "github_repo") {
    if (app?.repo_url) return "completed";
    if (app?.status === "scaffolding" || app?.status === "deploying" || app?.status === "building") return "in_progress";
    return "pending";
  }

  // vercel_setup: completed once vercel_project_id is set
  if (stage.id === "vercel_setup") {
    if (app?.vercel_project_id) return "completed";
    if (app?.repo_url && !app?.vercel_project_id && app?.status !== "failed") return "in_progress";
    return "pending";
  }

  // vercel_deploy: tracks the initial Vercel deployment attempt
  // NOTE: do NOT use app.status === "deploying" here — it caused premature in_progress display
  // when earlier steps (github_repo, scaffold, vercel_setup) were still pending.
  if (stage.id === "vercel_deploy") {
    const ds = app?.vercel_deploy_status;
    if (ds === "ready") return "completed";
    if (ds === "error" || ds === "canceled") return "failed";
    if (ds === "deploying") return "in_progress";
    return "pending";
  }

  // first_deploy: completed only when Vercel is fully READY (a successful deployment)
  // Never derives from tasks — only from vercel_deploy_status to avoid false matches.
  if (stage.id === "first_deploy") {
    const ds = app?.vercel_deploy_status;
    if (ds === "ready") return "completed";
    if (ds === "deploying") return "in_progress";
    // error/canceled/not-set → pending (sequential halt propagates failure from vercel_deploy)
    return "pending";
  }

  if (stage.id === "live") {
    // Live only when we have a confirmed preview URL or a deployed task
    if (app?.vercel_preview_url) return "completed";
    if (tasks.some((t) => t.status === "deployed")) return "completed";
    return "pending";
  }

  // Fallback: match by agent_tasks title (for legacy apps without build_steps)
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

/**
 * Compute all stage statuses with sequential halt logic.
 * Once a stage fails, ALL subsequent stages are forced to "pending".
 * This prevents contradictory states like Failed + Running simultaneously.
 */
function getSequentialStatuses(stages, tasks, app) {
  let halted = false;
  return stages.map((stage) => {
    if (halted) return "pending";
    const status = getStageStatus(stage, tasks, app);
    if (status === "failed") halted = true;
    return status;
  });
}

// Truncate long comment text to one line
function trimComment(text) {
  if (!text) return "";
  const single = text.replace(/\n/g, " ").trim();
  return single.length > 90 ? single.slice(0, 87) + "…" : single;
}

// StageRow receives a pre-computed `status` prop (from getSequentialStatuses)
// so sequential halt logic is applied before rendering — never compute status here.
function StageRow({ stage, status, tasks, comments, stepData }) {
  const matchingTasks = stage.match
    ? tasks.filter((t) => stage.match.test(t.title || ""))
    : [];

  // Elapsed time for ai_codegen step
  const [elapsed, setElapsed] = useState(null);
  useEffect(() => {
    if (stage.id !== "ai_codegen" || status !== "in_progress" || !stepData?.started_at) return;
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(stepData.started_at)) / 1000);
      const mins = Math.floor(secs / 60);
      const s = secs % 60;
      setElapsed(mins > 0 ? `${mins}m ${s}s` : `${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [stage.id, status, stepData?.started_at]);

  // For ai_codegen stage: show recent agent comments (file names / progress)
  const stageComments =
    stage.id === "ai_codegen" && matchingTasks.length > 0
      ? comments
          .filter((c) => matchingTasks.some((t) => t.id === c.task_id))
          .slice(-4)
      : [];

  const statusColor = {
    pending: "#79747E",
    in_progress: "#6750A4",
    completed: "#1B5E20",
    failed: "#BA1A1A",
  }[status] || "#79747E";

  const statusIcon = {
    pending: "○",
    in_progress: "◉",
    completed: "✓",
    failed: "✗",
  }[status] || "○";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        padding: "16px 0",
        borderBottom: "1px solid var(--md-outline-variant, #E7E0EC)",
        opacity: status === "pending" ? 0.55 : 1,
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
            status === "completed" ? `${statusColor}18` : "transparent",
        }}
      >
        {statusIcon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
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
              color:
                status === "pending"
                  ? "var(--md-on-surface-variant, #49454F)"
                  : "var(--md-on-surface, #1C1B1F)",
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
                color: "#6750A4",
                background: "rgba(103, 80, 164, 0.12)",
                padding: "2px 8px",
                borderRadius: "12px",
                animation: "buildBlink 1s ease-in-out infinite",
              }}
            >
              {stage.id === "ai_codegen" && elapsed ? `${elapsed} elapsed` : "in progress"}
            </span>
          )}
          {status === "in_progress" && stage.id === "ai_codegen" && (
            <span style={{ fontSize: "11px", color: "#49454F" }}>(may take 5–15 min)</span>
          )}
        </div>
        {matchingTasks.length > 0 && (
          <div style={{ marginTop: "4px" }}>
            {matchingTasks.map((t) => (
              <div
                key={t.id}
                style={{
                  fontSize: "12px",
                  color: "var(--md-on-surface-variant, #49454F)",
                  marginTop: "2px",
                }}
              >
                {t.title}
              </div>
            ))}
          </div>
        )}
        {/* Error detail for failed steps */}
        {status === "failed" && stepData?.error && (
          <div
            style={{
              fontSize: "12px",
              color: "#BA1A1A",
              marginTop: "6px",
              padding: "6px 10px",
              background: "rgba(186, 26, 26, 0.08)",
              borderRadius: "4px",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          >
            ⚠️ {stepData.error}
          </div>
        )}
        {/* AI codegen: live comment feed showing files being created */}
        {stageComments.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 10px",
              background: "var(--md-surface-container, #F5F0FB)",
              borderRadius: "6px",
              borderLeft: "2px solid var(--md-primary, #6750A4)",
            }}
          >
            {stageComments.map((c, i) => (
              <div
                key={c.id || i}
                style={{
                  fontSize: "11px",
                  color:
                    i === stageComments.length - 1
                      ? "#6750A4"
                      : "var(--md-on-surface-variant, #49454F)",
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  marginBottom: i < stageComments.length - 1 ? "3px" : 0,
                  animation:
                    i === stageComments.length - 1
                      ? "buildBlink 1.5s ease-in-out infinite"
                      : "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                📄 {trimComment(c.content)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          color: statusColor,
          fontSize: "13px",
          fontWeight: "600",
          flexShrink: 0,
          paddingTop: "2px",
        }}
      >
        {status === "completed" && "Done"}
        {status === "in_progress" && "Running…"}
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
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const taskMapRef = useRef({});
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

  // Initial app fetch
  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  // Supabase Realtime SSE — build-events stream
  useEffect(() => {
    if (!id) return;

    const es = new EventSource(`/api/apps/${id}/build-events`);

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    // task_update: upsert into task map
    es.addEventListener("task_update", (e) => {
      try {
        const task = JSON.parse(e.data);
        taskMapRef.current = { ...taskMapRef.current, [task.id]: task };
        setTasks(Object.values(taskMapRef.current));
        setLoading(false);
        // Refresh app record when a task deploys (may update vercel_preview_url)
        if (["deployed", "completed"].includes(task.status)) {
          fetchApp();
        }
      } catch {}
    });

    // app_update: app record changed (build_steps, vercel_deploy_status, status, etc.)
    es.addEventListener("app_update", (e) => {
      try {
        const updatedApp = JSON.parse(e.data);
        setApp(updatedApp);
        setLoading(false);
      } catch {}
    });

    // comment: append to comment list (deduplicated by id)
    es.addEventListener("comment", (e) => {
      try {
        const comment = JSON.parse(e.data);
        setComments((prev) => {
          if (prev.some((c) => c.id === comment.id)) return prev;
          return [...prev, comment];
        });
      } catch {}
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.error) setError(data.error);
      } catch {}
    });

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [id, fetchApp]);

  // Fallback polling (slower — SSE is primary)
  useEffect(() => {
    const appInterval = setInterval(fetchApp, 10000);
    return () => clearInterval(appInterval);
  }, [fetchApp]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/apps/${id}/retry`, { method: "POST" });
      if (res.ok) {
        setApp((prev) => ({ ...prev, build_steps: [], status: "scaffolding" }));
        setTasks([]);
        taskMapRef.current = {};
      } else {
        const err = await res.json();
        alert(`Retry failed: ${err.error}`);
      }
    } catch (e) {
      alert(`Retry failed: ${e.message}`);
    } finally {
      setRetrying(false);
    }
  };

  // Compute all stage statuses with sequential halt.
  // Once a stage fails, all subsequent stages are forced to "pending".
  // Pass stageStatuses[i] to each StageRow — never let StageRow compute its own status.
  const stageStatuses = app
    ? getSequentialStatuses(STAGES, tasks, app)
    : STAGES.map(() => "pending");

  // Derived from sequential statuses (single source of truth)
  const liveStatus = stageStatuses[STAGES.length - 1];
  const anyStepFailed = stageStatuses.includes("failed");

  // Derive ai_codegen status for the error banner message
  const aiCodegenIdx = STAGES.findIndex((s) => s.id === "ai_codegen");
  const aiCodegenStatus = stageStatuses[aiCodegenIdx];

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

  const completedCount = stageStatuses.filter((s) => s === "completed").length;
  const progressPct = Math.round((completedCount / STAGES.length) * 100);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--md-surface, #FFFBFE)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--md-on-surface-variant, #49454F)",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--md-surface, #FFFBFE)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          color: "#BA1A1A",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ fontSize: "24px" }}>⚠️ {error}</div>
        <Link to="/" style={{ color: "var(--md-primary, #6750A4)" }}>
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
        background: "var(--md-surface, #FFFBFE)",
        color: "var(--md-on-surface, #1C1B1F)",
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
        @keyframes liveDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div style={{ maxWidth: "620px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              fontSize: "12px",
              color: "var(--md-on-surface-variant, #49454F)",
              marginBottom: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "500",
            }}
          >
            App Factory
            {/* SSE connection indicator — shows stream connectivity, NOT app liveness */}
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: sseConnected ? "#6750A4" : "#E65100",
                  display: "inline-block",
                  animation: "liveDot 1.5s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  color: sseConnected ? "#6750A4" : "#E65100",
                }}
              >
                {sseConnected ? "Connected" : "Connecting…"}
              </span>
            </span>
          </div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "700",
              margin: "0 0 8px",
              color: "var(--md-on-surface, #1C1B1F)",
            }}
          >
            {liveStatus === "completed"
              ? `🎉 ${appName} is live!`
              : anyStepFailed
              ? `⚠️ Build failed for ${appName}`
              : `Building ${appName}…`}
          </h1>
          {liveStatus !== "completed" && !anyStepFailed && (
            <p
              style={{
                color: "var(--md-on-surface-variant, #49454F)",
                margin: 0,
                fontSize: "14px",
              }}
            >
              Watch your app come to life in real time
            </p>
          )}
          {anyStepFailed && (
            <>
              <p
                style={{
                  color: "#BA1A1A",
                  margin: "0 0 16px",
                  fontSize: "14px",
                }}
              >
                A pipeline step failed. See details below.
              </p>
              <button
                onClick={handleRetry}
                disabled={retrying}
                style={{
                  background: retrying ? "#49454F" : "#BA1A1A",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: retrying ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                }}
              >
                {retrying ? "⏳ Restarting…" : "🔄 Retry Build"}
              </button>
              <p style={{ fontSize: "12px", color: "#BA1A1A", marginTop: "6px" }}>
                Restarts from the failed step
              </p>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div
          style={{
            background: "var(--md-surface-variant, #E7E0EC)",
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
                  ? "linear-gradient(90deg, #2E7D32, #1B5E20)"
                  : anyStepFailed
                  ? "linear-gradient(90deg, #BA1A1A, #e53935)"
                  : "linear-gradient(90deg, #6750A4, #9C4AE2)",
              borderRadius: "8px",
              transition: "width 0.6s ease",
            }}
          />
        </div>

        {/* Stages list — status is pre-computed with sequential halt, passed as prop */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid var(--md-outline-variant, #CAC4D0)",
            borderRadius: "12px",
            padding: "8px 24px",
            marginBottom: "24px",
          }}
        >
          {STAGES.map((stage, i) => (
            <StageRow
              key={stage.id}
              stage={stage}
              status={stageStatuses[i]}
              tasks={tasks}
              comments={comments}
              stepData={app?.build_steps?.find((s) => s.id === stage.id)}
            />
          ))}
        </div>

        {/* Vercel deployment error banner */}
        {(app?.vercel_deploy_status === "error" || app?.vercel_deploy_status === "canceled") && !app?.vercel_preview_url && (
          <div
            style={{
              background: "rgba(127, 29, 29, 0.3)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "12px",
              padding: "20px 24px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ fontSize: "22px" }}>⚠️</span>
              <div>
                <div style={{ color: "#fca5a5", fontWeight: "600", marginBottom: "6px" }}>
                  Initial Vercel deployment {app?.vercel_deploy_status === "canceled" ? "was canceled" : "failed"}
                </div>
                <div style={{ color: "#f87171", fontSize: "14px", lineHeight: "1.5" }}>
                  {aiCodegenStatus === "in_progress"
                    ? "The AI code agent is currently generating code — its final push to GitHub will trigger a new Vercel deployment automatically."
                    : aiCodegenStatus === "completed"
                    ? "The AI code agent has finished. A new Vercel deployment should have been triggered by the code push."
                    : "The scaffold triggered a deployment but it did not succeed. Once AI code generation completes, its push to GitHub will trigger a new Vercel deployment."
                  }
                  {" "}Check the{" "}
                  <a
                    href={`https://vercel.com/lautaro450/${app?.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#93c5fd" }}
                  >
                    Vercel dashboard
                  </a>
                  {" "}for build logs.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live banner */}
        {liveStatus === "completed" && (
          <div
            style={{
              background: "rgba(27, 94, 32, 0.08)",
              border: "1px solid rgba(27, 94, 32, 0.3)",
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
                color: "#1B5E20",
                fontWeight: "700",
              }}
            >
              Your app is live!
            </h2>
            {vercelUrl && (
              <>
                <p
                  style={{
                    color: "var(--md-on-surface-variant, #49454F)",
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
                    background: "var(--md-primary, #6750A4)",
                    color: "#FFFFFF",
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
              color: "var(--md-on-surface-variant, #49454F)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            Redirecting to dashboard in {countdown}s…{" "}
            <button
              onClick={() => {
                clearTimeout(countdownRef.current);
                setCountdown(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--md-primary, #6750A4)",
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
              color: "var(--md-primary, #6750A4)",
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
