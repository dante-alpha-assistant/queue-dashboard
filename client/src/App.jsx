import { useState } from "react";
import useQueue from "./hooks/useQueue";
import StatsBar from "./components/StatsBar";
import Column from "./components/Column";
import TaskCard from "./components/TaskCard";
import DispatchModal from "./components/DispatchModal";
import ChatPanel from "./components/ChatPanel";

export default function App() {
  const { stats, todo, assigned, inProgress, done, failed, loading, dispatch, updateTask, deleteTask } = useQueue();
  const [showModal, setShowModal] = useState(false);

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

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "var(--md-background)", fontFamily: "'Roboto', system-ui, sans-serif",
    }}>
      {/* Navbar */}
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
        <StatsBar stats={stats} />
        <button onClick={() => setShowModal(true)} style={{
          background: "var(--md-primary)", color: "var(--md-on-primary)",
          border: "none", borderRadius: 20, padding: "8px 20px",
          fontWeight: 500, fontSize: 14, cursor: "pointer",
          fontFamily: "'Roboto', system-ui, sans-serif",
        }}>+ New Task</button>
      </div>

      {/* Kanban */}
      <div style={{
        flex: 1, display: "flex", gap: 16, padding: 16,
        overflowX: "auto", minHeight: 0,
      }}>
        <Column title="Todo" color="#79747E" count={todo.length}>
          {todo.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="Assigned" color="#6750A4" count={assigned.length}>
          {assigned.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="In Progress" color="#E8A317" count={inProgress.length}>
          {inProgress.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="Done" color="#386A20" count={done.length}>
          {done.slice(0, 20).map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="Failed" color="#BA1A1A" count={failed.length}>
          {failed.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
      </div>

      <ChatPanel />
      {showModal && <DispatchModal onClose={() => setShowModal(false)} dispatch={dispatch} />}
    </div>
  );
}
