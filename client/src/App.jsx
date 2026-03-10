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
import { Ban, Bot, CheckCircle2, ClipboardList, Clock, FlaskConical, HeartPulse, LayoutDashboard, Rocket, Search, XCircle, Zap } from 'lucide-react';

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

const BOTTOM_TABS = [
  { key: "todo", label: "Todo", icon: ClipboardList, color: "#71717A" },
  { key: "active", label: "Active", icon: Zap, color: "#EAB308" },
  { key: "blocked", label: "Blocked", icon: Ban, color: "#EF4444" },
  { key: "qa", label: "QA", icon: FlaskConical, color: "#A78BFA" },
  { key: "completed", label: "Done", icon: CheckCircle2, color: "#22C55E" },
  { key: "deploying", label: "Deploying", icon: Clock, color: "#F97316" },
  { key: "deployed", label: "Deployed", icon: Rocket, color: "#14B8A6" },
  { key: "failed", label: "Failed", icon: XCircle, color: "#EF4444" },
];

const VIEW_TABS = [
  { key: "board", label: "Board", Icon: LayoutDashboard },
  { key: "pingboard", label: "Pingboard", Icon: Bot },
  { key: "health", label: "Health", Icon: HeartPulse },
];

function HeaderLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 30, height: 30,
        background: "linear-gradient(135deg, #7C3AED 0%, #6750A4 100%)",
        borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 700, color: "#fff",
        letterSpacing: "-0.02em",
        boxShadow: "0 1px 3px rgba(124, 58, 237, 0.3)",
      }}>d</div>
      <span style={{
        fontWeight: 700, fontSize: 16, letterSpacing: "-0.03em",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "var(--md-on-background)",
      }}>
        tasks<span style={{ color: "var(--md-primary)", opacity: 0.7 }}>.</span>dante<span style={{ color: "var(--md-primary)", opacity: 0.7 }}>.</span>id
      </span>
    </div>
  );
}

