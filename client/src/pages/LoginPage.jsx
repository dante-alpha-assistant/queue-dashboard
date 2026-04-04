import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoBox}>d</div>
          <span style={styles.logoText}>
            tasks<span style={styles.accent}>.</span>dante
            <span style={styles.accent}>.</span>id
          </span>
        </div>

        <h1 style={styles.title}>Sign in</h1>
        <p style={styles.subtitle}>Welcome back</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? (
              <span style={styles.buttonInner}>
                <span style={styles.spinner} />
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p style={styles.switchText}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" style={styles.link}>
            Sign up
          </Link>
        </p>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none; border-color: var(--md-primary, #6750A4) !important; box-shadow: 0 0 0 2px rgba(103,80,164,0.2); }
        button[type="submit"]:not(:disabled):hover { opacity: 0.88; }
        button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--md-background, #FAFAFA)",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: "20px",
  },
  card: {
    background: "var(--md-surface, #FFFFFF)",
    borderRadius: 20,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
  },
  logoRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  logoBox: {
    width: 48,
    height: 48,
    background: "linear-gradient(135deg, #6750A4 0%, #9A7FD4 100%)",
    color: "#fff",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 22,
    boxShadow: "0 4px 16px rgba(103,80,164,0.4)",
  },
  logoText: {
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: "-0.02em",
    color: "var(--md-on-surface, #1C1B1F)",
  },
  accent: {
    color: "var(--md-primary, #6750A4)",
    fontWeight: 700,
  },
  title: {
    margin: "0 0 4px",
    fontSize: 24,
    fontWeight: 700,
    color: "var(--md-on-surface, #1C1B1F)",
    letterSpacing: "-0.02em",
    textAlign: "center",
  },
  subtitle: {
    margin: "0 0 28px",
    fontSize: 14,
    color: "var(--md-on-surface-variant, #52525B)",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--md-on-surface-variant, #52525B)",
    letterSpacing: "0.01em",
  },
  input: {
    background: "var(--md-surface-container, #F4F4F5)",
    border: "1.5px solid var(--md-surface-variant, #E4E4E7)",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: "var(--md-on-surface, #1C1B1F)",
    transition: "border-color 150ms",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    background: "rgba(186,26,26,0.12)",
    border: "1px solid rgba(186,26,26,0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#f28b82",
  },
  button: {
    background: "var(--md-primary, #6750A4)",
    color: "var(--md-on-primary, #fff)",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    transition: "opacity 150ms",
    opacity: 1,
  },
  buttonInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  spinner: {
    display: "inline-block",
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  switchText: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 13,
    color: "var(--md-on-surface-variant, #52525B)",
  },
  link: {
    color: "var(--md-primary, #6750A4)",
    textDecoration: "none",
    fontWeight: 600,
  },
};
