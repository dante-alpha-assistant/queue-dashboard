import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppDetailView } from "./AppsPage.jsx";
import SpeedLoader from "../components/SpeedLoader.jsx";

export default function AppDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/apps/${id}`)
      .then(r => {
        if (r.status === 404) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data) {
          setApp(data);
          setLoading(false);
        }
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  const refresh = () =>
    fetch(`/api/apps/${id}`)
      .then(r => r.json())
      .then(setApp)
      .catch(() => {});

  const handleSave = async (data) => {
    await fetch(`/api/apps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await refresh();
  };

  const handleArchive = async () => {
    await fetch(`/api/apps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    await refresh();
  };

  const handleRestore = async () => {
    await fetch(`/api/apps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    await refresh();
  };

  if (loading) return <SpeedLoader text="Loading app..." />;

  if (notFound) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", flexDirection: "column", gap: 16,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: "var(--md-background, #1C1B1F)", color: "var(--md-on-background, #E6E1E5)",
      }}>
        <div style={{ fontSize: 48 }}>📦</div>
        <h2 style={{ margin: 0 }}>App not found</h2>
        <p style={{ margin: 0, color: "var(--md-on-surface-variant, #CAC4D0)", fontSize: 14 }}>
          No app with ID <code style={{ fontSize: 12 }}>{id}</code> exists.
        </p>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "8px 24px", borderRadius: 20, border: "none",
            background: "var(--md-primary, #D0BCFF)", color: "var(--md-on-primary, #381E72)",
            cursor: "pointer", fontWeight: 600, fontSize: 14,
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <AppDetailView
      app={app}
      onBack={() => navigate("/")}
      onSave={handleSave}
      onArchive={handleArchive}
      onRestore={handleRestore}
    />
  );
}
