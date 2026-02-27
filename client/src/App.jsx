import { useState } from "react";
import useQueue from "./hooks/useQueue";
import StatsBar from "./components/StatsBar";
import Column from "./components/Column";
import TaskCard from "./components/TaskCard";
import DispatchModal from "./components/DispatchModal";

export default function App() {
  const { stats, tasks, processing, results, dlq, loading, dispatch, retryDlq } = useQueue();
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
      <div className="text-center py-3 text-sm font-bold" style={{ color: "#33ff00" }}>▓ QUEUE DASHBOARD</div>
      <StatsBar stats={stats} />
      <div className="flex-1 flex flex-col md:flex-row gap-2 p-2 min-h-0">
        <Column title="PENDING" color="#3388ff" count={tasks.length}>
          {tasks.map((t) => <TaskCard key={t.id || t.taskId} task={t} type="pending" />)}
        </Column>
        <Column title="PROCESSING" color="#ffaa00" count={processing.length}>
          {processing.map((t) => <TaskCard key={t.id || t.taskId} task={t} type="processing" />)}
        </Column>
        <Column title="COMPLETED" color="#33ff00" count={results.length}>
          {results.slice(0, 20).map((t) => <TaskCard key={t.id || t.taskId} task={t} type="completed" />)}
        </Column>
        <Column title="FAILED" color="#ff3333" count={dlq.length}>
          {dlq.map((t) => <TaskCard key={t.id || t.taskId} task={t} type="failed" onRetry={retryDlq} />)}
        </Column>
      </div>
      <button onClick={() => setShowModal(true)} className="fixed bottom-6 right-6 w-14 h-14 text-2xl font-bold cursor-pointer z-40" style={{ background: "#33ff00", color: "#000", border: "none" }}>+</button>
      {showModal && <DispatchModal onClose={() => setShowModal(false)} dispatch={dispatch} />}
    </div>
  );
}
