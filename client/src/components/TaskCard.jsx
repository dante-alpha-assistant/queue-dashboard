import { useState, useEffect, useCallback, useRef } from "react";
import {
  PriorityDot, TaskTypeIcon, BlockerTypeIcon, AgentAvatar,
  RefreshIcon, UserPlusIcon, RocketIcon, KeyIcon, MessageSquareIcon,
  FolderIcon, SearchCheckIcon, PauseIcon, SlashIcon,
  KubernetesIcon, GitMergeIcon,
  BlockerIcon, RetryIcon, DeployIcon, AssignIcon, ChatIcon,
  QAIcon, WaitingIcon, BlockedIcon, UserIcon,
} from './Icons';

const BLOCKER_TYPE_STYLES = {
  missing_credential: { color: "#E65100", bg: "#E6510018", label: "Missing Credential" },
  missing_config: { color: "#E65100", bg: "#E6510018", label: "Missing Config" },
  permission_denied: { color: "#C62828", bg: "#C6282818", label: "Permission Denied" },
  permission: { color: "#C62828", bg: "#C6282818", label: "Permission" },
  ambiguous_requirement: { color: "#1565C0", bg: "#1565C018", label: "Ambiguous" },
  ambiguous: { color: "#1565C0", bg: "#1565C018", label: "Ambiguous" },
  external_dependency: { color: "#6A1B9A", bg: "#6A1B9A18", label: "External Dep" },
  infrastructure: { color: "#AD1457", bg: "#AD145718", label: "Infrastructure" },
  human_decision: { color: "#00695C", bg: "#00695C18", label: "Human Decision" },
};

const AGENT_ROLES = { neo: "Builder", alpha: "Leader", beta: "QA", mu: "Builder", flow: "Orchestrator", ifra: "Ops" };
const STATUS_COLORS = {
  todo: "#79747E", assigned: "#6750A4", in_progress: "#E8A317", running: "#E8A317",
  failed: "#BA1A1A", qa: "#5E35B1", qa_testing: "#5E35B1",
  completed: "#1B5E20", deployed: "#00838F", blocked: "#D84315",
  deploying: "#F57C00", deploy_failed: "#C62828",
};
const STATUS_BG = {
  todo: "#79747E14", assigned: "#6750A414", in_progress: "#E8A31714", running: "#E8A31714",
  failed: "#BA1A1A14", qa: "#5E35B114", qa_testing: "#5E35B114",
  completed: "#1B5E2014", deployed: "#00838F14", blocked: "#D8431514",
  deploying: "#F57C0014", deploy_failed: "#C6282814",
};
const PRIORITY_MAP = {
  urgent: { color: "#D32F2F", bg: "#D32F2F14", label: "Urgent", icon: "🔴" },
  high: { color: "#E65100", bg: "#E6510014", label: "High", icon: "🟠" },
  normal: null,
  low: { color: "#757575", bg: "#75757514", label: "Low", icon: "⚪" },
};
const TYPE_COLORS = {
  coding: "#6750A4", research: "#0061A4", ops: "#7D5260", general: "#79747E", test: "#386A20",
};
const STAGE_COLORS = {
  refinery: "#E65100", foundry: "#1565C0", builder: "#2E7D32", inspector: "#6A1B9A", deployer: "#00838F",
};
const STAGES = ["refinery", "foundry", "builder", "inspector", "deployer"];
const STAGE_LABELS = { refinery: "Refine", foundry: "Found", builder: "Build", inspector: "Inspect", deployer: "Deploy" };
const STAGE_SHORT = { refinery: "REF", foundry: "FND", builder: "BLD", inspector: "INS", deployer: "DEP" };
const ACTIVE_STATUSES = new Set(["in_progress", "running", "qa_testing", "completed"]);

