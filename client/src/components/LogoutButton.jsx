import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <button
      onClick={handleLogout}
      title="Sign out"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        background: "none",
        border: "1px solid var(--md-surface-variant, #49454F)",
        borderRadius: 8,
        color: "var(--md-on-surface-variant, #CAC4D0)",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        transition: "all 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(186,26,26,0.12)";
        e.currentTarget.style.borderColor = "rgba(186,26,26,0.4)";
        e.currentTarget.style.color = "#f28b82";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "none";
        e.currentTarget.style.borderColor = "var(--md-surface-variant, #49454F)";
        e.currentTarget.style.color = "var(--md-on-surface-variant, #CAC4D0)";
      }}
    >
      <LogOut size={14} strokeWidth={1.8} />
      Sign out
    </button>
  );
}
