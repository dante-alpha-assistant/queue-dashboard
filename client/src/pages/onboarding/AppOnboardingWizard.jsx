import { useReducer, useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Loader2, Sparkles } from "lucide-react";
import OnboardingStepIndicator from "./OnboardingStepIndicator";
import { computeProposedArchitecture } from "./repoArchitecture";
import "./onboarding.css";

/* ── Lazy-loaded steps ─────────────────────────────────── */
const StepBasicInfo = lazy(() => import("./steps/StepBasicInfo"));
const StepConnectRepos = lazy(() => import("./steps/StepConnectRepos"));
const StepDeployTargets = lazy(() => import("./steps/StepDeployTargets"));
const StepCredentials = lazy(() => import("./steps/StepCredentials"));
const StepReview = lazy(() => import("./steps/StepReview"));

const STEP_COMPONENTS = [StepBasicInfo, StepConnectRepos, StepDeployTargets, StepCredentials, StepReview];
const STEP_COUNT = 5;

/* ── Helpers ───────────────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const DEFAULT_REQ_CREDS = ["GH_TOKEN"];
const DEFAULT_QA_CREDS = ["GH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"];

/* ── Reducer ───────────────────────────────────────────── */
const initialState = {
  step: 0,
  name: "",
  slug: "",
  slugManual: false,
  description: "",
  icon: "",
  // Repo picker
  repoSource: "scratch",       // "scratch" | "github"
  repos: [],
  repoSearch: "",
  repoResults: [],
  repoLoading: false,
  // GitHub OAuth (Connect with your GitHub)
  githubToken: null,
  githubUser: null,
  userRepoSearch: "",
  userRepoResults: [],
  userRepoLoading: false,
  aiSuggestions: null,      // null | [{name, deploy_target, namespace, service_name, reasoning}]
  deployTarget: "kubernetes",
  k8sNamespace: "apps",
  k8sService: "",
  vercelProject: "",
  reqCredentials: [...DEFAULT_REQ_CREDS],
  qaCredentials: [...DEFAULT_QA_CREDS],
  customCredential: "",
  customQaCredential: "",
  supabaseRef: "",
  submitting: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_NAME": {
      const s = { ...state, name: action.value };
      if (!s.slugManual) s.slug = slugify(action.value);
      return s;
    }
    case "SET_REPO_SOURCE": {
      // Clear selected repos when switching modes
      return {
        ...state,
        repoSource: action.value,
        repos: [],
        repoSearch: "",
        userRepoSearch: "",
        userRepoResults: [],
      };
    }
    case "TOGGLE_REPO": {
      const idx = state.repos.findIndex(r => r.full_name === action.repo.full_name);
      const repos = idx >= 0
        ? state.repos.filter((_, i) => i !== idx)
        : [...state.repos, action.repo];
      const s = { ...state, repos };
      if (repos.length > 0 && !state.k8sService) s.k8sService = repos[0].name;
      if (repos.length > 0 && !state.vercelProject) s.vercelProject = repos[0].name;
      return s;
    }
    case "TOGGLE_CRED": {
      const field = action.field;
      const creds = state[field];
      const idx = creds.indexOf(action.key);
      return { ...state, [field]: idx >= 0 ? creds.filter(c => c !== action.key) : [...creds, action.key] };
    }
    case "ADD_CUSTOM_CRED": {
      const field = action.field;
      const val = action.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
      if (!val || state[field].includes(val)) return state;
      return { ...state, [field]: [...state[field], val], [action.inputField]: "" };
    }
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

/* ── Validation hints per step ─────────────────────────── */
function getStepHint(state) {
  switch (state.step) {
    case 0:
      if (!state.name.trim()) return "Enter an app name to continue";
      if (!state.slug.trim()) return "Slug is required";
      return null;
    case 1:
      if (state.repoSource !== "scratch" && state.repos.length === 0) return "Select at least one repository";
      return null;
    default:
      return null;
  }
}

