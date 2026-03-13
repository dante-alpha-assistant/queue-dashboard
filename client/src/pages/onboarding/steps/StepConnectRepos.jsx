import { useEffect, useRef, useCallback, useState } from "react";
import { Search, ExternalLink, Check, Loader2, Github, FolderPlus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: 12,
  border: "1px solid var(--md-surface-variant, #E7E0EC)",
  background: "var(--md-surface, #FFFBFE)",
  color: "var(--md-on-surface, #1C1B1F)", fontSize: 14,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 200ms, box-shadow 200ms",
};

/** Shared checkbox repo list */
function RepoList({ repos, isSelected, onToggle, loading, emptyMsg }) {
  return (
    <div style={{
      maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
      border: "1px solid var(--md-surface-variant, #E7E0EC)", borderRadius: 14, padding: 8,
    }}>
      {repos.length === 0 && !loading && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
          {emptyMsg}
        </div>
      )}
      {loading && repos.length === 0 && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite", color: "var(--md-primary)" }} />
        </div>
      )}
      {repos.map(r => {
        const selected = isSelected(r);
        return (
          <button
            key={r.full_name}
            onClick={() => onToggle(r)}
            style={{
              display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
              borderRadius: 12, border: `2px solid ${selected ? "var(--md-primary, #6750A4)" : "transparent"}`,
              background: selected ? "rgba(103,80,164,0.06)" : "transparent",
              cursor: "pointer", textAlign: "left", width: "100%",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              transition: "all 150ms",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
              border: `2px solid ${selected ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant, #E7E0EC)"}`,
              background: selected ? "var(--md-primary, #6750A4)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 150ms",
            }}>
              {selected && <Check size={13} color="#fff" strokeWidth={3} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)" }}>{r.name}</div>
              {r.description && (
                <div style={{
                  fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{r.description}</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                {r.language && (
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    background: "var(--md-surface-container, #F5F0FB)", color: "var(--md-on-surface-variant)",
                  }}>{r.language}</span>
                )}
                {r.private && (
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    background: "rgba(103,80,164,0.08)", color: "var(--md-primary)",
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
  const searchTimer = useRef(null);
  const userSearchTimer = useRef(null);
  const [oauthError, setOauthError] = useState(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Org repos (scratch mode) ─────────────────────────────
  const searchOrgRepos = useCallback(async (q) => {
    dispatch({ type: "SET_FIELD", field: "repoLoading", value: true });
    try {
      const resp = await fetch(`/api/github/repos?q=${encodeURIComponent(q)}`);
      if (!resp.ok) throw new Error("Search failed");
      dispatch({ type: "SET_FIELD", field: "repoResults", value: await resp.json() });
    } catch {
      dispatch({ type: "SET_FIELD", field: "repoResults", value: [] });
    } finally {
      dispatch({ type: "SET_FIELD", field: "repoLoading", value: false });
    }
  }, [dispatch]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchOrgRepos(state.repoSearch), 300);
    return () => clearTimeout(searchTimer.current);
  }, [state.repoSearch, searchOrgRepos]);

  useEffect(() => {
    if (state.repoSource === "scratch") searchOrgRepos("");
  }, [state.repoSource, searchOrgRepos]);

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
          border: `2px solid ${active ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant, #E7E0EC)"}`,
          background: active ? "rgba(103,80,164,0.06)" : "var(--md-surface, #FFFBFE)",
          boxShadow: active ? "0 2px 12px rgba(103,80,164,0.15)" : "none",
          transition: "all 200ms",
          display: "flex", flexDirection: "column", gap: 8,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: active ? "var(--md-primary, #6750A4)" : "var(--md-surface-container, #F5F0FB)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: active ? "#fff" : "var(--md-on-surface-variant)",
            transition: "all 200ms",
          }}>
            {icon}
          </div>
          {active && (
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--md-primary, #6750A4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={13} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--md-on-surface)", marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.5 }}>{subtitle}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="step-fields-stagger" style={{ gap: 18 }}>

      {/* Mode selector */}
      <div className="step-field" style={{ "--field-index": 0, display: "flex", gap: 12 }}>
        {modeCard("scratch", <FolderPlus size={20} />, "Create from scratch", "Use repos from the dante-alpha-assistant GitHub account")}
        {modeCard("github", <Github size={20} />, "Connect with your GitHub", "Browse and select from your personal repos")}
      </div>

      {/* Selected repos pills */}
      {state.repos.length > 0 && (
        <div className="step-field" style={{ "--field-index": 1, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {state.repos.map(r => (
            <span key={r.full_name} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 100,
              background: "var(--md-primary, #6750A4)", color: "#fff",
              fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
            }}>
              {r.name}
              <button onClick={() => dispatch({ type: "TOGGLE_REPO", repo: r })} style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.8)",
                cursor: "pointer", padding: 0, display: "flex", fontSize: 16, lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* ── Create from scratch mode ─────────────────────── */}
      {state.repoSource === "scratch" && (
        <>
          {/* Search */}
          <div className="step-field" style={{ "--field-index": 2, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--md-on-surface-variant)", pointerEvents: "none", zIndex: 1 }} />
            <input
              value={state.repoSearch}
              onChange={e => dispatch({ type: "SET_FIELD", field: "repoSearch", value: e.target.value })}
              placeholder="Search dante-alpha-assistant repos..."
              style={{ ...inputStyle, paddingLeft: 40 }}
            />
            {state.repoLoading && (
              <Loader2 size={16} style={{ position: "absolute", right: 14, top: 14, animation: "spin 0.8s linear infinite", color: "var(--md-on-surface-variant)" }} />
            )}
          </div>

          <div className="step-field" style={{ "--field-index": 3 }}>
            <RepoList
              repos={state.repoResults}
              isSelected={isSelected}
              onToggle={onToggle}
              loading={state.repoLoading}
              emptyMsg={state.repoSearch ? "No repos found" : "Loading repos..."}
            />
          </div>

          <div className="step-field" style={{ "--field-index": 4 }}>
            <a
              href="https://github.com/organizations/dante-alpha-assistant/repositories/new"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13, color: "var(--md-primary, #6750A4)", fontWeight: 600, textDecoration: "none",
              }}
            >
              <ExternalLink size={13} /> Create new repo on GitHub
            </a>
          </div>
        </>
      )}

      {/* ── Connect with your GitHub mode ───────────────── */}
      {state.repoSource === "github" && (
        <>
          {!state.githubToken ? (
            <div className="step-field" style={{
              "--field-index": 2,
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 14, padding: "32px 24px",
              border: "1px solid var(--md-surface-variant, #E7E0EC)",
              borderRadius: 16, background: "var(--md-surface, #FFFBFE)",
              textAlign: "center",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "var(--md-surface-container, #F5F0FB)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Github size={28} color="var(--md-on-surface-variant)" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--md-on-surface)", marginBottom: 4 }}>
                  Connect your GitHub account
                </div>
                <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
                  We'll request read-only access to your repositories.<br />
                  You can revoke access at any time in GitHub settings.
                </div>
              </div>
              {oauthError && (
                <div style={{
                  padding: "10px 16px", borderRadius: 10,
                  background: "rgba(179,38,30,0.08)", color: "#B3261E",
                  fontSize: 13, fontWeight: 500, border: "1px solid rgba(179,38,30,0.15)",
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
                  background: connectingOAuth ? "var(--md-surface-variant)" : "#24292F",
                  color: connectingOAuth ? "var(--md-on-surface-variant)" : "#fff",
                  cursor: connectingOAuth ? "not-allowed" : "pointer",
                  fontSize: 14, fontWeight: 700,
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  boxShadow: connectingOAuth ? "none" : "0 2px 10px rgba(0,0,0,0.2)",
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
                borderRadius: 12, background: "rgba(103,80,164,0.06)",
                border: "1px solid rgba(103,80,164,0.2)",
              }}>
                {state.githubUser?.avatar_url && (
                  <img src={state.githubUser.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>
                    Connected as <span style={{ color: "var(--md-primary)" }}>@{state.githubUser?.login || "you"}</span>
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
                    fontSize: 12, color: "var(--md-on-surface-variant)", background: "none",
                    border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6,
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  }}
                >
                  Disconnect
                </button>
              </div>

              {/* User repo search */}
              <div className="step-field" style={{ "--field-index": 3, position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--md-on-surface-variant)", pointerEvents: "none", zIndex: 1 }} />
                <input
                  value={state.userRepoSearch || ""}
                  onChange={e => dispatch({ type: "SET_FIELD", field: "userRepoSearch", value: e.target.value })}
                  placeholder={`Search @${state.githubUser?.login || "your"} repos...`}
                  style={{ ...inputStyle, paddingLeft: 40 }}
                />
                {state.userRepoLoading && (
                  <Loader2 size={16} style={{ position: "absolute", right: 14, top: 14, animation: "spin 0.8s linear infinite", color: "var(--md-on-surface-variant)" }} />
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