function NavTabs({ view, setView }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {VIEW_TABS.map(t => (
        <button
          key={t.key}
          onClick={() => setView(t.key)}
          className={`nav-pill${view === t.key ? " active" : ""}`}
        >
          <t.Icon size={15} strokeWidth={view === t.key ? 2 : 1.5} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SearchBar({ searchQuery, setSearchQuery, isMobile }) {
  useEffect(() => {
    if (isMobile) return;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("header-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMobile]);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Search size={14} strokeWidth={1.5} style={{
        position: "absolute", left: 10, color: "var(--md-on-surface-variant)",
        pointerEvents: "none",
      }} />
      <input
        id="header-search"
        type="text"
        placeholder="Search tasks..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="search-input"
      />
      {!searchQuery && !isMobile && (
        <div style={{
          position: "absolute", right: 10,
          display: "flex", alignItems: "center", gap: 2,
          pointerEvents: "none",
        }}>
          <span className="kbd-hint">⌘</span>
          <span className="kbd-hint">K</span>
        </div>
      )}
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          style={{
            position: "absolute", right: 8, background: "none", border: "none",
            cursor: "pointer", color: "var(--md-on-surface-variant)", fontSize: 12,
            padding: "2px", display: "flex", alignItems: "center",
          }}
        ><XCircle size={14} /></button>
      )}
    </div>
  );
}

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

  const COLLAPSIBLE_COLUMNS = ["todo", "in_progress", "blocked", "qa_testing", "completed", "deploying", "deployed", "deploy_failed", "failed"];
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = localStorage.getItem("collapsed-columns");
      if (saved) return JSON.parse(saved);
    } catch {}
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

  if (view === "pingboard" || view === "health") {
    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="header-glass" style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          display: "flex", alignItems: "center", gap: 16, padding: "0 20px", height: 48,
        }}>
          <HeaderLogo />
          <div style={{ width: 1, height: 20, background: "var(--md-outline)" }} />
          <NavTabs view={view} setView={setView} />
        </div>
        <div style={{ paddingTop: 48 }}>
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
      case "todo": return { title: "Todo", color: "#71717A" };
      case "active": return { title: "Active", color: "#EAB308" };
      case "blocked": return { title: "Blocked", color: "#EF4444" };
      case "qa": return { title: "QA Testing", color: "#A78BFA" };
      case "completed": return { title: "Completed", color: "#22C55E" };
      case "deploying": return { title: "Deploying", color: "#F97316" };
      case "deployed": return { title: "Deployed", color: "#14B8A6" };
      case "deploy_failed": return { title: "Deploy Failed", color: "#EF4444" };
      case "failed": return { title: "Failed", color: "#EF4444" };
      default: return { title: "Todo", color: "#71717A" };
    }
  };

  const renderCards = (tasks) =>
    tasks.map(t => <TaskCard key={t.id} task={t} onStatusChange={updateTask} onCardClick={handleSelectTask} isMobile={isMobile} progress={taskProgress[t.id]} monitor={taskMonitor[t.id]} transitioning={!!transitioning[t.id]} />);

  const taskNotFoundModal = selectedTask && selectedTask._notFound && (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={handleCloseTask}>
      <div style={{
        background: "var(--md-surface-container)", borderRadius: 12, padding: "32px 40px",
        textAlign: "center", maxWidth: 400, border: "1px solid var(--md-outline)",
      }} onClick={e => e.stopPropagation()}>
        <Search size={32} style={{ color: "var(--md-on-surface-variant)", marginBottom: 12 }} />
        <h2 style={{ margin: "0 0 8px", color: "var(--md-on-background)", fontSize: 18, fontWeight: 600 }}>Task Not Found</h2>
        <p style={{ color: "var(--md-on-surface-variant)", fontSize: 13, margin: "0 0 20px" }}>
          No task with ID <code style={{ fontSize: 11, background: "var(--md-surface-variant)", padding: "2px 6px", borderRadius: 4 }}>{selectedTask.id}</code>
        </p>
        <button onClick={handleCloseTask} style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: "var(--md-primary)", color: "var(--md-on-primary)",
          cursor: "pointer", fontWeight: 600, fontSize: 13,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>Back to Board</button>
      </div>
    </div>
  );

  // MOBILE LAYOUT
  if (isMobile) {
    const colMeta = getActiveColumnMeta();
    const colTasks = getActiveColumnTasks();
    return (
      <div style={{
        display: "flex", flexDirection: "column", height: "100vh",
        background: "var(--md-background)", fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div className="header-glass" style={{ padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HeaderLogo />
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <div className={`connection-dot ${sseConnected ? "connected" : "disconnected"}`} title={sseConnected ? "Live" : "Disconnected"} />
              <button onClick={() => setView("pingboard")} className="nav-pill" style={{ padding: "5px 8px" }}>
                <Bot size={16} strokeWidth={1.5} />
              </button>
              <button onClick={() => setView("health")} className="nav-pill" style={{ padding: "5px 8px" }}>
                <HeartPulse size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--header-border)" }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{
            width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--md-outline)",
            background: "var(--md-surface-container)", color: "var(--md-on-background)", fontSize: 13,
            fontWeight: 500, fontFamily: "'Inter', system-ui, sans-serif", outline: "none",
            marginBottom: 8, minHeight: 44,
          }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {activeTypes.map(type => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={`filter-chip${typeFilter === type ? " active" : ""}`}
                style={{ minHeight: 36 }}
              >{type}</button>
            ))}
          </div>
          {activeStages.length > 1 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
              {activeStages.map(stage => (
                <button key={stage} onClick={() => setStageFilter(stage)}
                  className={`filter-chip${stageFilter === stage ? " active" : ""}`}
                  style={{ minHeight: 36 }}
                >{stage === "all" ? "all stages" : stage}</button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <TimeFilter allTasks={allTasksRaw} value={timeFilter} onChange={setTimeFilter} isMobile={true} />
          </div>
        </div>

        <div style={{ padding: "10px 16px 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: colMeta.color }} />
          <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: "-0.01em" }}>{colMeta.title}</span>
          <span style={{
            background: `${colMeta.color}15`, color: colMeta.color,
            padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            border: `1px solid ${colMeta.color}20`,
          }}>{colTasks.length}</span>
          {activeTab === "todo" && <DispatchButton />}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "4px 12px 80px", minHeight: 0 }}>
          {colTasks.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--md-on-surface-variant)", padding: 40, fontSize: 13 }}>No tasks</div>
          )}
          {renderCards(colTasks)}
        </div>

        <button onClick={() => {}} style={{
          position: "fixed", bottom: 76, right: 16, width: 52, height: 52,
          borderRadius: 14, background: "linear-gradient(135deg, #7C3AED 0%, #6750A4 100%)",
          color: "#fff", border: "none", fontSize: 22, fontWeight: 300, cursor: "pointer", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
        }}>+</button>

        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: 60,
          background: "var(--header-bg)", backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--header-border)",
          display: "flex", alignItems: "center", justifyContent: "space-around",
          zIndex: 40, paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {BOTTOM_TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 10px", minWidth: 44,
                color: isActive ? "var(--md-primary)" : "var(--md-on-surface-variant)",
                position: "relative", transition: "color 150ms ease",
              }}>
                {isActive && <div style={{
                  position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                  width: 24, height: 2, borderRadius: 1, background: "var(--md-primary)",
                }} />}
                <TabIcon size={18} strokeWidth={isActive ? 2 : 1.5} />
                <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400, letterSpacing: "0.01em" }}>{tab.label}</span>
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
        {taskNotFoundModal}
      </div>
    );
  }

  // TABLET + DESKTOP LAYOUT
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "var(--md-background)", fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div className="header-glass" style={{
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 52,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <HeaderLogo />
            <div style={{ width: 1, height: 20, background: "var(--md-outline)" }} />
            <NavTabs view={view} setView={setView} />
            <div style={{ width: 1, height: 20, background: "var(--md-outline)" }} />
            <div className={`connection-dot ${sseConnected ? "connected" : "disconnected"}`} title={sseConnected ? "Live" : "Disconnected"} />
            <span style={{
              fontSize: 10, color: 'var(--md-on-surface-variant)', opacity: 0.5,
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--md-surface-container)', padding: '2px 6px', borderRadius: 4,
              border: '1px solid var(--md-outline)',
            }}>{__COMMIT_HASH__}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} isMobile={false} />
            <StatsBar stats={stats} isTablet={isTablet} />
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: isTablet ? "wrap" : "nowrap",
          paddingBottom: 10, paddingTop: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
              textTransform: "uppercase", letterSpacing: "0.05em",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>Project</span>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{
              padding: "5px 10px", borderRadius: 6, border: "1px solid var(--md-outline)",
              background: "var(--md-surface-container)", color: "var(--md-on-background)", fontSize: 12,
              fontWeight: 500, fontFamily: "'Inter', system-ui, sans-serif", outline: "none",
              cursor: "pointer", minWidth: 140,
            }}>
              <option value="">All</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ width: 1, height: 20, background: "var(--md-outline)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
              textTransform: "uppercase", letterSpacing: "0.05em",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>Type</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {activeTypes.map(type => (
                <button key={type} onClick={() => setTypeFilter(type)}
                  className={`filter-chip${typeFilter === type ? " active" : ""}`}
                >{type}</button>
              ))}
            </div>
          </div>
          {activeStages.length > 1 && (<>
            <div style={{ width: 1, height: 20, background: "var(--md-outline)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "var(--md-on-surface-variant)",
                textTransform: "uppercase", letterSpacing: "0.05em",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>Stage</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {activeStages.map(stage => (
                  <button key={stage} onClick={() => setStageFilter(stage)}
                    className={`filter-chip${stageFilter === stage ? " active" : ""}`}
                  >{stage === "all" ? "all stages" : stage}</button>
                ))}
              </div>
            </div>
          </>)}
          <div style={{ width: 1, height: 20, background: "var(--md-outline)" }} />
          <TimeFilter allTasks={allTasksRaw} value={timeFilter} onChange={setTimeFilter} isMobile={false} />
        </div>
      </div>

      <div style={{
        flex: 1, display: "flex", gap: 12, padding: "16px 24px", overflowX: "auto", minHeight: 0,
      }}>
        <Column title="Todo" color="#71717A" count={filterByType(todo).length} isTablet={isTablet} headerAction={<DispatchButton />}
          collapsible collapsed={!!collapsedCols.todo} onToggleCollapse={() => toggleCollapse("todo")}>
          {renderCards(filterByType(todo))}
        </Column>
        <Column title="In Progress" color="#EAB308" count={filterByType(assigned).length + filterByType(inProgress).length} agentCount={countActiveTasks([...filterByType(assigned), ...filterByType(inProgress)])} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.in_progress} onToggleCollapse={() => toggleCollapse("in_progress")}>
          {renderCards([...filterByType(assigned), ...filterByType(inProgress)])}
        </Column>
        <Column title="Blocked" color="#EF4444" count={filterByType(blocked).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.blocked} onToggleCollapse={() => toggleCollapse("blocked")}>
          {renderCards([...filterByType(blocked)].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at)))}
        </Column>
        <Column title="QA Testing" color="#A78BFA" count={filterByType(qa).length} agentCount={countActiveTasks(filterByType(qa))} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.qa_testing} onToggleCollapse={() => toggleCollapse("qa_testing")}>
          {renderCards(filterByType(qa).sort((a, b) => {
            const aAssigned = !!a.assigned_agent;
            const bAssigned = !!b.assigned_agent;
            if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
            if (aAssigned) return new Date(b.started_at || 0) - new Date(a.started_at || 0);
            return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
          }).slice(0, 30))}
        </Column>
        <Column title="Completed" color="#22C55E" count={filterByType(completed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.completed} onToggleCollapse={() => toggleCollapse("completed")}>
          {renderCards(filterByType(completed).slice(0, 20))}
        </Column>
        <Column title="Deploying" color="#F97316" count={filterByType(deploying).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deploying} onToggleCollapse={() => toggleCollapse("deploying")}>
          {renderCards(filterByType(deploying))}
        </Column>
        <Column title="Deployed" color="#14B8A6" count={filterByType(deployed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deployed} onToggleCollapse={() => toggleCollapse("deployed")}>
          {renderCards(filterByType(deployed).slice(0, 20))}
        </Column>
        <Column title="Deploy Failed" color="#EF4444" count={filterByType(deployFailed).length} isTablet={isTablet}
          collapsible collapsed={!!collapsedCols.deploy_failed} onToggleCollapse={() => toggleCollapse("deploy_failed")}>
          {renderCards(filterByType(deployFailed))}
        </Column>
        <Column title="Failed" color="#EF4444" count={filterByType(failed).length} isTablet={isTablet}
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
      {taskNotFoundModal}
    </div>
  );
}
