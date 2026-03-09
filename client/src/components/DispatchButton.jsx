import { useState } from "react";
import { Zap } from 'lucide-react';

export default function DispatchButton() {
  const [state, setState] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  async function handleDispatch(e) {
    e.stopPropagation();
    if (state === "loading") return;
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/dispatch", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const count = data.assigned || 0;
        setMessage(count > 0 ? `Assigned ${count} task${count > 1 ? "s" : ""}` : "No tasks to assign");
        setState("success");
      } else {
        setMessage(data.error || "Dispatch failed");
        setState("error");
      }
    } catch (err) {
      setMessage("Network error");
      setState("error");
    }
    setTimeout(() => { setState("idle"); setMessage(""); }, 3000);
  }

  const baseStyle = {
    border: "none",
    borderRadius: 8,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 600,
    cursor: state === "loading" ? "wait" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    transition: "all 150ms ease",
    whiteSpace: "nowrap",
  };

  const stateStyles = {
    idle: { background: "#6750A420", color: "#6750A4" },
    loading: { background: "#6750A420", color: "#6750A4" },
    success: { background: "#1B5E2020", color: "#1B5E20" },
    error: { background: "#BA1A1A20", color: "#BA1A1A" },
  };

  return (
    <button onClick={handleDispatch} style={{ ...baseStyle, ...stateStyles[state] }} title="Dispatch all todo tasks">
      {state === "loading" ? (
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
      ) : state === "success" ? (
        <span>✓ {message}</span>
      ) : state === "error" ? (
        <span>✗ {message}</span>
      ) : (
        <span><Zap size={14} /> Dispatch</span>
      )}
    </button>
  );
}
