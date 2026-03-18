import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute() {
  const { session } = useAuth();

  // Still loading session
  if (session === null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--md-background)",
          color: "var(--md-on-surface-variant)",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 14,
          gap: 10,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: "2px solid var(--md-surface-variant)",
            borderTopColor: "var(--md-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        Loading...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
