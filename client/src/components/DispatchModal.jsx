import { useState, useEffect } from "react";

const AGENTS = ["neo", "mu", "beta", "flow"];
const TYPES = ["general", "coding", "research", "ops", "test"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function DispatchModal({ onClose, dispatch, projects = [], isMobile, isTablet }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [type, setType] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [agent, setAgent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [repos, setRepos] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetch(`/api/repositories?project_id=${projectId}`)
        .then(r => r.json())
        .then(setRepos)
        .catch(() => setRepos([]));
    } else {
      setRepos([]);
      setRepositoryId("");
    }
  }, [projectId]);

  const submit = async () => {
    if (!title.trim()) return;
    setSending(true);
    try {
      await dispatch({
        title: title.trim(),
        description: description.trim() || null,
        acceptance_criteria: acceptanceCriteria.trim() || null,
        type,
        priority,
        assigned_agent: agent || null,
        status: agent ? "assigned" : "todo",
        project_id: projectId || null,
        repository_id: repositoryId || null,
      });
      onClose();
    } catch {
      setSending(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px",
    border: "1px solid var(--md-border)", background: "var(--md-background)",
    color: "var(--md-on-background)", fontSize: 14, borderRadius: 12,
    fontFamily: "'Roboto', system-ui, sans-serif", outline: "none",
    boxSizing: "border-box",
    minHeight: isMobile ? 48 : "auto",
  };

  const overlayStyle = isMobile ? {
    position: "fixed", inset: 0, background: "var(--md-background)", zIndex: 100,
    display: "flex", flexDirection: "column",
  } : {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  };

  const panelStyle = isMobile ? {
    flex: 1, display: "flex", flexDirection: "column", overflow: "auto", padding: 16,
  } : {
    background: "var(--md-background)", borderRadius: 24, padding: 24,
    width: isTablet ? "90%" : 480, maxWidth: isTablet ? 600 : "none",
    maxHeight: "85vh", overflow: "auto",
    border: "1px solid var(--md-surface-variant)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  };

  return (
    <div style={overlayStyle} onClick={isMobile ? undefined : onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button onClick={onClose} style={{
              background: "none", border: "none", fontSize: 16, cursor: "pointer",
              color: "var(--md-primary)", fontWeight: 500, padding: 8, minHeight: 44,
              fontFamily: "'Roboto', system-ui, sans-serif",
            }}>Cancel</button>
            <span style={{ fontWeight: 700, fontSize: 18 }}>New Task</span>
            <button onClick={submit} disabled={!title.trim() || sending} style={{
              background: "none", border: "none", fontSize: 16, cursor: "pointer",
              color: title.trim() ? "var(--md-primary)" : "var(--md-on-surface-variant)",
              fontWeight: 600, padding: 8, minHeight: 44,
              fontFamily: "'Roboto', system-ui, sans-serif",
            }}>{sending ? "..." : "Create"}</button>
          </div>
        )}

        {!isMobile && <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>New Task</div>}

        <input
          placeholder="Task title"
          value={title} onChange={e => setTitle(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
          autoFocus
        />

        <textarea
          placeholder="Description (optional)"
          value={description} onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }}
        />

        <textarea
          placeholder="Acceptance criteria (optional)"
          value={acceptanceCriteria} onChange={e => setAcceptanceCriteria(e.target.value)}
          rows={2}
          style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexDirection: isMobile ? "column" : "row" }}>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={repositoryId} onChange={e => setRepositoryId(e.target.value)} style={{ ...inputStyle, flex: 1 }} disabled={!projectId}>
            <option value="">No repo</option>
            {repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <select value={agent} onChange={e => setAgent(e.target.value)} style={{ ...inputStyle, marginBottom: 20 }}>
          <option value="">Unassigned (todo)</option>
          {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {!isMobile && (
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onClose} style={{
              flex: 1, background: "transparent", border: "1px solid var(--md-border)",
              color: "var(--md-on-background)", padding: 12, borderRadius: 20,
              cursor: "pointer", fontWeight: 500, fontSize: 14, fontFamily: "'Roboto', system-ui, sans-serif",
            }}>Cancel</button>
            <button onClick={submit} disabled={!title.trim() || sending} style={{
              flex: 1, background: title.trim() ? "var(--md-primary)" : "var(--md-surface-variant)",
              color: title.trim() ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
              border: "none", padding: 12, borderRadius: 20, fontWeight: 500, fontSize: 14,
              cursor: title.trim() ? "pointer" : "default", fontFamily: "'Roboto', system-ui, sans-serif",
            }}>{sending ? "Creating..." : agent ? "Create & Assign" : "Create Task"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
