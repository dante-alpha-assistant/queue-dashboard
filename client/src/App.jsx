import { useState, useCallback } from "react";
import useQueue from "./hooks/useQueue";
import useBreakpoint from "./hooks/useBreakpoint";
import StatsBar from "./components/StatsBar";
import Column from "./components/Column";
import DispatchButton from "./components/DispatchButton";
import TaskCard from "./components/TaskCard";
import DispatchModal from "./components/DispatchModal";
import ChatPanel from "./components/ChatPanel";
import TaskDetailModal from "./components/TaskDetailModal";
import Pingboard from "./pages/Pingboard";
import TimeFilter, { filterTasksByTime } from "./components/TimeFilter";

const MOBILE_TABS = [
  { key: "todo", label: "Todo", icon: "📋" },
  { key: "assigned", label: "Active", icon: "👤" },
  { key: "in_progress", label: "Active", icon: "⚡" },
  { key: "blocked", label: "Blocked", icon: "🚫" },
  { key: "qa", label: "QA", icon: "🧪" },
  { key: "completed", label: "Done", icon: "✅" },
  { key: "done", label: "Closed", icon: "📦" },
  { key: "deployed", label: "Deployed", icon: "🚀" },
  { key: "failed", label: "Failed", icon: "❌" },
];

// Merged tabs for bottom nav (assigned + in_progress = Active)
const BOTTOM_TABS = [
  { key: "todo", label: "Todo", icon: "📋", color: "#79747E" },
  { key: "active", label: "Active", icon: "⚡", color: "#E8A317" },
  { key: "blocked", label: "Blocked", icon: "🚫", color: "#D84315" },
  { key: "qa", label: "QA", icon: "🧪", color: "#7B5EA7" },
  { key: "completed", label: "Done", icon: "✅", color: "#1B5E20" },
  { key: "done", label: "Closed", icon: "📦", color: "#386A20" },
  { key: "deployed", label: "Deployed", icon: "🚀", color: "#00897B" },
  { key: "failed", label: "Failed", icon: "❌", color: "#BA1A1A" },
];

