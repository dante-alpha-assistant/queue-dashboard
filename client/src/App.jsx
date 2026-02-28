import { useState } from "react";
import useQueue from "./hooks/useQueue";
import StatsBar from "./components/StatsBar";
import Column from "./components/Column";
import TaskCard from "./components/TaskCard";
import DispatchModal from "./components/DispatchModal";
import ChatPanel from "./components/ChatPanel";
import TaskDetailModal from "./components/TaskDetailModal";

const TYPES = ["all", "coding", "ops", "general", "research", "qa"];

export default function App() {
  const {
    stats, todo, assigned, inProgress, done, qa, completed, failed,
    loading, dispatch, updateTask, deleteTask,
    projects, selectedProject, setSelectedProject,
  } = useQueue();
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--md-background)", color: "var(--md-primary)",
        fontFamily: "'Roboto', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Loading tasks...</div>
        </div>
      </div>
    );
  }

  const filterByType = (tasks) => typeFilter === "all" ? tasks : tasks.filter(t => t.type === typeFilter);
  const qaAll = [...qa, ...done];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "var(--md-background)", fontFamily: "'Roboto', system-ui, sans-serif",
    }}>
      <div style={{ padding: "16px 24px 0", background: "var(--md-background)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: "var(--md-primary)", color: "var(--md-on-primary)",
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 20,
            }}>d</div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>
                tasks<span style={{ color: "var(--md-primary)" }}>.</span>dante<span style={{ color: "var(--md-primary)" }}>.</span>id
              </span>
            </div>
          </div>
          <StatsBar stats={stats} />
          <button onClick={() => setShowModal(true)} style={{
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            border: "none", borderRadius: 12, padding: "10px 24px",
            fontWeight: 600, fontSize: 14, cursor: "pointer",
            fontFamily: "'Roboto', system-ui, sans-serif",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "all 150ms",
          }}>+ New Task</button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          paddingBottom: 16, borderBottom: "1px solid var(--md-surface-variant)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Project</span>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
              background: "var(--md-surface)", color: "var(--md-on-background)", fontSize: 13,
              fontWeight: 500, fontFamily: "'Roboto', system-ui, sans-serif", outline: "none",
              cursor: "pointer", minWidth: 160,
            }}>
              <option value="">All</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ width: 1, height: 24, background: "var(--md-surface-variant)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Type</span>
            <div style={{ display: "flex", gap: 4 }}>
              {TYPES.map(type => (
                <button key={type} onClick={() => setTypeFilter(type)} style={{
                  padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 500,
                  border: typeFilter === type ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
                  background: typeFilter === type ? "var(--md-primary-container)" : "var(--md-surface)",
                  color: typeFilter === type ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
                  cursor: "pointer", textTransform: "capitalize",
                  fontFamily: "'Roboto', system-ui, sans-serif", transition: "all 150ms",
                }}>{type}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 12, padding: "16px 24px", overflowX: "auto", minHeight: 0 }}>
        <Column title="Todo" color="#79747E" count={filterByType(todo).length}>
          {filterByType(todo).map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="Assigned" color="#6750A4" count={filterByType(assigned).length}>
          {filterByType(assigned).map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="In Progress" color="#E8A317" count={filterByType(inProgress).length}>
          {filterByType(inProgress).map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="QA" color="#7B5EA7" count={filterByType(qaAll).length}>
          {filterByType(qaAll).slice(0, 30).map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="Completed" color="#1B5E20" count={filterByType(completed).length}>
          {filterByType(completed).slice(0, 20).map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
        </Column>
        <Column title="Failed" color="#BA1A1A" count={filterByType(failed).length}>
          {filterByType(failed).map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} onCardClick={setSelectedTask} />)}
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
