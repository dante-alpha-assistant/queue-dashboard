const GHERKIN_KEYWORDS = [
  { pattern: /^(\s*)(Feature:)(.*)/, style: { color: "#6A1B9A", fontWeight: 700, fontSize: 15 } },
  { pattern: /^(\s*)(Scenario Outline:)(.*)/, style: { color: "#1565C0", fontWeight: 700 } },
  { pattern: /^(\s*)(Background:|Scenario:)(.*)/, style: { color: "#1565C0", fontWeight: 700 } },
  { pattern: /^(\s*)(Given )(.*)/, style: { color: "#2E7D32", fontWeight: 600 } },
  { pattern: /^(\s*)(When )(.*)/, style: { color: "#E65100", fontWeight: 600 } },
  { pattern: /^(\s*)(Then )(.*)/, style: { color: "#1565C0", fontWeight: 600 } },
  { pattern: /^(\s*)(And |But )(.*)/, style: { color: "#757575", fontWeight: 600 } },
];

function renderGherkin(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    for (const { pattern, style } of GHERKIN_KEYWORDS) {
      const m = line.match(pattern);
      if (m) {
        return (
          <div key={i}>
            {m[1]}<span style={style}>{m[2]}</span><span style={{ color: "#5D4037" }}>{m[3]}</span>
          </div>
        );
      }
    }
    return <div key={i} style={{ color: "#5D4037" }}>{line}</div>;
  });
}