function formatDuration(ms) {
  if (!ms || ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Pipeline Stepper ─────────────────────────────────────── */
function PipelineStepper({ stage, isMobile }) {
  if (!stage) return null;
  const currentIdx = STAGES.indexOf(stage);
  if (currentIdx === -1) return null;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start",
      margin: "12px 0 8px", padding: "8px 12px",
      gap: 0,
      background: "var(--md-surface-container-low, #F7F2FA)",
      borderRadius: 12,
    }}>
      {STAGES.map((s, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        const color = isCurrent ? (STAGE_COLORS[s] || "#79747E") : isCompleted ? "#386A20" : "var(--md-outline-variant, #CAC4D0)";
        const label = isMobile ? STAGE_SHORT[s] : STAGE_LABELS[s];
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              minWidth: isMobile ? 38 : 48, gap: 6,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                border: `2px solid ${color}`,
                background: (isCompleted || isCurrent) ? color : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                animation: isCurrent ? "timeline-pulse 2s ease-in-out infinite" : "none",
                transition: "all 200ms ease",
              }}>
                {isCompleted && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: isMobile ? 10 : 11,
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? color : isCompleted ? "#386A20" : "var(--md-outline-variant, #CAC4D0)",
                letterSpacing: isMobile ? "0.01em" : "0.03em",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}>{label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: isMobile ? 8 : 12,
                background: isCompleted ? "#386A20" : "var(--md-surface-variant, #E7E0EC)",
                marginTop: -14, borderRadius: 1,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Duration Ticker ──────────────────────────────────────── */
const TERMINAL_STATUSES = new Set(["deployed", "failed", "cancelled", "deploy_failed"]);

function DurationTicker({ updatedAt, startedAt, completedAt, active, status }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const stateEnteredAt = startedAt || updatedAt;
  if (!stateEnteredAt) return null;

  // Completed: live ticker counting time waiting for deploy (from completed_at)
  // Deployed: frozen duration from completed_at to updated_at (deploy time)
  // Other terminal: frozen at completion
  // Active: live ticker from state entry
  const isTerminal = TERMINAL_STATUSES.has(status);
  let elapsed;
  if (status === "completed") {
    // Live ticker: time since task was completed, waiting for deploy
    const from = completedAt ? new Date(completedAt).getTime() : new Date(updatedAt).getTime();
    elapsed = now - from;
  } else if (status === "deployed") {
    // Frozen: show how long it waited between completion and deployment
    const from = completedAt ? new Date(completedAt).getTime() : new Date(stateEnteredAt).getTime();
    const end = new Date(updatedAt).getTime();
    elapsed = end - from;
  } else if (isTerminal) {
    const end = completedAt ? new Date(completedAt).getTime() : new Date(updatedAt).getTime();
    elapsed = end - new Date(stateEnteredAt).getTime();
  } else if (active) {
    elapsed = now - new Date(stateEnteredAt).getTime();
  } else {
    elapsed = Date.now() - new Date(stateEnteredAt).getTime();
  }
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums",
      color: active ? "#E8A317" : "var(--md-on-surface-variant, #49454F)",
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
      {formatDuration(elapsed)}
    </span>
  );
}

/* ── Badge (pill) ─────────────────────────────────────────── */
function Badge({ label, color, bg, style: extraStyle }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100,
      background: bg || `${color}14`, color: color,
      textTransform: "uppercase", letterSpacing: "0.04em",
      lineHeight: 1.2, whiteSpace: "nowrap",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      display: "inline-block",
      ...extraStyle,
    }}>{label}</span>
  );
}

/* ── Blocker Badge ────────────────────────────────────────── */
function BlockerBadge({ task }) {
  const blockerType = task.metadata?.blocker?.type;
  if (!blockerType) return null;
  const style = BLOCKER_TYPE_STYLES[blockerType] || { color: "#79747E", bg: "#79747E18", label: blockerType.replace(/_/g, " ") };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100,
      background: style.bg, color: style.color,
      textTransform: "uppercase", letterSpacing: "0.04em",
      lineHeight: 1.2, whiteSpace: "nowrap",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <BlockerTypeIcon type={blockerType} size={12} color={style.color} />
      {style.label}
    </span>
  );
}

