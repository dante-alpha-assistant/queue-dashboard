import { useState, useCallback, useEffect } from "react";
import SpeedLoader from "./components/SpeedLoader";
import { useNavigate, useLocation } from "react-router-dom";
import useQueue from "./hooks/useQueue";
import useBreakpoint from "./hooks/useBreakpoint";
import useTaskEvents from "./hooks/useTaskEvents";
import StatsBar from "./components/StatsBar";
import Column from "./components/Column";
import DispatchButton from "./components/DispatchButton";
import TaskCard from "./components/TaskCard";
import NewTaskChat from "./components/NewTaskChat";
import TaskDetailModal from "./components/TaskDetailModal";
import Pingboard from "./pages/Pingboard";
import TimeFilter, { filterTasksByTime } from "./components/TimeFilter";

const MOBILE_TABS = [
  { key: "todo", label: "Todo", icon: "📋" },
  { key: "in_progress", label: "Active", icon: "⚡" },
  { key: "blocked", label: "Blocked", icon: "🚫" },
  { key: "qa", label: "QA", icon: "🧪" },
  { key: "completed", label: "Done", icon: "✅" },
  { key: "deployed", label: "Deployed", icon: "🚀" },
  { key: "deploying", label: "Deploying", icon: "⏳" },
  { key: "deploy_failed", label: "Deploy Failed", icon: "💥" },
  { key: "failed", label: "Failed", icon: "❌" },
];

// Merged tabs for bottom nav (assigned + in_progress = Active)
const BOTTOM_TABS = [
  { key: "todo", label: "Todo", icon: "📋", color: "#79747E" },
  { key: "active", label: "Active", icon: "⚡", color: "#E8A317" },
  { key: "blocked", label: "Blocked", icon: "🚫", color: "#D84315" },
  { key: "qa", label: "QA", icon: "🧪", color: "#7B5EA7" },
  { key: "completed", label: "Done", icon: "✅", color: "#1B5E20" },
  { key: "deploying", label: "Deploying", icon: "⏳", color: "#E65100" },
  { key: "deployed", label: "Deployed", icon: "🚀", color: "#00897B" },
  { key: "failed", label: "Failed", icon: "❌", color: "#BA1A1A" },

];

