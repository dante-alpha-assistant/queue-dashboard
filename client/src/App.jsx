import { useState } from "react";
import useQueue from "./hooks/useQueue";
import StatsBar from "./components/StatsBar";
import Column from "./components/Column";
import TaskCard from "./components/TaskCard";
import DispatchModal from "./components/DispatchModal";
import ChatPanel from "./components/ChatPanel";
import TaskDetailModal from "./components/TaskDetailModal";

export default function App() {
  const {
    stats, todo, assigned, inProgress, done, qa, completed, failed,
    loading, dispatch, updateTask, deleteTask,
    projects, selectedProject, setSelectedProject,
  } = useQueue();
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--md-background)", color: "var(--md-primary)",
        fontFamily: "'Roboto', system-ui, sans-serif",
      }}>
        Loading...
      </div>
    );
  }

  const qaAll = [...qa, ...done];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "var(--md-background)", fontFamily: "'Roboto', system-ui, sans-serif",
    }}>
      <div style={{
        height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", borderBottom: "1px solid var(--md-surface-variant)",
        background: "rgba(255, 251, 254, 0.9)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, background: "var(--md-primary)", color: "var(--md-on-primary)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 18,
          }}>d</div>
          <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em" }}>
            tasks<span style={{ color: "var(--md-primary)" }}>.</span>
          </span>
        </div>

        <select
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          style={{
            padding: "8px 12px", borderRadius: 12,
            border: "1px solid var(--md-border)", background: "var(--md-background)",
            color: "var(--md-on-background)", fontSize: 14,
            fontFamily: "'Roboto', system-ui, sans-serif", outline: "none",
            minWidth: 180,
          }}
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <StatsBar stats={stats} />
        <button onClick={() => setShowModal(true)} style={{
          background: "var(--md-primary)", color: "var(--md-on-primary)",
          border: "none", borderRadius: 20, padding: "8px 20px",
          fontWeight: 500, fontSize: 14, cursor: "pointer",
          fontFamily: "'Roboto', system-ui, sans-serif",
        }}>+ New Task</button>
      </div>

      <div style={{
        flex: 1, display: "flex", gap: 16, padding: 16,
        overflowX: "auto", minHeight: 0,
      }}>
        <Column title="Todo" color="#79747E" count={todo.length}>
          {todo.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="Assigned" color="#6750A4" count={assigned.length}>
          {assigned.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="In Progress" color="#E8A317" count={inProgress.length}>
          {inProgress.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="QA" color="#7B5EA7" count={qaAll.length}>
          {qaAll.slice(0, 30).map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="Completed" color="#1B5E20" count={completed.length}>
          {completed.slice(0, 20).map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="Failed" color="#BA1A1A" count={failed.length}>
          {failed.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
      </div>

      <ChatPanel />
      {showModal && <DispatchModal onClose={() => setShowModal(false)} dispatch={dispatch} projects={projects} />}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={(id, updates) => { updateTask(id, updates); setSelectedTask(null); }}
          onDelete={(id) => { deleteTask(id); setSelectedTask(null); }}
        />
      )}
    </div>
  );
}