const AGENT_ICONS = { neo: "🕶️", mu: "🔧", beta: "⚡", alpha: "🧠", flow: "🌊" };
const STAGE_COLORS = {
  refinery: "#E65100", foundry: "#1565C0", builder: "#2E7D32", inspector: "#6A1B9A", deployer: "#00838F",
};
const VALID_STAGES = ["refinery", "foundry", "builder", "inspector", "deployer"];
const STATUS_STYLES = {
  todo: { bg: "#E8E8E8", color: "#49454F" },
  assigned: { bg: "#E8DEF8", color: "#4F378B" },
  in_progress: { bg: "#FFF3E0", color: "#E65100" },
  done: { bg: "#E8F5E9", color: "#2E7D32" },
  qa: { bg: "#EDE7F6", color: "#5E35B1" },
  completed: { bg: "#C8E6C9", color: "#1B5E20" },
  failed: { bg: "#FFDAD6", color: "#BA1A1A" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function parseResult(result) {
  if (!result) return null;
  if (typeof result === "string") return result;
  if (result.output) return result.output;
  return JSON.stringify(result, null, 2);
}

export default function TaskDetailModal({ task, onClose, onStatusChange, onDelete, isMobile, isTablet }) {
  if (!task) return null;
  const agent = task.assigned_agent?.toLowerCase();
  const icon = AGENT_ICONS[agent] || "🤖";
  const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.todo;

  const overlayStyle = isMobile ? {
    position: "fixed", inset: 0, background: "var(--md-background)", zIndex: 200,
    display: "flex", flexDirection: "column",
    animation: "slideUp 0.3s ease-out",
  } : {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    backdropFilter: "blur(4px)",
  };

  const panelStyle = isMobile ? {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
  } : {
    background: "var(--md-background)", borderRadius: 20, padding: 0,
    width: isTablet ? "90%" : 600, maxWidth: isTablet ? 600 : "none",
    maxHeight: "85vh", overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
  };

  return (
    <div style={overlayStyle} onClick={isMobile ? undefined : onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* Swipe handle for mobile */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--md-surface-variant)" }} />
          </div>
        )}

        <div style={{ padding: isMobile ? "12px 16px 12px" : "24px 24px 16px", borderBottom: "1px solid var(--md-surface-variant)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: statusStyle.bg, color: statusStyle.color,
                textTransform: "uppercase", letterSpacing: "0.5px",
              }}>{task.status.replace("_", " ")}</span>
              <span style={{
                padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                background: "#F3F3F3", color: "#666", textTransform: "uppercase",
              }}>{task.type}</span>
              {task.priority && task.priority !== "normal" && (
                <span style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  background: task.priority === "urgent" ? "#FFDAD6" : "#FFE0B2",
                  color: task.priority === "urgent" ? "#BA1A1A" : "#E65100",
                  textTransform: "uppercase",
                }}>{task.priority}</span>
              )}
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "var(--md-on-surface-variant)", padding: 8, lineHeight: 1,
              minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, lineHeight: 1.3, color: "var(--md-on-background)" }}>
            {task.title}
          </h2>
        </div>

        <div style={{ padding: isMobile ? "12px 16px 16px" : "16px 24px 24px", overflowY: "auto", flex: isMobile ? 1 : "none", maxHeight: isMobile ? "none" : "calc(85vh - 200px)" }}>
          <div style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12, marginBottom: 20,
          }}>
            {task.project && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Project</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{task.project.name}</div>
              </div>
            )}
            {agent && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Agent</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{icon} {agent}</div>
              </div>
            )}
            {task.dispatched_by && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Dispatched by</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{task.dispatched_by}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Created</div>
              <div style={{ fontSize: 14 }}>{formatDate(task.created_at)}</div>
            </div>
            {task.started_at && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Started</div>
                <div style={{ fontSize: 14 }}>{formatDate(task.started_at)}</div>
              </div>
            )}
            {task.completed_at && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Completed</div>
                <div style={{ fontSize: 14 }}>{formatDate(task.completed_at)}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Stage</div>
              <select
                value={task.stage || ""}
                onChange={e => onStatusChange(task.id, { stage: e.target.value || null })}
                onClick={e => e.stopPropagation()}
                style={{
                  padding: "4px 8px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: "1px solid var(--md-surface-variant)", background: "var(--md-surface)",
                  color: task.stage ? (STAGE_COLORS[task.stage] || "#666") : "#999",
                  cursor: "pointer", fontFamily: "'Roboto', system-ui, sans-serif", outline: "none",
                }}
              >
                <option value="">None</option>
                {VALID_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {task.description && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Description</div>
              <div style={{
                fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
                color: "var(--md-on-background)", padding: isMobile ? 12 : 16,
                background: "var(--md-surface)", borderRadius: 12,
                border: "1px solid var(--md-surface-variant)",
              }}>{task.description}</div>
            </div>
          )}

          {task.acceptance_criteria && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Acceptance Criteria</div>
              <div style={{
                fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
                padding: isMobile ? 12 : 16, background: "#FFFDE7", borderRadius: 12,
                border: "1px solid #FFF9C4", color: "#5D4037",
              }}>{renderGherkin(task.acceptance_criteria)}</div>
            </div>
          )}

          {task.result && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#2E7D32", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>✓ Result</div>
              <div style={{
                fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                padding: isMobile ? 12 : 16, background: "#E8F5E9", borderRadius: 12,
                border: "1px solid #C8E6C9", color: "#1B5E20",
              }}>{parseResult(task.result)}</div>
            </div>
          )}

          {task.qa_result && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: task.qa_result.passed ? "#2E7D32" : "#BA1A1A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                {task.qa_result.passed ? "✓ QA Passed" : "✕ QA Failed"}
              </div>
              <div style={{
                fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                padding: isMobile ? 12 : 16, borderRadius: 12,
                background: task.qa_result.passed ? "#E8F5E9" : "#FBE9E7",
                border: `1px solid ${task.qa_result.passed ? "#C8E6C9" : "#FFCCBC"}`,
                color: task.qa_result.passed ? "#1B5E20" : "#BF360C",
              }}>{typeof task.qa_result === "string" ? task.qa_result : (task.qa_result.notes || task.qa_result.failures?.join("\n") || JSON.stringify(task.qa_result, null, 2))}</div>
            </div>
          )}

          {task.error && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#BA1A1A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>✕ Error</div>
              <div style={{
                fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                padding: isMobile ? 12 : 16, background: "#FBE9E7", borderRadius: 12,
                border: "1px solid #FFCCBC", color: "#BF360C",
              }}>{task.error}</div>
            </div>
          )}

          <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace", marginTop: 8 }}>
            {task.id}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {task.status === "todo" && (
              <button onClick={() => { onStatusChange(task.id, { status: "assigned", assigned_agent: task.assigned_agent || "neo" }); }} style={{
                flex: 1, background: "var(--md-primary)", color: "var(--md-on-primary)",
                border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer",
                minHeight: isMobile ? 48 : "auto",
              }}>Assign</button>
            )}
            {task.status === "failed" && (
              <button onClick={() => { onStatusChange(task.id, { status: "todo" }); }} style={{
                flex: 1, background: "#E8A317", color: "#fff",
                border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer",
                minHeight: isMobile ? 48 : "auto",
              }}>Retry</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