/* ── Blocked Duration Ticker ──────────────────────────────── */
function BlockedDurationTicker({ task }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Use updated_at as when task entered blocked status
  const blockedSince = task.updated_at;
  if (!blockedSince) return null;
  const elapsed = now - new Date(blockedSince).getTime();
  if (elapsed < 0) return null;

  const isLong = elapsed > 3600000; // > 1 hour

  return (
    <span style={{
      fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums",
      color: isLong ? "#C62828" : "#D84315",
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 100,
      background: isLong ? "#C6282812" : "#D8431512",
    }}>
      <SlashIcon size={11} color="currentColor" /> Blocked {formatDuration(elapsed)}
    </span>
  );
}

/* ── Quick Action Buttons for Blocked Cards ───────────────── */
function BlockedQuickActions({ task, onStatusChange }) {
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const blockerType = task.metadata?.blocker?.type;
  const requiredInputs = task.metadata?.blocker?.required_inputs || [];

  const btnStyle = {
    fontSize: 11, border: "none", padding: "6px 12px", borderRadius: 100,
    cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
    transition: "all 150ms ease", fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  };

  const handleUnblock = async (humanInput) => {
    setSubmitting(true);
    try {
      await onStatusChange?.(task.id, {
        status: "todo", human_input: humanInput || null,
        assigned_agent: null, dispatch_retries: 0, idle_retries: 0,
      });
      setInput("");
      setShowInput(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
      {(blockerType === "missing_credential" || blockerType === "missing_config" || requiredInputs.length > 0) && (
        <button
          onClick={() => setShowInput(v => !v)}
          style={{ ...btnStyle, background: "#E6510018", color: "#E65100" }}
        ><KeyIcon size={12} color="#E65100" /> Provide Keys</button>
      )}
      {(blockerType === "ambiguous_requirement" || blockerType === "ambiguous" || blockerType === "human_decision") && (
        <button
          onClick={() => setShowInput(v => !v)}
          style={{ ...btnStyle, background: "#1565C018", color: "#1565C0" }}
        ><MessageSquareIcon size={12} color="#1565C0" /> Clarify</button>
      )}
      <button
        onClick={() => handleUnblock(null)}
        disabled={submitting}
        style={{ ...btnStyle, background: "#2E7D3218", color: "#2E7D32", opacity: submitting ? 0.6 : 1 }}
      ><RefreshIcon size={12} color="#2E7D32" /> Retry</button>

      {showInput && (
        <div style={{
          width: "100%", display: "flex", gap: 6, marginTop: 4,
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={requiredInputs[0]?.placeholder || "Enter response..."}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, fontSize: 12, padding: "6px 10px", borderRadius: 8,
              border: "1px solid var(--md-surface-variant, #E7E0EC)",
              background: "var(--md-surface, #FFFBFE)",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              outline: "none",
            }}
          />
          <button
            onClick={() => handleUnblock(input)}
            disabled={submitting || !input.trim()}
            style={{ ...btnStyle, background: "#2E7D32", color: "#fff", opacity: (submitting || !input.trim()) ? 0.5 : 1 }}
          >Submit</button>
        </div>
      )}
    </div>
  );
}

/* ── Action Bar ───────────────────────────────────────────── */
const DEPLOY_TARGET_OPTIONS = [
  { value: "kubernetes", label: "Kubernetes", IconComponent: KubernetesIcon },
  { value: "vercel", label: "Vercel", IconComponent: null },
  { value: "railway", label: "Railway", IconComponent: null },
  { value: "none", label: "None (merge only)", IconComponent: GitMergeIcon },
];

function ActionBar({ task, onStatusChange, isMobile }) {
  const [showPicker, setShowPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [humanInput, setHumanInput] = useState("");
  const [unblocking, setUnblocking] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState(null);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [showDeployTargetPicker, setShowDeployTargetPicker] = useState(false);
  const deployPollRef = useRef(null);
  const deployTimeoutRef = useRef(null);

  const stopDeployPolling = useCallback(() => {
    clearInterval(deployPollRef.current);
    clearTimeout(deployTimeoutRef.current);
    deployPollRef.current = null;
    deployTimeoutRef.current = null;
  }, []);

  // Cleanup polling on unmount
  useEffect(() => () => stopDeployPolling(), [stopDeployPolling]);

  // Auto-clear deploy success after 3s
  useEffect(() => {
    if (deploySuccess) {
      const t = setTimeout(() => setDeploySuccess(false), 3000);
      return () => clearTimeout(t);
    }
  }, [deploySuccess]);

  // Sync with Realtime status updates
  useEffect(() => {
    if (task.status === 'deployed' || task.status === 'deploy_failed') {
      stopDeployPolling();
      if (deploying) {
        setDeploying(false);
        setDeploySuccess(task.status === 'deployed');
        if (task.status === 'deploy_failed') {
          setDeployError('Deploy failed');
          setTimeout(() => setDeployError(null), 5000);
        }
      }
    }
  }, [task.status, stopDeployPolling, deploying]);

  const btnBase = {
    fontSize: 12, border: "none", padding: isMobile ? "8px 18px" : "7px 16px",
    borderRadius: 100, cursor: "pointer", fontWeight: 600,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    minHeight: isMobile ? 44 : 34, letterSpacing: "0.02em",
    transition: "all 150ms ease",
    display: "inline-flex", alignItems: "center", gap: 6,
  };

  const handleAssign = async (agentId) => {
    setShowPicker(false);
    setAssigning(true);
    setAssignError(null);
    try {
      await onStatusChange?.(task.id, { status: "assigned", assigned_agent: agentId });
    } catch (e) {
      setAssignError(e.message || "Assignment failed");
      setTimeout(() => setAssignError(null), 3000);
    } finally {
      setAssigning(false);
    }
  };

  const actions = [];

  if (task.status === "failed") {
    actions.push(
      <button
        key="retry"
        onClick={(e) => { e.stopPropagation(); onStatusChange?.(task.id, { status: 'todo', assigned_agent: null, idle_retries: 0, qa_retries: 0 }); }}
        style={{ ...btnBase, background: "#E65100", color: "#fff" }}
      >
        <RefreshIcon size={14} />
        Retry
      </button>
    );
  }

  const handleDeploy = async (targetOverride) => {
    setDeploying(true);
    setDeployError(null);
    setDeploySuccess(false);
    stopDeployPolling();
    try {
      // If no deploy_target set and no override, prompt user to pick one
      if (!task.deploy_target && !targetOverride) {
        setShowDeployTargetPicker(true);
        setDeploying(false);
        return;
      }
      // If we need to set deploy_target first
      if (targetOverride) {
        await onStatusChange?.(task.id, { deploy_target: targetOverride });
        setShowDeployTargetPicker(false);
      }
      const resp = await fetch(`/api/deploy/${task.id}`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Deploy failed (HTTP ${resp.status})`);
      }
      // If task is already deployed/deploy_failed, no Realtime update will come
      if (task.status === 'deployed' || task.status === 'deploy_failed') {
        setDeploying(false);
        setDeploySuccess(task.status === 'deployed');
        return;
      }
      // Start polling as fallback in case Realtime doesn't fire
      deployPollRef.current = setInterval(async () => {
        try {
          const pollResp = await fetch(`/api/tasks/${task.id}`);
          if (pollResp.ok) {
            const pollData = await pollResp.json();
            const st = pollData?.status || pollData?.task?.status;
            if (st === 'deployed' || st === 'deploy_failed') {
              stopDeployPolling();
              setDeploying(false);
              setDeploySuccess(st === 'deployed');
              if (st === 'deploy_failed') {
                setDeployError('Deploy failed');
                setTimeout(() => setDeployError(null), 5000);
              }
            }
          }
        } catch (_) { /* ignore poll errors */ }
      }, 5000);
      // Timeout: reset spinner after 30s no matter what
      deployTimeoutRef.current = setTimeout(() => {
        stopDeployPolling();
        setDeploying(false);
        setDeployError('Deploy may still be in progress. Refresh to check status.');
        setTimeout(() => setDeployError(null), 8000);
      }, 30000);
    } catch (e) {
      stopDeployPolling();
      setDeploying(false);
      setDeployError(e.message || "Deploy failed");
      setTimeout(() => setDeployError(null), 5000);
    }
  };

  if (task.status === "completed") {
    actions.push(
      <div key="deploy" style={{ position: "relative" }}>
        <button
          onClick={(e) => { e.stopPropagation(); handleDeploy(); }}
          disabled={deploying}
          style={{
            ...btnBase,
            background: deploying ? "var(--md-outline, #79747E)" : deploySuccess ? "#2E7D32" : "#00838F",
            color: "#fff",
            opacity: deploying ? 0.7 : 1,
          }}
        >
          {deploying ? (
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : deploySuccess ? (
            <span style={{ fontSize: 14, lineHeight: 1 }}>✅</span>
          ) : (
            <RocketIcon size={14} />
          )}
          {deploying ? "Deploying…" : deploySuccess ? "Deployed!" : "Deploy"}
        </button>
        {showDeployTargetPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", bottom: "calc(100% + 4px)", right: 0,
              background: "var(--md-surface, #FFFBFE)",
              border: "1px solid var(--md-surface-variant, #E7E0EC)",
              borderRadius: 12, padding: 8, zIndex: 20,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 180,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--md-outline, #79747E)", padding: "4px 8px 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Select deploy target
            </div>
            {DEPLOY_TARGET_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={(e) => { e.stopPropagation(); handleDeploy(opt.value); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "8px 12px", border: "none", background: "transparent",
                  borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
                  color: "var(--md-on-surface, #1C1B1F)",
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--md-surface-container-low, #F7F2FA)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  {opt.IconComponent ? <opt.IconComponent size={14} /> : <RocketIcon size={14} />}
                </span>
                <span>{opt.label}</span>
              </button>
            ))}
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeployTargetPicker(false); }}
              style={{
                display: "block", width: "100%", padding: "6px 12px", border: "none",
                background: "transparent", borderRadius: 8, cursor: "pointer",
                fontSize: 11, color: "var(--md-outline, #79747E)", textAlign: "center",
                marginTop: 4, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  if (task.status === "todo") {
    actions.push(
      <div key="assign" style={{ position: "relative" }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
          disabled={assigning}
          style={{
            ...btnBase,
            background: assigning ? "var(--md-outline, #79747E)" : "var(--md-primary, #6750A4)",
            color: "var(--md-on-primary, #fff)",
            opacity: assigning ? 0.7 : 1,
          }}
        >
          {assigning ? (
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : (
            <UserPlusIcon size={14} color="var(--md-on-primary, #fff)" />
          )}
          {assigning ? "Assigning…" : "Assign"}
        </button>
        {showPicker && (
          <AgentPicker
            onSelect={handleAssign}
            onCancel={() => setShowPicker(false)}
          />
        )}
      </div>
    );
  }

  if (task.status === "blocked") {
    return (
      <div style={{
        padding: "10px 16px 12px",
        borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
      }} onClick={e => e.stopPropagation()}>
        {task.blocked_reason && (
          <div style={{
            fontSize: 12, color: "#D84315", fontWeight: 500, marginBottom: 8,
            display: "flex", alignItems: "flex-start", gap: 6,
          }}>
            <SlashIcon size={14} color="#D84315" />
            <span>{task.blocked_reason}</span>
          </div>
        )}
        <BlockedQuickActions task={task} onStatusChange={onStatusChange} />
        {assignError && (
          <span style={{ fontSize: 12, color: "#BA1A1A", fontWeight: 500, marginTop: 6, display: "block" }}>
            <AlertTriangle size={14} /> {assignError}
          </span>
        )}
      </div>
    );
  }

  if (actions.length === 0 && !assignError && !deployError) return null;

  return (
    <div style={{
      display: "flex", gap: 8, padding: "10px 16px 12px",
      justifyContent: "flex-end", alignItems: "center",
      borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
      flexWrap: "wrap",
    }}>
      {(assignError || deployError) && (
        <span style={{ fontSize: 12, color: "#BA1A1A", fontWeight: 500, marginRight: "auto" }}>
          <AlertTriangle size={14} /> {assignError || deployError}
        </span>
      )}
      {actions}
    </div>
  );
}

/* ── Task Card ────────────────────────────────────────────── */
export default function TaskCard({ task, onStatusChange, onCardClick, isMobile, progress, monitor, transitioning }) {
  const agent = task.assigned_agent?.toLowerCase();
  const role = AGENT_ROLES[agent] || "Agent";
  const statusColor = STATUS_COLORS[task.status] || "#79747E";
  const isActive = ACTIVE_STATUSES.has(task.status);
  const priority = PRIORITY_MAP[task.priority];
  const typeColor = TYPE_COLORS[task.type] || "#79747E";

  // Blocked > 1 hour pulse
  const blockedMs = task.status === "blocked" && task.updated_at
    ? Date.now() - new Date(task.updated_at).getTime() : 0;
  const blockedLong = blockedMs > 3600000;

  const resultText = task.result
    ? (typeof task.result === "string" ? task.result : (task.result.summary || JSON.stringify(task.result)))
    : null;
  const errorText = task.error || null;
  const consoleText = resultText || errorText;
  const isError = !resultText && !!errorText;

  return (
    <div onClick={() => !transitioning && onCardClick?.(task)} style={{
      background: "var(--md-surface, #FFFBFE)",
      borderRadius: 16,
      border: "1px solid var(--md-surface-variant, #E7E0EC)",
      borderLeft: `4px solid ${statusColor}`,
      marginBottom: 12,
      transition: "box-shadow 200ms ease, transform 100ms ease, opacity 200ms ease",
      cursor: transitioning ? "not-allowed" : "pointer",
      overflow: "hidden",
      fontFamily: "'Roboto', system-ui, -apple-system, sans-serif",
      opacity: transitioning ? 0.7 : task.paused ? 0.6 : (task.status === "qa_testing" && !task.assigned_agent ? 0.65 : 1),
      position: "relative",
      pointerEvents: transitioning ? "none" : "auto",
    }}
    onMouseEnter={(e) => { if (!transitioning) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Blocked > 1hr pulse dot */}
      {blockedLong && (
        <div style={{
          position: "absolute", top: 10, right: 10, zIndex: 5,
          width: 10, height: 10, borderRadius: "50%",
          background: "#C62828",
          animation: "blocked-pulse 2s ease-in-out infinite",
        }} />
      )}
      {/* Transition loading overlay */}
      {transitioning && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(255,251,254,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 16,
          backdropFilter: "blur(1px)",
        }}>
          <div style={{
            width: 28, height: 28, border: "3px solid var(--md-surface-variant, #E7E0EC)",
            borderTopColor: statusColor, borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      )}
      {/* ── Header: badges + duration ───────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 16px 8px", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
          <Badge
            label={task.status.replace("_", " ")}
            color={statusColor}
            bg={STATUS_BG[task.status] || `${statusColor}14`}
          />
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100,
            background: `${typeColor}14`, color: typeColor,
            textTransform: "uppercase", letterSpacing: "0.04em",
            lineHeight: 1.2, whiteSpace: "nowrap",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <TaskTypeIcon type={task.type} size={11} color={typeColor} />
            {task.type}
          </span>
          {priority && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100,
              background: priority.bg, color: priority.color,
              textTransform: "uppercase", letterSpacing: "0.04em",
              lineHeight: 1.2, whiteSpace: "nowrap",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <PriorityDot priority={task.priority} size={8} />
              {priority.label}
            </span>
          )}
          {task.status === "blocked" && <BlockerBadge task={task} />}
          {task.paused && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100,
              background: "#E6510020", color: "#E65100",
              display: "inline-flex", alignItems: "center", gap: 4,
              textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            }}>
              <PauseIcon size={11} color="#E65100" /> Paused
            </span>
          )}
          {task.status === "qa_testing" && (
            task.qa_agent && task.assigned_agent
              ? <span style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100,
                  background: "#2E7D3220", color: "#2E7D32",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                }}>
                  <SearchCheckIcon size={11} color="#2E7D32" /> QA: {task.qa_agent}
                </span>
              : <Badge label="Waiting for QA" color="#7B5EA7" bg="#7B5EA720" />
          )}
        </div>
        {task.status === "blocked"
          ? <BlockedDurationTicker task={task} />
          : <DurationTicker updatedAt={task.updated_at} startedAt={task.started_at} completedAt={task.completed_at} active={isActive} status={task.status} />
        }
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div style={{ padding: "4px 16px 16px" }}>
        {/* Title */}
        <div style={{
          fontWeight: 600, fontSize: 15, lineHeight: 1.45,
          color: "var(--md-on-surface, #1C1B1F)",
          marginBottom: 8,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          {task.title}
        </div>

        {/* Description preview */}
        {(task.description || task.prompt) && (
          <div style={{
            color: "var(--md-on-surface-variant, #49454F)",
            fontSize: 13, lineHeight: 1.55,
            marginBottom: 8, opacity: 0.75,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {(task.description || task.prompt).slice(0, 140)}
            {(task.description || task.prompt).length > 140 ? "…" : ""}
          </div>
        )}

        {/* Pipeline Stepper */}
        <PipelineStepper stage={task.stage} isMobile={isMobile} />

        {/* Live Progress */}
        {isActive && <ProgressBadge progress={progress} monitor={monitor} />}

        {/* Agent info row */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 12, gap: 16, padding: "8px 0 0",
          borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
        }}>
          {agent ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 13, color: "var(--md-on-surface-variant, #49454F)",
            }}>
              <AgentAvatar agent={agent} size={28} />
              <span style={{ fontWeight: 600 }}>{agent}</span>
              <span style={{ color: "var(--md-outline, #79747E)", fontSize: 12 }}>·</span>
              <span style={{
                color: "var(--md-outline, #79747E)", fontSize: 12,
                fontStyle: "italic",
              }}>{role}</span>
            </div>
          ) : (
            <span style={{
              fontSize: 12, color: "var(--md-outline, #79747E)",
              fontStyle: "italic",
            }}>Unassigned</span>
          )}
          <span style={{
            fontSize: 11, color: "var(--md-outline, #79747E)",
            whiteSpace: "nowrap", flexShrink: 0,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          }}>{formatTime(task.created_at)}</span>
        </div>

        {task.project && (
          <div style={{
            fontSize: 11, color: "var(--md-outline, #79747E)",
            marginTop: 8, fontWeight: 500,
          }}>
            <FolderIcon size={12} color="#79747E" style={{ marginRight: 4, verticalAlign: "middle" }} />
            {task.project.name}
          </div>
        )}
      </div>

      {/* ── Error / Result Banner ───────────────────────── */}
      {consoleText && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 16px",
          background: isError ? "#FDECEA" : "#E8F5E9",
          borderTop: `1px solid ${isError ? "#F5C6CB" : "#C8E6C9"}`,
          fontSize: 12, lineHeight: 1.5,
          color: isError ? "#B71C1C" : "#1B5E20",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1, color: isError ? "#D32F2F" : "#2E7D32" }}>
            {isError ? (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            ) : (
              <>
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </>
            )}
          </svg>
          <span style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, display: "block", marginBottom: 2, fontSize: 12 }}>
              {isError ? "Error" : "Result"}
            </span>
            <span style={{ fontSize: 12, wordBreak: "break-word" }}>
              {typeof consoleText === "string" ? consoleText : JSON.stringify(consoleText)}
            </span>
          </span>
        </div>
      )}

      {/* ── Action Bar (always visible) ─────────────────── */}
      <ActionBar
        task={task}
        onStatusChange={onStatusChange}
        isMobile={isMobile}
      />
    </div>
  );
}
