import { useEffect, useRef, useCallback } from "react";
import { Search, ExternalLink, Check, Loader2 } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: 12,
  border: "1px solid var(--md-surface-variant, #E7E0EC)",
  background: "var(--md-surface, #FFFBFE)",
  color: "var(--md-on-surface, #1C1B1F)", fontSize: 14,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 200ms, box-shadow 200ms",
};

export default function StepConnectRepos({ state, dispatch }) {
  const searchTimer = useRef(null);

  const searchRepos = useCallback(async (q) => {
    dispatch({ type: "SET_FIELD", field: "repoLoading", value: true });
    try {
      const resp = await fetch(`/api/github/repos?q=${encodeURIComponent(q)}`);
      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      dispatch({ type: "SET_FIELD", field: "repoResults", value: data });
    } catch {
      dispatch({ type: "SET_FIELD", field: "repoResults", value: [] });
    } finally {
      dispatch({ type: "SET_FIELD", field: "repoLoading", value: false });
    }
  }, [dispatch]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchRepos(state.repoSearch), 300);
    return () => clearTimeout(searchTimer.current);
  }, [state.repoSearch, searchRepos]);

  useEffect(() => { searchRepos(""); }, [searchRepos]);

  const isSelected = (r) => state.repos.some(s => s.full_name === r.full_name);

  return (
    <div className="step-fields-stagger" style={{ gap: 16 }}>
      {/* Selected repos pills */}
      {state.repos.length > 0 && (
        <div className="step-field" style={{ "--field-index": 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      {/* Search */}
      <div className="step-field" style={{ "--field-index": 1, position: "relative" }}>
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

      {/* Results list */}
      <div className="step-field" style={{
        "--field-index": 2,
        maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
        border: "1px solid var(--md-surface-variant, #E7E0EC)", borderRadius: 14, padding: 8,
      }}>
        {state.repoResults.length === 0 && !state.repoLoading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13 }}>
            {state.repoSearch ? "No repos found" : "Loading repos..."}
          </div>
        )}
        {state.repoResults.map(r => {
          const selected = isSelected(r);
          return (
            <button
              key={r.full_name}
              onClick={() => dispatch({ type: "TOGGLE_REPO", repo: r })}
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
                {r.language && (
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4, marginTop: 4, display: "inline-block",
                    background: "var(--md-surface-container, #F5F0FB)", color: "var(--md-on-surface-variant)",
                  }}>{r.language}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Create new repo link */}
      <div className="step-field" style={{ "--field-index": 3 }}>
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
    </div>
  );
}