function canProceed(state) {
  return !getStepHint(state);
}

/* ── Component ─────────────────────────────────────────── */
export default function AppOnboardingWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [slideDir, setSlideDir] = useState("none"); // "left", "right", "none"
  const [animating, setAnimating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdApp, setCreatedApp] = useState(null);
  const contentRef = useRef(null);
  const hasChanges = state.name || state.repos.length > 0 || state.description;

  // Sync step from URL
  useEffect(() => {
    const urlStep = parseInt(searchParams.get("step"), 10);
    if (!isNaN(urlStep) && urlStep >= 1 && urlStep <= STEP_COUNT && urlStep - 1 !== state.step) {
      dispatch({ type: "SET_STEP", step: urlStep - 1 });
    }
  }, []); // Only on mount

  // Update URL when step changes
  useEffect(() => {
    const currentUrlStep = parseInt(searchParams.get("step"), 10);
    if (currentUrlStep !== state.step + 1) {
      setSearchParams({ step: state.step + 1 }, { replace: true });
    }
  }, [state.step]);

  // Browser back/forward
  useEffect(() => {
    const handler = () => {
      const urlStep = parseInt(new URLSearchParams(window.location.search).get("step"), 10);
      if (!isNaN(urlStep) && urlStep >= 1 && urlStep <= STEP_COUNT) {
        const targetStep = urlStep - 1;
        if (targetStep !== state.step) {
          setSlideDir(targetStep > state.step ? "left" : "right");
          setAnimating(true);
          setTimeout(() => {
            dispatch({ type: "SET_STEP", step: targetStep });
            setTimeout(() => setAnimating(false), 50);
          }, 150);
        }
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [state.step]);

  // Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChanges]);

  const handleClose = useCallback(() => {
    if (hasChanges && !confirm("Discard changes? Your progress will be lost.")) return;
    navigate("/");
  }, [hasChanges, navigate]);

  const goToStep = useCallback((targetStep) => {
    if (animating) return;
    const dir = targetStep > state.step ? "left" : "right";
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => {
      dispatch({ type: "SET_STEP", step: targetStep });
      setTimeout(() => setAnimating(false), 50);
    }, 150);
  }, [state.step, animating]);

  const handleNext = useCallback(() => {
    if (state.step < STEP_COUNT - 1 && canProceed(state)) {
      goToStep(state.step + 1);
    }
  }, [state, goToStep]);

  const handleBack = useCallback(() => {
    if (state.step > 0) goToStep(state.step - 1);
  }, [state.step, goToStep]);

  const handleSubmit = async () => {
    dispatch({ type: "SET_FIELD", field: "submitting", value: true });
    dispatch({ type: "SET_FIELD", field: "error", value: null });

    try {
      const deployConfig = {};
      if (state.deployTarget === "kubernetes") {
        deployConfig.namespace = state.k8sNamespace;
        deployConfig.service = state.k8sService || state.repos[0]?.name || "";
      } else if (state.deployTarget === "vercel") {
        deployConfig.project = state.vercelProject || state.repos[0]?.name || "";
      }

      // For scratch mode, compute the proposed architecture from the app description
      let reposForBody;
      let repoArchitecture = null;
      let primaryDeployTarget = state.deployTarget;

      if (state.aiSuggestions && state.aiSuggestions.length > 0) {
        // Use AI-suggested per-repo deploy config
        repoArchitecture = state.repoSource === "scratch"
          ? computeProposedArchitecture(state.name, state.description)
          : null;

        reposForBody = state.aiSuggestions.map(suggestion => {
          const repoDeplCfg = {};
          if (suggestion.deploy_target === "kubernetes") {
            repoDeplCfg.namespace = suggestion.namespace || "apps";
            repoDeplCfg.service = suggestion.service_name;
          } else if (suggestion.deploy_target === "vercel") {
            repoDeplCfg.project = suggestion.service_name;
          }
          // Resolve full repo name
          let repoName;
          if (state.repoSource === "scratch") {
            repoName = `dante-alpha-assistant/${suggestion.name}`;
          } else {
            const matched = state.repos.find(r => r.name === suggestion.name);
            repoName = matched?.full_name || `dante-alpha-assistant/${suggestion.name}`;
          }
          return {
            repo: repoName,
            deploy_target: suggestion.deploy_target || "none",
            deploy_config: repoDeplCfg,
          };
        });
        primaryDeployTarget = state.aiSuggestions[0]?.deploy_target || state.deployTarget;
      } else if (state.repoSource === "scratch") {
        const proposed = computeProposedArchitecture(state.name, state.description);
        repoArchitecture = proposed;
        reposForBody = proposed.map(r => `dante-alpha-assistant/${r.name}`);
      } else {
        reposForBody = state.repos.map(r => r.full_name);
      }

      const body = {
        name: state.name.trim(),
        slug: state.slug.trim(),
        description: state.description.trim() || null,
        icon: state.icon || null,
        repos: reposForBody,
        repo_source: state.repoSource || "scratch",
        repo_architecture: repoArchitecture,
        deploy_target: primaryDeployTarget,
        deploy_config: deployConfig,
        env_keys: state.reqCredentials,
        qa_env_keys: state.qaCredentials,
        supabase_project_ref: state.supabaseRef.trim() || null,
      };

      const resp = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${resp.status})`);
      }

      const created = await resp.json();
      setCreatedApp(created);
      setSuccess(true);

      // Redirect after success animation
      setTimeout(() => {
        navigate("/");
      }, 2500);
    } catch (e) {
      dispatch({ type: "SET_FIELD", field: "error", value: e.message });
    } finally {
      dispatch({ type: "SET_FIELD", field: "submitting", value: false });
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key !== "Enter") return;
    // Don't intercept Enter inside textareas (they need newlines)
    if (e.target.tagName === "TEXTAREA") return;
    // Don't intercept if a button was the target (avoid double-trigger)
    if (e.target.tagName === "BUTTON") return;
    if (animating) return;

    if (state.step === STEP_COUNT - 1) {
      // Final step → trigger Create (only if not already submitting)
      if (!state.submitting) {
        e.preventDefault();
        handleSubmit();
      }
    } else {
      // Any other step → advance if valid
      if (canProceed(state)) {
        e.preventDefault();
        handleNext();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, animating, handleNext]);

  // Success screen
  if (success) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#FFFFFF",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>
        <div className="success-scale-up" style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          textAlign: "center",
        }}>
          {/* Success checkmark */}
          <div className="success-checkmark" style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "#7C3AED",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(124,58,237,0.4)",
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" className="checkmark-draw" />
            </svg>
          </div>

          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800, color: "#0F172A" }}>
              App Created! 🎉
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: "#64748B" }}>
              <strong style={{ color: "#0F172A" }}>{createdApp?.name}</strong> is ready to go
            </p>
          </div>

          <div style={{
            fontSize: 13, color: "#64748B", opacity: 0.8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
            Redirecting to dashboard...
          </div>
        </div>

        {/* Confetti particles */}
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="confetti-piece" style={{
              "--x": `${Math.random() * 100}vw`,
              "--delay": `${Math.random() * 0.5}s`,
              "--duration": `${1.5 + Math.random() * 2}s`,
              "--color": ["#6750A4", "#E8A317", "#1B5E20", "#00897B", "#D84315", "#7B5EA7"][Math.floor(Math.random() * 6)],
              "--rotation": `${Math.random() * 360}deg`,
              "--size": `${6 + Math.random() * 8}px`,
            }} />
          ))}
        </div>
      </div>
    );
  }

  const hint = getStepHint(state);
  const StepComponent = STEP_COMPONENTS[state.step];

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onKeyDown={handleKeyDown}
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        background: "#F8FAFC",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: "1px solid #E2E8F0",
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, background: "#7C3AED", color: "#fff",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 16,
          }}>d</div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em", color: "#0F172A" }}>
            Create New App
          </span>
        </div>
        <button onClick={handleClose} title="Close (Esc)" style={{
          width: 36, height: 36, borderRadius: 10,
          border: "1px solid #E2E8F0",
          background: "#F1F5F9", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#64748B", transition: "all 150ms",
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Step indicator */}
      <OnboardingStepIndicator currentStep={state.step} />

      {/* Step content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", padding: "40px 20px 120px",
      }}>
        <div ref={contentRef} style={{
          width: "100%", maxWidth: 720,
          transform: animating
            ? slideDir === "left" ? "translateX(-30px)" : "translateX(30px)"
            : "translateX(0)",
          opacity: animating ? 0 : 1,
          transition: "transform 300ms ease-out, opacity 300ms ease-out",
        }}>
          {/* Step title */}
          <h2 style={{
            margin: "0 0 24px", fontSize: 22, fontWeight: 700,
            color: "#0F172A", textAlign: "center",
          }}>
            {["Name & Description", "Connect Repositories", "Deploy Targets", "Credentials", "Review & Create"][state.step]}
          </h2>

          <Suspense fallback={
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite", color: "#7C3AED" }} />
            </div>
          }>
            <StepComponent state={state} dispatch={dispatch} />
          </Suspense>

          {state.error && (
            <div style={{
              marginTop: 20, padding: "12px 16px", borderRadius: 12,
              background: "rgba(179, 38, 30, 0.1)", color: "#B3261E",
              fontSize: 13, fontWeight: 500, border: "1px solid rgba(179,38,30,0.15)",
            }}>{state.error}</div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "16px 24px", borderTop: "1px solid #E2E8F0",
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        zIndex: 10,
      }}>
        <button
          onClick={handleBack}
          disabled={state.step === 0}
          style={{
            padding: "12px 24px", borderRadius: 100,
            border: "1px solid #E2E8F0",
            background: "transparent",
            color: state.step === 0 ? "#CBD5E1" : "#0F172A",
            cursor: state.step === 0 ? "not-allowed" : "pointer",
            fontSize: 14, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            display: "flex", alignItems: "center", gap: 8,
            opacity: state.step === 0 ? 0.4 : 1,
            transition: "all 150ms",
          }}
        >
          <ChevronLeft size={18} /> Back
        </button>

        {/* Progress text */}
        <span style={{
          fontSize: 13, fontWeight: 600, color: "#94A3B8",
        }}>
          Step {state.step + 1} of {STEP_COUNT}
        </span>

        {state.step < STEP_COUNT - 1 ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={handleNext}
              disabled={!canProceed(state)}
              title={hint || ""}
              style={{
                padding: "12px 28px", borderRadius: 100, border: "none",
                background: canProceed(state) ? "#7C3AED" : "#F1F5F9",
                color: canProceed(state) ? "#fff" : "#CBD5E1",
                cursor: canProceed(state) ? "pointer" : "not-allowed",
                fontSize: 14, fontWeight: 600, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: canProceed(state) ? "0 2px 12px rgba(103,80,164,0.3)" : "none",
                transition: "all 200ms",
              }}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={state.submitting}
            style={{
              padding: "12px 28px", borderRadius: 100, border: "none",
              background: state.submitting ? "var(--md-outline)" : "linear-gradient(135deg, #6750A4, #7C5CBF)",
              color: "#fff", cursor: state.submitting ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 700, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: state.submitting ? "none" : "0 4px 16px rgba(103,80,164,0.35)",
              transition: "all 200ms",
            }}
          >
            {state.submitting ? (
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
            ) : (
              <Sparkles size={16} />
            )}
            Create App
          </button>
        )}
      </div>
    </div>
  );
}
