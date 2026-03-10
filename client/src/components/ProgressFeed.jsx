import { useState, useEffect } from "react";
import { Activity, Pause, Settings } from 'lucide-react';

/**
 * Compact progress indicator for TaskCard — shows current step + optional percent bar.
 */
export function ProgressBadge({ progress, monitor }) {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(id);
  }, []);

  if (!progress && !monitor) return null;

  const step = progress?.step;
  const percent = progress?.percent;
  const log = progress?.log;
  const alive = monitor?.sessionAlive;

  // Nothing useful to show
  if (!step && percent == null && !alive) return null;

  const displayText = step || log || (alive ? "Agent working…" : null);
  if (!displayText && percent == null) return null;

  return (
    <div
      style={{
        margin: "8px 0 4px",
        padding: "8px 12px",
        background: "linear-gradient(135deg, #1A237E08, #6750A40A)",
        borderRadius: 10,
        border: "1px solid #6750A418",
        fontSize: 12,
        color: "var(--md-on-surface-variant, #49454F)",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Step text */}
      {displayText && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#6750A4",
              flexShrink: 0,
              opacity: pulse ? 1 : 0.3,
              transition: "opacity 0.5s ease",
            }}
          />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.01em",
            }}
          >
            {displayText}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {percent != null && percent >= 0 && (
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: "var(--md-surface-variant, #E7E0EC)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, percent))}%`,
              background: "linear-gradient(90deg, #6750A4, #9C27B0)",
              borderRadius: 2,
              transition: "width 0.6s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Detailed progress feed for TaskDetailModal — shows full activity log.
 */
export function ProgressDetail({ progress, monitor }) {
  if (!progress && !monitor) return null;

  const step = progress?.step;
  const percent = progress?.percent;
  const log = progress?.log;
  const alive = monitor?.sessionAlive;
  const elapsed = monitor?.elapsed;

  if (!step && percent == null && !log && alive == null) return null;

  const formatElapsed = (ms) => {
    if (!ms) return null;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <div
      style={{
        margin: "12px 0",
        padding: "14px 16px",
        background: "linear-gradient(135deg, #1A237E06, #6750A40C)",
        borderRadius: 12,
        border: "1px solid #6750A420",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#6750A4",
          }}
        >
          <span
            style={{
              display: "inline-block",
              animation: alive !== false ? "spin 2s linear infinite" : "none",
            }}
          >
            {alive !== false ? <Settings size={14} /> : <Pause size={14} />}
          </span>
          Live Activity
          {alive !== false && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#4CAF50",
                animation: "timeline-pulse 2s ease-in-out infinite",
              }}
            />
          )}
        </div>
        {elapsed != null && (
          <span
            style={{
              fontSize: 11,
              color: "var(--md-outline, #79747E)",
              fontFamily: "'Roboto Mono', monospace",
            }}
          >
            {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {percent != null && percent >= 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--md-on-surface-variant, #49454F)",
              marginBottom: 4,
            }}
          >
            <span>Progress</span>
            <span style={{ fontWeight: 600, fontFamily: "'Roboto Mono', monospace" }}>
              {Math.round(percent)}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "var(--md-surface-variant, #E7E0EC)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, Math.max(0, percent))}%`,
                background: "linear-gradient(90deg, #6750A4, #9C27B0)",
                borderRadius: 3,
                transition: "width 0.6s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Current step */}
      {step && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 13,
            color: "var(--md-on-surface, #1C1B1F)",
            marginBottom: log ? 8 : 0,
          }}
        >
          <span style={{ color: "#6750A4", fontWeight: 600, flexShrink: 0 }}>▸</span>
          <span style={{ fontWeight: 500 }}>{step}</span>
        </div>
      )}

      {/* Log output */}
      {log && (
        <div
          style={{
            padding: "8px 10px",
            background: "#1C1B1F",
            borderRadius: 8,
            fontSize: 11,
            fontFamily: "'Roboto Mono', 'SF Mono', monospace",
            color: "#E0E0E0",
            lineHeight: 1.5,
            maxHeight: 120,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {log}
        </div>
      )}

      {/* Session status when no progress data */}
      {!step && !log && percent == null && alive != null && (
        <div
          style={{
            fontSize: 12,
            color: alive ? "#2E7D32" : "#79747E",
            fontStyle: "italic",
          }}
        >
          {alive ? "Session active — agent is working" : "Session not detected"}
        </div>
      )}
    </div>
  );
}
