import { useEffect, useRef, useCallback, useState } from "react";
import { Check, Loader2, Github, FolderPlus, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const inputStyle = {
  width: "100%", padding: "12px 16px 12px 42px", borderRadius: 12,
  border: "1px solid #1E293B",
  background: "#0F172A",
  color: "#F1F5F9", fontSize: 14,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 200ms, box-shadow 200ms",
};

/** Slugify an app name into a repo-safe string */
function slugify(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "my-app";
}

/** Shared checkbox repo list */
function RepoList({ repos, isSelected, onToggle, loading, emptyMsg }) {
  const [hoveredRepo, setHoveredRepo] = useState(null);
  return (
    <div style={{
      maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4,
      border: "1px solid #1E293B", borderRadius: 14, padding: 8,
      background: "#0F172A",
    }}>
      {repos.length === 0 && !loading && (
        <div style={{ padding: 24, textAlign: "center", color: "#475569", fontSize: 13 }}>
          {emptyMsg}
        </div>
      )}
      {loading && repos.length === 0 && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite", color: "#7C3AED" }} />
        </div>
      )}
      {repos.map(r => {
        const selected = isSelected(r);
        const hovered = hoveredRepo === r.full_name;
        return (
          <button
            key={r.full_name}
            onClick={() => onToggle(r)}
            onMouseEnter={() => setHoveredRepo(r.full_name)}
            onMouseLeave={() => setHoveredRepo(null)}
            style={{
              display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
              borderRadius: 12,
              border: selected
                ? "2px solid #7C3AED"
                : hovered
                  ? "2px solid #1E293B"
                  : "2px solid transparent",
              background: selected
                ? "rgba(124,58,237,0.12)"
                : hovered
                  ? "rgba(139,92,246,0.05)"
                  : "transparent",
              cursor: "pointer", textAlign: "left", width: "100%",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              transition: "all 150ms",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
              border: `2px solid ${selected ? "#7C3AED" : "#334155"}`,
              background: selected ? "#7C3AED" : "#1E293B",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 150ms",
            }}>
              {selected && <Check size={13} color="#fff" strokeWidth={3} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9" }}>{r.name}</div>
              {r.description && (
                <div style={{
                  fontSize: 12, color: "#94A3B8", marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{r.description}</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                {r.language && (
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 6,
                    background: "rgba(139,92,246,0.15)", color: "#A78BFA", fontWeight: 600,
                    border: "1px solid rgba(139,92,246,0.25)", letterSpacing: "0.03em",
                  }}>{r.language}</span>
                )}
                {r.private && (
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    background: "rgba(124,58,237,0.12)", color: "#A78BFA",
                  }}>private</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function StepConnectRepos({ state, dispatch }) {
  const userSearchTimer = useRef(null);
  const userEditedScratchName = useRef(false);
  const [oauthError, setOauthError] = useState(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Scratch repo name local state ─────────────────────────
  const [scratchRepoName, setScratchRepoName] = useState(() => slugify(state.name));

  // Sync scratchRepoName when app name changes (unless user manually edited it)
  useEffect(() => {
    if (!userEditedScratchName.current) {
      setScratchRepoName(slugify(state.name));
    }
  }, [state.name]);

  // Whenever scratchRepoName changes, update wizard repos state (scratch mode only)
  useEffect(() => {
    if (state.repoSource === "scratch") {
      const name = scratchRepoName || "my-app";
      dispatch({
        type: "SET_FIELD",
        field: "repos",
        value: [{ full_name: `dante-alpha-assistant/${name}`, name }],
      });
    }
  }, [scratchRepoName, state.repoSource, dispatch]);

  // Reset userEdited flag when switching back to scratch mode
  useEffect(() => {
    if (state.repoSource === "scratch") {
      userEditedScratchName.current = false;
      setScratchRepoName(slugify(state.name));
    }
  }, [state.repoSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── User repos (github OAuth mode) ───────────────────────
  const searchUserRepos = useCallback(async (q) => {
    if (!state.githubToken) return;
    dispatch({ type: "SET_FIELD", field: "userRepoLoading", value: true });
    try {
      const resp = await fetch(`/api/github/user-repos?token=${encodeURIComponent(state.githubToken)}&q=${encodeURIComponent(q)}`);
      if (!resp.ok) throw new Error("Search failed");
      dispatch({ type: "SET_FIELD", field: "userRepoResults", value: await resp.json() });
    } catch {
      dispatch({ type: "SET_FIELD", field: "userRepoResults", value: [] });
    } finally {
      dispatch({ type: "SET_FIELD", field: "userRepoLoading", value: false });
    }
  }, [dispatch, state.githubToken]);

  useEffect(() => {
    if (state.repoSource === "github" && state.githubToken) {
      searchUserRepos("");
    }
  }, [state.repoSource, state.githubToken, searchUserRepos]);

  useEffect(() => {
    clearTimeout(userSearchTimer.current);
    userSearchTimer.current = setTimeout(() => searchUserRepos(state.userRepoSearch || ""), 300);
    return () => clearTimeout(userSearchTimer.current);
  }, [state.userRepoSearch, searchUserRepos]);

  // ── Handle OAuth callback (code in URL) ──────────────────
  useEffect(() => {
    const code = searchParams.get("code");
    const oauthState = searchParams.get("state");
    if (!code) return;

    // Only handle if we're in github mode (user chose it before OAuth redirect)
    setConnectingOAuth(true);
    setOauthError(null);
    fetch(`/api/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(oauthState || "")}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        dispatch({ type: "SET_FIELD", field: "githubToken", value: data.token });
        dispatch({ type: "SET_FIELD", field: "githubUser", value: { login: data.login, avatar_url: data.avatar_url } });
        // Ensure we're in github mode after successful OAuth
        dispatch({ type: "SET_FIELD", field: "repoSource", value: "github" });
        // Clean code/state from URL
        const params = new URLSearchParams(searchParams);
        params.delete("code");
        params.delete("state");
        setSearchParams(params, { replace: true });
      })
      .catch(e => setOauthError(e.message))
      .finally(() => setConnectingOAuth(false));
  }, []); // Run once on mount

  // ── OAuth connect handler ─────────────────────────────────
  const handleConnectGitHub = async () => {
    setOauthError(null);
    setConnectingOAuth(true);
    try {
      const redirectUri = `${window.location.origin}/apps/new?step=2`;
      const resp = await fetch(`/api/github/auth?redirect_uri=${encodeURIComponent(redirectUri)}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e) {
      setOauthError(e.message);
      setConnectingOAuth(false);
    }
  };

  const isSelected = (r) => state.repos.some(s => s.full_name === r.full_name);
  const onToggle = (r) => dispatch({ type: "TOGGLE_REPO", repo: r });

  // ── Mode selector cards ───────────────────────────────────
  const modeCard = (id, icon, title, subtitle) => {
    const active = state.repoSource === id;
    return (
      <button
        key={id}
        onClick={() => dispatch({ type: "SET_REPO_SOURCE", value: id })}
        style={{
          flex: 1, padding: "20px 18px", borderRadius: 16, cursor: "pointer", textAlign: "left",
          border: `2px solid ${active ? "#7C3AED" : "#1E293B"}`,
          background: active ? "rgba(124,58,237,0.1)" : "#0F172A",
          boxShadow: active ? "0 2px 12px rgba(124,58,237,0.2)" : "none",
          transition: "all 200ms",
          display: "flex", flexDirection: "column", gap: 8,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: active ? "#7C3AED" : "#1E293B",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: active ? "#fff" : "#475569",
            transition: "all 200ms",
          }}>
            {icon}
          </div>
          {active && (
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "#7C3AED",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={13} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>{subtitle}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="step-fields-stagger" style={{ gap: 18 }}>

      {/* Mode selector */}
      <div className="step-field" style={{ "--field-index": 0, display: "flex", gap: 12 }}>
        {modeCard("scratch", <FolderPlus size={20} />, "Create from scratch", "We'll create a new repository in dante-alpha-assistant automatically")}
        {modeCard("github", <Github size={20} />, "Connect with your GitHub", "Browse and select from your personal repos")}
      </div>

      {/* Selected repos pills — only shown in github mode */}
      {state.repoSource === "github" && state.repos.length > 0 && (
        <div className="step-field" style={{ "--field-index": 1, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {state.repos.map(r => (
            <span key={r.full_name} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 100,
              background: "#7C3AED", color: "#fff",
              fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
            }}>
              {r.name}
              <button onClick={() => dispatch({ type: "TOGGLE_REPO", repo: r })} style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.7)",
                cursor: "pointer", padding: 0, display: "flex", fontSize: 16, lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* ── Create from scratch mode ─────────────────────── */}
      {state.repoSource === "scratch" && (
        <div className="step-field" style={{ "--field-index": 2 }}>
          {/* Confirmation panel */}
          <div style={{
            padding: "20px 22px",
            borderRadius: 16,
            border: "1px solid rgba(124,58,237,0.3)",
            background: "rgba(124,58,237,0.06)",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            {/* Info message */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: "rgba(124,58,237,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Info size={18} color="#A78BFA" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", marginBottom: 4 }}>
                  A new repository will be created automatically
                </div>
                <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
                  We'll create this repo under the <span style={{ color: "#A78BFA", fontWeight: 600 }}>dante-alpha-assistant</span> GitHub organization when you deploy your app. You can rename it below if needed.
                </div>
              </div>
            </div>

            {/* Editable repo name */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Repository name
              </div>
              <div style={{
                display: "flex", alignItems: "center",
                border: "1px solid #1E293B",
                borderRadius: 12, overflow: "hidden",
                background: "#0F172A",
                fontFamily: "'JetBrains Mono', monospace",
                transition: "border-color 200ms, box-shadow 200ms",
              }}
                onFocusCapture={e => {
                  e.currentTarget.style.borderColor = "#7C3AED";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.15)";
                }}
                onBlurCapture={e => {
                  e.currentTarget.style.borderColor = "#1E293B";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span style={{
                  padding: "12px 14px",
                  fontSize: 13, color: "#475569", flexShrink: 0,
                  borderRight: "1px solid #1E293B",
                  background: "#0A1020",
                  userSelect: "none",
                }}>
                  dante-alpha-assistant /
                </span>
                <input
                  value={scratchRepoName}
                  onChange={e => {
                    userEditedScratchName.current = true;
                    setScratchRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+/, ""));
                  }}
                  onBlur={e => {
                    // Clean trailing hyphens on blur
                    const cleaned = e.target.value.replace(/^-+|-+$/g, "") || slugify(state.name) || "my-app";
                    setScratchRepoName(cleaned);
                  }}
                  placeholder="my-app"
                  style={{
                    flex: 1, padding: "12px 14px",
                    border: "none", outline: "none",
                    background: "transparent",
                    color: "#F1F5F9", fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>
                github.com/dante-alpha-assistant/{scratchRepoName || "my-app"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Connect with your GitHub mode ───────────────── */}
      {state.repoSource === "github" && (
        <>
          {!state.githubToken ? (
            <div className="step-field" style={{
              "--field-index": 2,
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 14, padding: "32px 24px",
              border: "1px solid #1E293B",
              borderRadius: 16, background: "#0F172A",
              textAlign: "center",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "#1E293B",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Github size={28} color="#475569" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>
                  Connect your GitHub account
                </div>
                <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
                  We'll request read-only access to your repositories.<br />
                  You can revoke access at any time in GitHub settings.
                </div>
              </div>
              {oauthError && (
                <div style={{
                  padding: "10px 16px", borderRadius: 10,
                  background: "rgba(179,38,30,0.08)", color: "#F87171",
                  fontSize: 13, fontWeight: 500, border: "1px solid rgba(179,38,30,0.2)",
                  width: "100%", boxSizing: "border-box",
                }}>
                  {oauthError}
                </div>
              )}
              <button
                onClick={handleConnectGitHub}
                disabled={connectingOAuth}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "12px 24px", borderRadius: 100, border: "none",
                  background: connectingOAuth ? "#1E293B" : "#24292F",
                  color: connectingOAuth ? "#475569" : "#fff",
                  cursor: connectingOAuth ? "not-allowed" : "pointer",
                  fontSize: 14, fontWeight: 700,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  boxShadow: connectingOAuth ? "none" : "0 2px 10px rgba(0,0,0,0.3)",
                  transition: "all 150ms",
                }}
              >
                {connectingOAuth
                  ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Connecting...</>
                  : <><Github size={16} /> Connect GitHub</>
                }
              </button>
            </div>
          ) : (
            <>
              {/* Connected user badge */}
              <div className="step-field" style={{
                "--field-index": 2,
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                borderRadius: 12, background: "rgba(124,58,237,0.1)",
                border: "1px solid rgba(124,58,237,0.25)",
              }}>
                {state.githubUser?.avatar_url && (
                  <img src={state.githubUser.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>
                    Connected as <span style={{ color: "#A78BFA" }}>@{state.githubUser?.login || "you"}</span>
                  </span>
                </div>
                <button
                  onClick={() => {
                    dispatch({ type: "SET_FIELD", field: "githubToken", value: null });
                    dispatch({ type: "SET_FIELD", field: "githubUser", value: null });
                    dispatch({ type: "SET_FIELD", field: "userRepoResults", value: [] });
                    dispatch({ type: "SET_FIELD", field: "repos", value: [] });
                  }}
                  style={{
                    fontSize: 12, color: "#475569", background: "none",
                    border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6,
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  }}
                >
                  Disconnect
                </button>
              </div>

              {/* User repo search */}
              <div className="step-field" style={{ "--field-index": 3, position: "relative" }}>
                <div style={{ position: "absolute", left: 14, top: 14, color: "#475569", pointerEvents: "none", zIndex: 1 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <input
                  value={state.userRepoSearch || ""}
                  onChange={e => dispatch({ type: "SET_FIELD", field: "userRepoSearch", value: e.target.value })}
                  placeholder={`Search @${state.githubUser?.login || "your"} repos...`}
                  style={inputStyle}
                  onFocus={e => {
                    e.target.style.borderColor = "#7C3AED";
                    e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.15)";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = "#1E293B";
                    e.target.style.boxShadow = "none";
                  }}
                />
                {state.userRepoLoading && (
                  <Loader2 size={16} style={{ position: "absolute", right: 14, top: 14, animation: "spin 0.8s linear infinite", color: "#475569" }} />
                )}
              </div>

              <div className="step-field" style={{ "--field-index": 4 }}>
                <RepoList
                  repos={state.userRepoResults || []}
                  isSelected={isSelected}
                  onToggle={onToggle}
                  loading={state.userRepoLoading}
                  emptyMsg={state.userRepoSearch ? "No repos found" : "Loading your repos..."}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
