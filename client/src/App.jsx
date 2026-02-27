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
      <div className="flex items-center justify-center h-screen" style={{ background: "#0a0a0a", color: "#33ff00" }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0a0a0a" }}>
      <div className="text-center py-3 text-sm font-bold" style={{ color: "#33ff00" }}>▓ TASK BOARD</div>
      <StatsBar stats={stats} />
      <div className="flex-1 flex flex-col md:flex-row gap-2 p-2 min-h-0">
        <Column title="TODO" color="#666" count={todo.length}>
          {todo.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="ASSIGNED" color="#3388ff" count={assigned.length}>
          {assigned.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="IN PROGRESS" color="#ffaa00" count={inProgress.length}>
          {inProgress.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="DONE" color="#33ff00" count={done.length}>
          {done.slice(0, 20).map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
        <Column title="FAILED" color="#ff3333" count={failed.length}>
          {failed.map((t) => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onDelete={deleteTask} />)}
        </Column>
      </div>
      <button onClick={() => setShowModal(true)} className="fixed bottom-6 left-6 w-14 h-14 text-2xl font-bold cursor-pointer z-40" style={{ background: "#33ff00", color: "#000", border: "none" }}>+</button>
      <ChatPanel />
      {showModal && <DispatchModal onClose={() => setShowModal(false)} dispatch={dispatch} />}
    </div>
  );
}