export default function App() {
  const {
    stats, todo, assigned, inProgress, qa, completed, deployed, blocked, failed, deploying, deployFailed,
    loading, transitioning, updateTask,
    projects, selectedProject, setSelectedProject,
  } = useQueue();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTask, setSelectedTask] = useState(null);
  const [deepLinkId, setDeepLinkId] = useState(() => {
    const match = location.pathname.match(/^\/task\/([a-f0-9-]+)$/i);
    return match ? match[1] : null;
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("todo");
  const [view, setView] = useState("board");
  const [timeFilter, setTimeFilter] = useState({ range: "today", customFrom: "", customTo: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const { progress: taskProgress, monitor: taskMonitor, connected: sseConnected } = useTaskEvents();

  // Resolve deep link once tasks are loaded
  useEffect(() => {
    if (!deepLinkId || loading) return;
    const allLoaded = [...todo, ...assigned, ...inProgress, ...blocked, ...qa, ...completed, ...deploying, ...deployed, ...deployFailed, ...failed];
    const found = allLoaded.find(t => t.id === deepLinkId);
    if (found) {
      setSelectedTask(found);
    } else {
      setSelectedTask({ _notFound: true, id: deepLinkId });
    }
  }, [deepLinkId, loading, todo, assigned, inProgress, blocked, qa, completed, deploying, deployed, deployFailed, failed]);

  // Update URL when task is selected/deselected
  const handleSelectTask = useCallback((task) => {
    setSelectedTask(task);
    if (task && task.id) {
      navigate(`/task/${task.id}`, { replace: true });
    }
  }, [navigate]);

  const handleCloseTask = useCallback(() => {
    setSelectedTask(null);
    setDeepLinkId(null);
    navigate("/", { replace: true });
  }, [navigate]);

  // All columns are collapsible
  const COLLAPSIBLE_COLUMNS = ["todo", "in_progress", "blocked", "qa_testing", "completed", "deploying", "deployed", "deploy_failed", "failed"];
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = localStorage.getItem("collapsed-columns");
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default: deploying, deployed, deploy_failed and failed are collapsed
    return { deploying: true, deployed: true, deploy_failed: true, failed: true };
  });
  const toggleCollapse = useCallback((col) => {
    setCollapsedCols(prev => {
      const next = { ...prev, [col]: !prev[col] };
      localStorage.setItem("collapsed-columns", JSON.stringify(next));
      return next;
    });
  }, []);

  if (loading) {
    return <SpeedLoader text="Loading tasks..." />;
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

  const allTasksRaw = [...todo, ...assigned, ...inProgress, ...blocked, ...qa, ...completed, ...deploying, ...deployed, ...deployFailed, ...failed];
  const allTasks = filterTasksByTime(allTasksRaw, timeFilter.range, timeFilter.customFrom, timeFilter.customTo);
  const activeTypes = ["all", ...new Set(allTasks.map(t => t.type).filter(Boolean))];
  const activeStages = ["all", ...new Set(allTasks.map(t => t.stage).filter(Boolean))];
  const filterTasks = (tasks) => {
    let filtered = filterTasksByTime(tasks, timeFilter.range, timeFilter.customFrom, timeFilter.customTo);
    if (typeFilter !== "all") filtered = filtered.filter(t => t.type === typeFilter);
    if (stageFilter !== "all") filtered = filtered.filter(t => t.stage === stageFilter);
    if (searchQuery.trim()) filtered = filtered.filter(t => t.title?.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered;
  };
  const filterByType = filterTasks;

  const countActiveTasks = (tasks) => tasks.filter(t => t.assigned_agent).length;

  const getActiveColumnTasks = () => {
    switch (activeTab) {
      case "todo": return filterByType(todo);
      case "active": return [...filterByType(assigned), ...filterByType(inProgress)];
      case "blocked": return [...filterByType(blocked)].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
      case "qa": return filterByType(qa);
      case "completed": return filterByType(completed);
      case "deploying": return filterByType(deploying);
      case "deployed": return filterByType(deployed);
      case "deploy_failed": return filterByType(deployFailed);
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
      case "deploying": return { title: "Deploying", color: "#E65100" };
      case "deployed": return { title: "Deployed", color: "#00897B" };
      case "deploy_failed": return { title: "Deploy Failed", color: "#C62828" };
      case "failed": return { title: "Failed", color: "#BA1A1A" };
      default: return { title: "Todo", color: "#79747E" };
    }
  };

  const renderCards = (tasks) =>
    tasks.map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onCardClick={handleSelectTask} isMobile={isMobile} progress={taskProgress[t.id]} monitor={taskMonitor[t.id]} transitioning={!!transitioning[t.id]} />);

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

        <NewTaskChat isMobile={isMobile} />

        {selectedTask && !selectedTask._notFound && (
          <TaskDetailModal
            task={selectedTask}
            onClose={handleCloseTask}
            onStatusChange={async (id, updates) => { await updateTask(id, updates); setSelectedTask(prev => prev ? { ...prev, ...updates } : null); }}
            isMobile={isMobile}
            progress={selectedTask ? taskProgress[selectedTask.id] : null}
            monitor={selectedTask ? taskMonitor[selectedTask.id] : null}
          />
        )}
        {selectedTask && selectedTask._notFound && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }} onClick={handleCloseTask}>
            <div style={{
              background: "var(--md-surface)", borderRadius: 16, padding: "32px 40px",
              textAlign: "center", maxWidth: 400,
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <h2 style={{ margin: "0 0 8px", color: "var(--md-on-surface)" }}>Task Not Found</h2>
              <p style={{ color: "var(--md-on-surface-variant)", fontSize: 14, margin: "0 0 20px" }}>
                No task with ID <code style={{ fontSize: 12 }}>{selectedTask.id}</code> was found.
              </p>
              <button onClick={handleCloseTask} style={{
                padding: "8px 24px", borderRadius: 20, border: "none",
                background: "var(--md-primary)", color: "var(--md-on-primary)",
                cursor: "pointer", fontWeight: 600, fontSize: 14,
              }}>Back to Board</button>
            </div>
          </div>
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
            <span style={{ fontSize: 10, color: 'var(--md-on-surface-variant)', opacity: 0.6, fontFamily: 'monospace', marginLeft: 8, background: 'var(--md-surface-variant)', padding: '2px 6px', borderRadius: 4 }}>{__COMMIT_HASH__}</span>
          </div>
          <StatsBar stats={stats} isTablet={isTablet} />
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
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 32px 8px 12px", borderRadius: 20, border: "1px solid var(--md-surface-variant)",
                background: "var(--md-surface)", fontSize: 13, fontFamily: "'Roboto', system-ui, sans-serif",
                outline: "none", width: 200, color: "var(--md-on-surface)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", fontSize: 14, padding: 0 }}
              >✕</button>
            )}
          </div>
          <TimeFilter allTasks={allTasksRaw} value={timeFilter} onChange={setTimeFilter} isMobile={false} />
        </div>
      </div>

      <div style={{
        flex: 1, display: "flex", gap: 12, padding: "16px 24px", overflowX: "auto", minHeight: 0,
      }}>
        <Column title="Todo" color="#79747E" count={filterByType(todo).length} isTablet={isTablet} headerAction={<DispatchButton />}
          collapsible collapsed={!!collapsedCols.todo} onToggleCollapse={() => toggleCollapse("todo")}>
          {renderCards(filterByType(todo))}
        </Column>
        <Column title="In Progress" color="#E8A317" count={filterByType(assigned).length + filterByType(inProgress).length} agentCount={countActiveTasks([...filterByType(assigned), ...filterByType(inProgress)])} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.in_progress} onToggleCollapse={() => toggleCollapse("in_progress")}>
          {renderCards([...filterByType(assigned), ...filterByType(inProgress)])}
        </Column>
        <Column title="Blocked" color="#D84315" count={filterByType(blocked).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.blocked} onToggleCollapse={() => toggleCollapse("blocked")}>
          {renderCards([...filterByType(blocked)].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at)))}
        </Column>
        <Column title="QA Testing" color="#7B5EA7" count={filterByType(qa).length} agentCount={countActiveTasks(filterByType(qa))} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.qa_testing} onToggleCollapse={() => toggleCollapse("qa_testing")}>
          {renderCards(filterByType(qa).slice(0, 30))}
        </Column>
        <Column title="Completed" color="#1B5E20" count={filterByType(completed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.completed} onToggleCollapse={() => toggleCollapse("completed")}>
          {renderCards(filterByType(completed).slice(0, 20))}
        </Column>
        <Column title="⏳ Deploying" color="#E65100" count={filterByType(deploying).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deploying} onToggleCollapse={() => toggleCollapse("deploying")}>
          {renderCards(filterByType(deploying))}
        </Column>
        <Column title="Deployed" color="#00897B" count={filterByType(deployed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deployed} onToggleCollapse={() => toggleCollapse("deployed")}>
          {renderCards(filterByType(deployed).slice(0, 20))}
        </Column>
        <Column title="💥 Deploy Failed" color="#C62828" count={filterByType(deployFailed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deploy_failed} onToggleCollapse={() => toggleCollapse("deploy_failed")}>
          {renderCards(filterByType(deployFailed))}
        </Column>
        <Column title="Failed" color="#BA1A1A" count={filterByType(failed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.failed} onToggleCollapse={() => toggleCollapse("failed")}>
          {renderCards(filterByType(failed))}
        </Column>
      </div>

      <NewTaskChat isMobile={false} />

      {selectedTask && !selectedTask._notFound && (
        <TaskDetailModal
          task={selectedTask}
          onClose={handleCloseTask}
          onStatusChange={async (id, updates) => { await updateTask(id, updates); setSelectedTask(prev => prev ? { ...prev, ...updates } : null); }}
          isMobile={false}
          isTablet={isTablet}
          progress={selectedTask ? taskProgress[selectedTask.id] : null}
          monitor={selectedTask ? taskMonitor[selectedTask.id] : null}
        />
      )}
      {selectedTask && selectedTask._notFound && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={handleCloseTask}>
          <div style={{
            background: "var(--md-surface)", borderRadius: 16, padding: "32px 40px",
            textAlign: "center", maxWidth: 400,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <h2 style={{ margin: "0 0 8px", color: "var(--md-on-surface)" }}>Task Not Found</h2>
            <p style={{ color: "var(--md-on-surface-variant)", fontSize: 14, margin: "0 0 20px" }}>
              No task with ID <code style={{ fontSize: 12 }}>{selectedTask.id}</code> was found.
            </p>
            <button onClick={handleCloseTask} style={{
              padding: "8px 24px", borderRadius: 20, border: "none",
              background: "var(--md-primary)", color: "var(--md-on-primary)",
              cursor: "pointer", fontWeight: 600, fontSize: 14,
            }}>Back to Board</button>
          </div>
        </div>
      )}
    </div>
  );
}