export default function App() {
  const {
    stats, todo, assigned, inProgress, done, qa, completed, deployed, blocked, failed,
    loading, dispatch, updateTask,
    projects, selectedProject, setSelectedProject,
  } = useQueue();
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("todo");
  const [view, setView] = useState("board");
  const [timeFilter, setTimeFilter] = useState({ range: "today", customFrom: "", customTo: "" });
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // Collapsible columns for Deployed and Failed
  const COLLAPSIBLE_COLUMNS = ["done", "deployed", "failed"];
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = localStorage.getItem("collapsed-columns");
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default: deployed and failed are collapsed
    return { done: true, deployed: true, failed: true };
  });
  const toggleCollapse = useCallback((col) => {
    setCollapsedCols(prev => {
      const next = { ...prev, [col]: !prev[col] };
      localStorage.setItem("collapsed-columns", JSON.stringify(next));
      return next;
    });
  }, []);

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

  if (view === "pingboard") {
    return (
      <div style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "var(--md-background)", borderBottom: "1px solid var(--md-surface-variant)",
          display: "flex", gap: 0, padding: "0 16px",
        }}>
          {[{ key: "board", label: "📋 Board" }, { key: "pingboard", label: "🤖 Pingboard" }].map(t => (
            <button key={t.key} onClick={() => setView(t.key)} style={{
              padding: "10px 20px", background: "none", border: "none",
              borderBottom: view === t.key ? "2px solid var(--md-primary)" : "2px solid transparent",
              color: view === t.key ? "var(--md-primary)" : "var(--md-on-surface-variant)",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "'Roboto', system-ui, sans-serif",
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ paddingTop: 42 }}>
          <Pingboard />
        </div>
      </div>
    );
  }

  const allTasksRaw = [...todo, ...assigned, ...inProgress, ...blocked, ...done, ...qa, ...completed, ...deployed, ...failed];
  const allTasks = filterTasksByTime(allTasksRaw, timeFilter.range, timeFilter.customFrom, timeFilter.customTo);
  const activeTypes = ["all", ...new Set(allTasks.map(t => t.type).filter(Boolean))];
  const activeStages = ["all", ...new Set(allTasks.map(t => t.stage).filter(Boolean))];
  const filterTasks = (tasks) => {
    let filtered = filterTasksByTime(tasks, timeFilter.range, timeFilter.customFrom, timeFilter.customTo);
    if (typeFilter !== "all") filtered = filtered.filter(t => t.type === typeFilter);
    if (stageFilter !== "all") filtered = filtered.filter(t => t.stage === stageFilter);
    return filtered;
  };
  const filterByType = filterTasks;

  const getActiveColumnTasks = () => {
    switch (activeTab) {
      case "todo": return filterByType(todo);
      case "active": return [...filterByType(assigned), ...filterByType(inProgress)];
      case "blocked": return filterByType(blocked);
      case "qa": return filterByType(qa);
      case "completed": return filterByType(completed);
      case "done": return filterByType(done);
      case "deployed": return filterByType(deployed);
      case "failed": return filterByType(failed);
      default: return filterByType(todo);
    }
  };

  const getActiveColumnMeta = () => {
    switch (activeTab) {
      case "todo": return { title: "Todo", color: "#79747E" };
      case "active": return { title: "Active", color: "#E8A317" };
      case "blocked": return { title: "Blocked", color: "#D84315" };
      case "qa": return { title: "QA Testing", color: "#7B5EA7" };
      case "completed": return { title: "Completed", color: "#1B5E20" };
      case "done": return { title: "Closed", color: "#386A20" };
      case "deployed": return { title: "Deployed", color: "#00897B" };
      case "failed": return { title: "Failed", color: "#BA1A1A" };
      default: return { title: "Todo", color: "#79747E" };
    }
  };

  const renderCards = (tasks) =>
    tasks.map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onCardClick={setSelectedTask} isMobile={isMobile} />);

  // MOBILE LAYOUT
  if (isMobile) {
    const colMeta = getActiveColumnMeta();
    const colTasks = getActiveColumnTasks();
    return (
      <div style={{
        display: "flex", flexDirection: "column", height: "100vh",
        background: "var(--md-background)", fontFamily: "'Roboto', system-ui, sans-serif",
      }}>
        {/* Simplified header */}
        <div style={{ padding: "12px 16px", background: "var(--md-background)", borderBottom: "1px solid var(--md-surface-variant)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: "var(--md-primary)", color: "var(--md-on-primary)",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 16,
            }}>d</div>
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
              tasks<span style={{ color: "var(--md-primary)" }}>.</span>dante<span style={{ color: "var(--md-primary)" }}>.</span>id
            </span>
            <button onClick={() => setView("pingboard")} style={{
              marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
              background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)",
              color: "var(--md-on-surface-variant)", cursor: "pointer", fontSize: 11, fontWeight: 600,
            }}>🤖</button>
          </div>
        </div>

        {/* Filter bar - wrapping */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--md-surface-variant)" }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{
            width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
            background: "var(--md-surface)", color: "var(--md-on-background)", fontSize: 13,
            fontWeight: 500, fontFamily: "'Roboto', system-ui, sans-serif", outline: "none",
            marginBottom: 8, minHeight: 44,
          }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {activeTypes.map(type => (
              <button key={type} onClick={() => setTypeFilter(type)} style={{
                padding: "6px 14px", borderRadius: 16, fontSize: 12, fontWeight: 500,
                minHeight: 36,
                border: typeFilter === type ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
                background: typeFilter === type ? "var(--md-primary-container)" : "var(--md-surface)",
                color: typeFilter === type ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
                cursor: "pointer", textTransform: "capitalize",
                fontFamily: "'Roboto', system-ui, sans-serif",
              }}>{type}</button>
            ))}
          </div>
          {activeStages.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {activeStages.map(stage => (
                <button key={stage} onClick={() => setStageFilter(stage)} style={{
                  padding: "6px 14px", borderRadius: 16, fontSize: 12, fontWeight: 500,
                  minHeight: 36,
                  border: stageFilter === stage ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
                  background: stageFilter === stage ? "var(--md-primary-container)" : "var(--md-surface)",
                  color: stageFilter === stage ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
                  cursor: "pointer", textTransform: "capitalize",
                  fontFamily: "'Roboto', system-ui, sans-serif",
                }}>{stage === "all" ? "all stages" : stage}</button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <TimeFilter allTasks={allTasksRaw} value={timeFilter} onChange={setTimeFilter} isMobile={true} />
          </div>
        </div>

        {/* Column header */}
        <div style={{ padding: "10px 16px 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: colMeta.color }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{colMeta.title}</span>
          <span style={{
            background: `${colMeta.color}20`, color: colMeta.color,
            padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
          }}>{colTasks.length}</span>
          {activeTab === "todo" && <DispatchButton />}
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflow: "auto", padding: "4px 12px 80px", minHeight: 0 }}>
          {colTasks.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--md-on-surface-variant)", padding: 40, fontSize: 13 }}>No tasks</div>
          )}
          {renderCards(colTasks)}
        </div>

        {/* FAB */}
        <button onClick={() => setShowModal(true)} style={{
          position: "fixed", bottom: 76, right: 16, width: 56, height: 56,
          borderRadius: 16, background: "var(--md-primary)", color: "var(--md-on-primary)",
          border: "none", fontSize: 24, fontWeight: 300, cursor: "pointer", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 5px rgba(0,0,0,0.2), 0 6px 10px rgba(0,0,0,0.14), 0 1px 18px rgba(0,0,0,0.12)",
        }}>+</button>

        {/* Bottom navigation */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
          background: "var(--md-background)", borderTop: "1px solid var(--md-surface-variant)",
          display: "flex", alignItems: "center", justifyContent: "space-around",
          zIndex: 40, paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {BOTTOM_TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 12px", minWidth: 48, minHeight: 44,
                color: isActive ? "var(--md-primary)" : "var(--md-on-surface-variant)",
                position: "relative",
              }}>
                {isActive && <div style={{
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: 32, height: 3, borderRadius: 2, background: "var(--md-primary)",
                }} />}
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <ChatPanel isMobile={isMobile} />
        {showModal && <DispatchModal onClose={() => setShowModal(false)} dispatch={dispatch} projects={projects} isMobile={isMobile} />}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onStatusChange={async (id, updates) => { await updateTask(id, updates); setSelectedTask(null); }}
            isMobile={isMobile}
          />
        )}
      </div>
    );
  }

  // TABLET + DESKTOP LAYOUT
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
            <button onClick={() => setView("pingboard")} style={{
              marginLeft: 16, padding: "6px 14px", borderRadius: 8,
              background: "var(--md-surface)", border: "1px solid var(--md-surface-variant)",
              color: "var(--md-on-surface-variant)", cursor: "pointer", fontSize: 12, fontWeight: 600,
              fontFamily: "'Roboto', system-ui, sans-serif",
            }}>🤖 Pingboard</button>
          </div>
          <StatsBar stats={stats} isTablet={isTablet} />
          <button onClick={() => setShowModal(true)} style={{
            background: "var(--md-primary)", color: "var(--md-on-primary)",
            border: "none", borderRadius: 12, padding: "10px 24px",
            fontWeight: 600, fontSize: 14, cursor: "pointer",
            fontFamily: "'Roboto', system-ui, sans-serif",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "all 150ms",
          }}>+ New Task</button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: isTablet ? "wrap" : "nowrap",
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
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {activeTypes.map(type => (
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
          {activeStages.length > 1 && (<>
            <div style={{ width: 1, height: 24, background: "var(--md-surface-variant)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Stage</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {activeStages.map(stage => (
                  <button key={stage} onClick={() => setStageFilter(stage)} style={{
                    padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 500,
                    border: stageFilter === stage ? "2px solid var(--md-primary)" : "1px solid var(--md-surface-variant)",
                    background: stageFilter === stage ? "var(--md-primary-container)" : "var(--md-surface)",
                    color: stageFilter === stage ? "var(--md-on-primary-container)" : "var(--md-on-surface-variant)",
                    cursor: "pointer", textTransform: "capitalize",
                    fontFamily: "'Roboto', system-ui, sans-serif", transition: "all 150ms",
                  }}>{stage === "all" ? "all stages" : stage}</button>
                ))}
              </div>
            </div>
          </>)}
          <div style={{ width: 1, height: 24, background: "var(--md-surface-variant)" }} />
          <TimeFilter allTasks={allTasksRaw} value={timeFilter} onChange={setTimeFilter} isMobile={false} />
        </div>
      </div>

      <div style={{
        flex: 1, display: "flex", gap: 12, padding: "16px 24px", overflowX: "auto", minHeight: 0,
      }}>
        <Column title="Todo" color="#79747E" count={filterByType(todo).length} isTablet={isTablet} headerAction={<DispatchButton />}>
          {renderCards(filterByType(todo))}
        </Column>
        <Column title="Assigned" color="#6750A4" count={filterByType(assigned).length} isTablet={isTablet}>
          {renderCards(filterByType(assigned))}
        </Column>
        <Column title="In Progress" color="#E8A317" count={filterByType(inProgress).length} isTablet={isTablet}>
          {renderCards(filterByType(inProgress))}
        </Column>
        <Column title="Blocked" color="#D84315" count={filterByType(blocked).length} isTablet={isTablet}>
          {renderCards(filterByType(blocked))}
        </Column>
        <Column title="QA Testing" color="#7B5EA7" count={filterByType(qa).length} isTablet={isTablet}>
          {renderCards(filterByType(qa).slice(0, 30))}
        </Column>
        <Column title="Completed" color="#1B5E20" count={filterByType(completed).length} isTablet={isTablet}>
          {renderCards(filterByType(completed).slice(0, 20))}
        </Column>
        <Column title="Closed" color="#386A20" count={filterByType(done).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.done} onToggleCollapse={() => toggleCollapse("done")}>
          {renderCards(filterByType(done).slice(0, 20))}
        </Column>
        <Column title="Deployed" color="#00897B" count={filterByType(deployed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deployed} onToggleCollapse={() => toggleCollapse("deployed")}>
          {renderCards(filterByType(deployed).slice(0, 20))}
        </Column>
        <Column title="Failed" color="#BA1A1A" count={filterByType(failed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.failed} onToggleCollapse={() => toggleCollapse("failed")}>
          {renderCards(filterByType(failed))}
        </Column>
      </div>

      <ChatPanel isMobile={false} />
      {showModal && <DispatchModal onClose={() => setShowModal(false)} dispatch={dispatch} projects={projects} isMobile={false} isTablet={isTablet} />}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={async (id, updates) => { await updateTask(id, updates); setSelectedTask(null); }}
          isMobile={false}
          isTablet={isTablet}
        />
      )}
    </div>
  );
}
