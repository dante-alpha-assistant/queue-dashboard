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
import HealthDashboard from "./pages/HealthDashboard";
import TimeFilter, { filterTasksByTime } from "./components/TimeFilter";
import { Ban, Bot, CheckCircle2, ClipboardList, Clock, FlaskConical, HeartPulse, Rocket, Search, XCircle, Zap } from 'lucide-react';

const MOBILE_TABS = [
  { key: "todo", label: "Todo", icon: ClipboardList },
  { key: "in_progress", label: "Active", icon: Zap },
  { key: "blocked", label: "Blocked", icon: Ban },
  { key: "qa", label: "QA", icon: FlaskConical },
  { key: "completed", label: "Done", icon: CheckCircle2 },
  { key: "deployed", label: "Deployed", icon: Rocket },
  { key: "deploying", label: "Deploying", icon: Clock },
  { key: "deploy_failed", label: "Deploy Failed", icon: XCircle },
  { key: "failed", label: "Failed", icon: XCircle },
];

// Merged tabs for bottom nav (assigned + in_progress = Active)
const BOTTOM_TABS = [
  { key: "todo", label: "Todo", icon: ClipboardList, color: "#79747E" },
  { key: "active", label: "Active", icon: Zap, color: "#E8A317" },
  { key: "blocked", label: "Blocked", icon: Ban, color: "#D84315" },
  { key: "qa", label: "QA", icon: FlaskConical, color: "#7B5EA7" },
  { key: "completed", label: "Done", icon: CheckCircle2, color: "#1B5E20" },
  { key: "deploying", label: "Deploying", icon: Clock, color: "#E65100" },
  { key: "deployed", label: "Deployed", icon: Rocket, color: "#00897B" },
  { key: "failed", label: "Failed", icon: XCircle, color: "#BA1A1A" },

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

  const VIEW_TABS = [
    { key: "board", label: "Board", Icon: ClipboardList },
    { key: "pingboard", label: "Pingboard", Icon: Bot },
    { key: "health", label: "Health", Icon: HeartPulse },
  ];

  if (view === "pingboard" || view === "health") {
    return (
      <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        <div className="header-glass" style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          display: "flex", alignItems: "center", gap: 2, padding: "0 16px", height: 48,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 16 }}>
            <div style={{
              width: 28, height: 28, background: "var(--md-primary)", color: "var(--md-on-primary)",
              borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 15,
            }}>d</div>
            <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.02em", color: "var(--md-on-background)" }}>
              tasks<span style={{ color: "var(--md-primary)", fontWeight: 700 }}>.</span>dante<span style={{ color: "var(--md-primary)", fontWeight: 700 }}>.</span>id
            </span>
          </div>
          {VIEW_TABS.map(t => (
            <button key={t.key} onClick={() => setView(t.key)} className={`nav-tab ${view === t.key ? "active" : ""}`}>
              <t.Icon size={15} strokeWidth={view === t.key ? 2.2 : 1.8} />
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ paddingTop: 42 }}>
          {view === "pingboard" ? <Pingboard /> : <HealthDashboard />}
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
      case "blocked": return filterByType(blocked);
      case "qa": return filterByType(qa).sort((a, b) => {
            const aAssigned = !!a.assigned_agent;
            const bAssigned = !!b.assigned_agent;
            if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
            if (aAssigned) return new Date(b.started_at || 0) - new Date(a.started_at || 0);
            return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
          });
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
        background: "var(--md-background)", fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>
        {/* Simplified header */}
        <div className="header-glass" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, background: "var(--md-primary)", color: "var(--md-on-primary)",
              borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 14,
            }}>d</div>
            <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>
              tasks<span style={{ color: "var(--md-primary)", fontWeight: 700 }}>.</span>dante<span style={{ color: "var(--md-primary)", fontWeight: 700 }}>.</span>id
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button onClick={() => setView("pingboard")} className="nav-tab" style={{ padding: "4px 8px" }}>
                <Bot size={16} strokeWidth={1.8} />
              </button>
              <button onClick={() => setView("health")} className="nav-tab" style={{ padding: "4px 8px" }}>
                <HeartPulse size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar - wrapping */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--md-surface-variant)" }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{
            width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
            background: "var(--md-surface)", color: "var(--md-on-background)", fontSize: 13,
            fontWeight: 500, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", outline: "none",
            marginBottom: 8, minHeight: 44,
          }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {activeTypes.map(type => (
              <button key={type} onClick={() => setTypeFilter(type)} className={`filter-chip ${typeFilter === type ? "active" : ""}`} style={{ minHeight: 36, padding: "6px 14px" }}>{type}</button>
            ))}
          </div>
          {activeStages.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {activeStages.map(stage => (
                <button key={stage} onClick={() => setStageFilter(stage)} className={`filter-chip ${stageFilter === stage ? "active" : ""}`} style={{ minHeight: 36, padding: "6px 14px" }}>{stage === "all" ? "all stages" : stage}</button>
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
              <div style={{ fontSize: 48, marginBottom: 12 }}><Search size={14} /></div>
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
      background: "var(--md-background)", fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <div className="header-glass" style={{ padding: "10px 20px 0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 0, height: 48,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 30, height: 30, background: "var(--md-primary)", color: "var(--md-on-primary)",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 16,
            }}>d</div>
            <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em", marginRight: 8 }}>
              tasks<span style={{ color: "var(--md-primary)", fontWeight: 700 }}>.</span>dante<span style={{ color: "var(--md-primary)", fontWeight: 700 }}>.</span>id
            </span>
            <div style={{ width: 1, height: 20, background: "var(--md-surface-variant)", margin: "0 4px" }} />
            {VIEW_TABS.map(t => (
              <button key={t.key} onClick={() => setView(t.key)} className={`nav-tab ${view === t.key ? "active" : ""}`}>
                <t.Icon size={15} strokeWidth={view === t.key ? 2.2 : 1.8} />
                {t.label}
              </button>
            ))}
            <span style={{ fontSize: 10, color: 'var(--md-on-surface-variant)', opacity: 0.5, fontFamily: "'JetBrains Mono', monospace", marginLeft: 8, background: 'var(--md-surface-container)', padding: '2px 6px', borderRadius: 4 }}>{__COMMIT_HASH__}</span>
          </div>
          <StatsBar stats={stats} isTablet={isTablet} />
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: isTablet ? "wrap" : "nowrap",
          paddingBottom: 10, borderBottom: "1px solid var(--header-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Project</span>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--md-surface-variant)",
              background: "var(--md-surface)", color: "var(--md-on-background)", fontSize: 13,
              fontWeight: 500, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", outline: "none",
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
                <button key={type} onClick={() => setTypeFilter(type)} className={`filter-chip ${typeFilter === type ? "active" : ""}`}>{type}</button>
              ))}
            </div>
          </div>
          {activeStages.length > 1 && (<>
            <div style={{ width: 1, height: 24, background: "var(--md-surface-variant)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Stage</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {activeStages.map(stage => (
                  <button key={stage} onClick={() => setStageFilter(stage)} className={`filter-chip ${stageFilter === stage ? "active" : ""}`}>{stage === "all" ? "all stages" : stage}</button>
                ))}
              </div>
            </div>
          </>)}
          <div style={{ width: 1, height: 24, background: "var(--md-surface-variant)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={15} style={{ position: "absolute", left: 10, color: "var(--md-on-surface-variant)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-pill"
              style={{ paddingLeft: 32, paddingRight: searchQuery ? 28 : 52 }}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", fontSize: 13, padding: 0, display: "flex" }}
              ><XCircle size={14} /></button>
            ) : (
              <span style={{ position: "absolute", right: 10, display: "flex", gap: 2, pointerEvents: "none" }}>
                <span className="kbd">⌘</span><span className="kbd">K</span>
              </span>
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
          {renderCards(filterByType(qa).sort((a, b) => {
            const aAssigned = !!a.assigned_agent;
            const bAssigned = !!b.assigned_agent;
            if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
            if (aAssigned) return new Date(b.started_at || 0) - new Date(a.started_at || 0);
            return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
          }).slice(0, 30))}
        </Column>
        <Column title="Completed" color="#1B5E20" count={filterByType(completed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.completed} onToggleCollapse={() => toggleCollapse("completed")}>
          {renderCards(filterByType(completed).slice(0, 20))}
        </Column>
        <Column title="Deploying" color="#E65100" count={filterByType(deploying).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deploying} onToggleCollapse={() => toggleCollapse("deploying")}>
          {renderCards(filterByType(deploying))}
        </Column>
        <Column title="Deployed" color="#00897B" count={filterByType(deployed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deployed} onToggleCollapse={() => toggleCollapse("deployed")}>
          {renderCards(filterByType(deployed).slice(0, 20))}
        </Column>
        <Column title="Deploy Failed" color="#C62828" count={filterByType(deployFailed).length} isTablet={isTablet}
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
            <div style={{ fontSize: 48, marginBottom: 12 }}><Search size={14} /></div>
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
