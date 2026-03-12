import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, Loader2, AlertCircle } from "lucide-react";

/* ── Constants ─────────────────────────────────────────── */
const STEPS = [
  { key: "basic", label: "Basic Info" },
  { key: "repos", label: "Repositories" },
  { key: "deploy", label: "Deploy Target" },
  { key: "credentials", label: "Credentials" },
  { key: "review", label: "Review" },
];

const EMOJI_PRESETS = [
  "🚀","⚡","🔥","💎","🛠️","🤖","🧩","📦","🌐","🔮",
  "🎯","🦄","🌊","🏆","🧪","🔬","📊","💡","⭐","🌙",
  "🎮","🎨","🔑","🛡️","⚙️","🌈","🦋","🐉","🌺","🍀",
  "💫","🔋","📡","🧠","🎸","🏗️","🌿","🦅","🎯","💻",
];

const ICON_COLORS = [
  "#6750A4", "#0061A4", "#006A60", "#825500", "#C00012",
  "#5C1397", "#006E2C", "#A4522D", "#00658F", "#6B5F00",
];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  }
  return ICON_COLORS[h % ICON_COLORS.length];
}

/* ── Reducer ───────────────────────────────────────────── */
const initialState = {
  step: 0,
  name: "",
  slug: "",
  slugManual: false,
  description: "",
  icon: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_NAME": {
      const s = { ...state, name: action.value };
      if (!s.slugManual) s.slug = slugify(action.value);
      return s;
    }
    case "SET_SLUG":
      return { ...state, slug: action.value, slugManual: true };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "NEXT_STEP":
      return { ...state, step: Math.min(state.step + 1, STEPS.length - 1) };
    case "PREV_STEP":
      return { ...state, step: Math.max(state.step - 1, 0) };
    default:
      return state;
  }
}

/* ── Simple Markdown Preview ───────────────────────────── */
function renderMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, "<strong>$1</strong>")
    .replace(/^# (.+)$/gm, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style='background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;font-family:monospace'>$1</code>")
    .replace(/\n/g, "<br>");
}

/* ── Preview Card ──────────────────────────────────────── */
function LivePreviewCard({ name, slug, description, icon }) {
  const color = hashColor(slug || name || "app");
  const initial = name ? name[0].toUpperCase() : "A";
  const displayIcon = icon || null;

  return (
    <div style={{
      background: "var(--md-surface, #FFFBFE)",
      borderRadius: 16,
      border: "1px solid var(--md-surface-variant, #E7E0EC)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      overflow: "hidden",
      transition: "all 200ms",
    }}>
      <div style={{ padding: "20px 20px 16px" }}>
        {/* Icon + Name row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: displayIcon ? "transparent" : color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: displayIcon ? 26 : 18, fontWeight: 700, color: "#fff",
            flexShrink: 0, border: displayIcon ? "1px solid var(--md-surface-variant)" : "none",
          }}>
            {displayIcon || initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {name || <span style={{ color: "var(--md-on-surface-variant)", fontWeight: 400, fontStyle: "italic" }}>App name</span>}
            </h3>
            {slug && (
              <span style={{
                fontSize: 11, color: "var(--md-on-surface-variant)",
                fontFamily: "'JetBrains Mono', monospace", opacity: 0.75,
              }}>
                /{slug}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {description ? (
          <p style={{
            margin: "0 0 12px", fontSize: 12, color: "var(--md-on-surface-variant)",
            lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{description}</p>
        ) : (
          <p style={{
            margin: "0 0 12px", fontSize: 12, color: "var(--md-on-surface-variant)",
            lineHeight: 1.5, fontStyle: "italic", opacity: 0.5,
          }}>No description yet...</p>
        )}

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 10, borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
        }}>
          <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
            <span style={{ color: "#E8A317", fontWeight: 700 }}>0</span> active / 0 total
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
            background: "rgba(121,116,126,0.12)", color: "#79747E",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>⏭️ None</span>
        </div>
      </div>
    </div>
  );
}

/* ── Emoji Picker ──────────────────────────────────────── */
function EmojiPicker({ onSelect, onClose }) {
  return (
    <div style={{
      position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 100,
      background: "var(--md-surface, #FFFBFE)",
      border: "1px solid var(--md-surface-variant, #E7E0EC)",
      borderRadius: 12, padding: 12, width: 240,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2,
    }}>
      {EMOJI_PRESETS.map(e => (
        <button key={e} onClick={() => { onSelect(e); onClose(); }} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 20, padding: 4, borderRadius: 6, lineHeight: 1,
          transition: "background 100ms",
        }}
          onMouseEnter={ev => ev.currentTarget.style.background = "var(--md-surface-container, #F5F0FB)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}
        >{e}</button>
      ))}
    </div>
  );
}

/* ── Step 1: Basic Info ────────────────────────────────── */
function OnboardingStep1({ state, dispatch }) {
  const nameRef = useRef(null);
  const nameCheckTimer = useRef(null);
  const slugCheckTimer = useRef(null);

  const [nameStatus, setNameStatus] = useState("idle"); // idle | checking | valid | invalid
  const [slugStatus, setSlugStatus] = useState("idle");
  const [nameError, setNameError] = useState("");
  const [slugError, setSlugError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDescPreview, setShowDescPreview] = useState(false);
  const [descHeight, setDescHeight] = useState(80);
  const descRef = useRef(null);

  // Autofocus name on mount
  useEffect(() => { nameRef.current?.focus(); }, []);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e) => {
      if (!e.target.closest("[data-emoji-picker]")) setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  // Check name uniqueness (debounced)
  const checkName = useCallback((value) => {
    clearTimeout(nameCheckTimer.current);
    if (!value.trim()) { setNameStatus("idle"); return; }
    setNameStatus("checking");
    nameCheckTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/apps?name=eq.${encodeURIComponent(value.trim())}`);
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setNameStatus("invalid");
          setNameError("An app with this name already exists");
        } else {
          setNameStatus("valid");
          setNameError("");
        }
      } catch {
        setNameStatus("valid"); // don't block on network error
        setNameError("");
      }
    }, 400);
  }, []);

  // Check slug uniqueness (on blur)
  const checkSlug = useCallback(async (value) => {
    if (!value.trim()) { setSlugStatus("idle"); return; }
    const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!slugRegex.test(value)) {
      setSlugStatus("invalid");
      setSlugError("Only lowercase letters, digits, and hyphens allowed");
      return;
    }
    setSlugStatus("checking");
    clearTimeout(slugCheckTimer.current);
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/apps?slug=eq.${encodeURIComponent(value.trim())}`);
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setSlugStatus("invalid");
          setSlugError("This slug is already taken");
        } else {
          setSlugStatus("valid");
          setSlugError("");
        }
      } catch {
        setSlugStatus("valid");
        setSlugError("");
      }
    }, 200);
  }, []);

  // When name changes, re-check (and slug auto-updates)
  const handleNameChange = (value) => {
    dispatch({ type: "SET_NAME", value });
    checkName(value);
    // If slug is auto-generated, auto-validate the new slug
    if (!state.slugManual) {
      const autoSlug = slugify(value);
      if (autoSlug) checkSlug(autoSlug);
      else setSlugStatus("idle");
    }
  };

  const handleSlugChange = (value) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    dispatch({ type: "SET_SLUG", value: cleaned });
    setSlugStatus("idle");
    setSlugError("");
  };

  // Auto-resize textarea
  const handleDescChange = (value) => {
    dispatch({ type: "SET_FIELD", field: "description", value });
    if (descRef.current) {
      descRef.current.style.height = "auto";
      descRef.current.style.height = Math.max(80, descRef.current.scrollHeight) + "px";
    }
  };

  // Status indicator
  const StatusIcon = ({ status, error }) => {
    if (status === "checking") return <Loader2 size={14} style={{ color: "var(--md-primary)", animation: "spin 1s linear infinite" }} />;
    if (status === "valid") return <Check size={14} style={{ color: "#1B5E20" }} />;
    if (status === "invalid") return <AlertCircle size={14} style={{ color: "#C00012" }} />;
    return null;
  };

  const iconColor = hashColor(state.slug || state.name || "app");
  const displayIcon = state.icon || null;
  const initial = state.name ? state.name[0].toUpperCase() : "A";

  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1px solid var(--md-surface-variant, #E7E0EC)",
    background: "var(--md-surface, #FFFBFE)",
    color: "var(--md-on-surface, #1C1B1F)", fontSize: 14,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    outline: "none", boxSizing: "border-box", transition: "border-color 150ms",
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant, #49454F)",
    marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "start" }}>
      {/* Left: Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Icon / Emoji */}
        <div>
          <label style={labelStyle}>Icon</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }} data-emoji-picker>
              <button
                onClick={() => setShowEmojiPicker(v => !v)}
                title="Click to pick emoji"
                style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: displayIcon ? "var(--md-surface)" : iconColor,
                  border: displayIcon ? "1px solid var(--md-surface-variant)" : "none",
                  cursor: "pointer", fontSize: displayIcon ? 28 : 20,
                  fontWeight: 700, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 150ms",
                }}
              >
                {displayIcon || initial}
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(e) => dispatch({ type: "SET_FIELD", field: "icon", value: e })}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Or type an emoji..."
                value={state.icon}
                onChange={e => dispatch({ type: "SET_FIELD", field: "icon", value: e.target.value })}
                style={{ ...inputStyle, width: "100%" }}
                maxLength={4}
              />
              {state.icon && (
                <button onClick={() => dispatch({ type: "SET_FIELD", field: "icon", value: "" })} style={{
                  fontSize: 11, color: "var(--md-on-surface-variant)", background: "none",
                  border: "none", cursor: "pointer", padding: "2px 0", marginTop: 4,
                }}>
                  ✕ Remove icon (use letter)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* App Name */}
        <div>
          <label style={labelStyle}>App Name <span style={{ color: "#C00012" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <input
              ref={nameRef}
              type="text"
              placeholder="My Awesome App"
              value={state.name}
              onChange={e => handleNameChange(e.target.value)}
              maxLength={50}
              style={{
                ...inputStyle,
                borderColor: nameStatus === "invalid" ? "#C00012" : nameStatus === "valid" ? "#1B5E20" : "var(--md-surface-variant)",
                paddingRight: 40,
              }}
              onFocus={e => { e.target.style.borderColor = "var(--md-primary, #6750A4)"; }}
              onBlur={e => {
                e.target.style.borderColor = nameStatus === "invalid" ? "#C00012" : nameStatus === "valid" ? "#1B5E20" : "var(--md-surface-variant)";
              }}
            />
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
              <StatusIcon status={nameStatus} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {nameError ? (
              <span style={{ fontSize: 12, color: "#C00012" }}>{nameError}</span>
            ) : <span />}
            <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", opacity: 0.7 }}>
              {state.name.length}/50
            </span>
          </div>
        </div>

        {/* Slug */}
        <div>
          <label style={labelStyle}>Slug <span style={{ color: "#C00012" }}>*</span></label>
          <div style={{
            display: "flex", alignItems: "center",
            border: `1px solid ${slugStatus === "invalid" ? "#C00012" : slugStatus === "valid" ? "#1B5E20" : "var(--md-surface-variant, #E7E0EC)"}`,
            borderRadius: 10, overflow: "hidden", background: "var(--md-surface)",
            transition: "border-color 150ms",
          }}
            onFocus={() => {}}
          >
            <span style={{
              padding: "11px 10px 11px 14px",
              color: "var(--md-on-surface-variant)", fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap",
              borderRight: "1px solid var(--md-surface-variant)", background: "var(--md-surface-container, #F5F0FB)",
              flexShrink: 0,
            }}>apps /</span>
            <input
              type="text"
              placeholder="my-awesome-app"
              value={state.slug}
              onChange={e => handleSlugChange(e.target.value)}
              onBlur={() => checkSlug(state.slug)}
              style={{
                flex: 1, padding: "11px 40px 11px 12px", border: "none", outline: "none",
                background: "transparent", color: "var(--md-on-surface)", fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <div style={{ position: "absolute", right: 12 }}>
              <StatusIcon status={slugStatus} />
            </div>
          </div>
          {slugError && (
            <span style={{ fontSize: 12, color: "#C00012", marginTop: 4, display: "block" }}>{slugError}</span>
          )}
          {!state.slugManual && state.name && (
            <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 4, display: "block", opacity: 0.7 }}>
              Auto-generated from name. Click to edit manually.
            </span>
          )}
        </div>

        {/* Description */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Description</label>
            <button
              onClick={() => setShowDescPreview(v => !v)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px",
                borderRadius: 20, border: "1px solid var(--md-surface-variant)",
                background: showDescPreview ? "var(--md-primary)" : "transparent",
                color: showDescPreview ? "#fff" : "var(--md-on-surface-variant)",
                cursor: "pointer", transition: "all 150ms",
              }}
            >
              {showDescPreview ? "✏️ Edit" : "👁 Preview"}
            </button>
          </div>
          {showDescPreview ? (
            <div style={{
              ...inputStyle, minHeight: 80, padding: "11px 14px",
              lineHeight: 1.6, fontSize: 13,
              dangerouslySetInnerHTML: undefined,
            }}>
              {state.description ? (
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(state.description) }} />
              ) : (
                <span style={{ color: "var(--md-on-surface-variant)", fontStyle: "italic", opacity: 0.6 }}>
                  Nothing to preview yet...
                </span>
              )}
            </div>
          ) : (
            <textarea
              ref={descRef}
              placeholder="Describe what this app does..."
              value={state.description}
              onChange={e => handleDescChange(e.target.value)}
              maxLength={500}
              style={{
                ...inputStyle, minHeight: 80, resize: "none",
                lineHeight: 1.6, fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onFocus={e => { e.target.style.borderColor = "var(--md-primary, #6750A4)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--md-surface-variant)"; }}
            />
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: state.description.length > 450 ? "#C00012" : "var(--md-on-surface-variant)", opacity: 0.7 }}>
              {state.description.length}/500
            </span>
          </div>
        </div>
      </div>

      {/* Right: Live Preview */}
      <div style={{ position: "sticky", top: 24 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)",
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--md-primary)", display: "inline-block" }} />
          Preview — how it looks on the Apps page
        </div>
        <LivePreviewCard
          name={state.name}
          slug={state.slug}
          description={state.description}
          icon={state.icon}
        />
      </div>
    </div>
  );
}

/* ── Placeholder Steps ─────────────────────────────────── */
function PlaceholderStep({ label }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 300, gap: 16, color: "var(--md-on-surface-variant)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: "var(--md-surface-container, #F5F0FB)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28,
      }}>🚧</div>
      <div style={{ textAlign: "center" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--md-on-surface)" }}>{label}</h3>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>This step will be implemented next</p>
      </div>
    </div>
  );
}

/* ── Step Indicator ────────────────────────────────────── */
function StepIndicator({ currentStep, totalSteps, steps }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
      {steps.map((s, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const color = done || active ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant, #E7E0EC)";
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              minWidth: 0,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done ? "var(--md-primary)" : active ? "var(--md-primary)" : "transparent",
                border: `2px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "var(--md-on-surface-variant)",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                transition: "all 250ms",
              }}>
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? "var(--md-primary)" : done ? "var(--md-on-surface)" : "var(--md-on-surface-variant)",
                whiteSpace: "nowrap", transition: "all 250ms",
              }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 14, marginLeft: 4, marginRight: 4,
                background: done ? "var(--md-primary)" : "var(--md-surface-variant)",
                transition: "background 250ms",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Wizard ───────────────────────────────────────── */
export default function AppOnboardingWizard({ onClose, onCreated }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Push /apps/new to history when wizard opens
  useEffect(() => {
    const prev = window.location.pathname;
    window.history.pushState({}, "", "/apps/new");
    return () => {
      window.history.pushState({}, "", prev === "/apps/new" ? "/" : prev);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state]);

  const handleClose = () => {
    const hasChanges = state.name || state.description || state.icon;
    if (hasChanges && !confirm("You have unsaved changes. Close anyway?")) return;
    onClose();
  };

  // Step validation
  const isStep1Valid = () => {
    return state.name.trim().length > 0 && state.slug.trim().length > 0;
  };

  const canNext = () => {
    switch (state.step) {
      case 0: return isStep1Valid();
      default: return true;
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 0: return <OnboardingStep1 state={state} dispatch={dispatch} />;
      case 1: return <PlaceholderStep label="Repositories" />;
      case 2: return <PlaceholderStep label="Deploy Target" />;
      case 3: return <PlaceholderStep label="Credentials" />;
      case 4: return <PlaceholderStep label="Review & Create" />;
      default: return null;
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "var(--md-background, #FFFBFE)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      {/* Spin animation for loader */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
        background: "var(--md-surface, #FFFBFE)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {state.step > 0 && (
            <button onClick={() => dispatch({ type: "PREV_STEP" })} style={{
              background: "none", border: "1px solid var(--md-surface-variant)",
              borderRadius: 8, cursor: "pointer", padding: "6px 10px",
              color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center",
              transition: "all 150ms",
            }}>
              <ChevronLeft size={16} />
            </button>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>
              Create New App
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "var(--md-on-surface-variant)", opacity: 0.8 }}>
              Step {state.step + 1} of {STEPS.length} — {STEPS[state.step].label}
            </p>
          </div>
        </div>

        <button onClick={handleClose} style={{
          background: "none", border: "1px solid var(--md-surface-variant)",
          borderRadius: 8, cursor: "pointer", padding: "6px 10px",
          color: "var(--md-on-surface-variant)", display: "flex", alignItems: "center",
          transition: "all 150ms",
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Progress Indicator */}
      <div style={{
        padding: "20px 32px 0",
        background: "var(--md-surface, #FFFBFE)",
        borderBottom: "1px solid var(--md-surface-variant, #E7E0EC)",
        paddingBottom: 16, flexShrink: 0,
      }}>
        <StepIndicator currentStep={state.step} totalSteps={STEPS.length} steps={STEPS} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {renderStep()}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "16px 32px", borderTop: "1px solid var(--md-surface-variant, #E7E0EC)",
        background: "var(--md-surface, #FFFBFE)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button onClick={handleClose} style={{
          padding: "10px 20px", borderRadius: 100,
          border: "1px solid var(--md-surface-variant)",
          background: "transparent", color: "var(--md-on-surface-variant)",
          cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "'Inter', system-ui",
        }}>
          Cancel
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!canNext() && state.step === 0 && (
            <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", opacity: 0.7 }}>
              Enter a unique name and slug to continue
            </span>
          )}
          <button
            onClick={() => {
              if (state.step < STEPS.length - 1) dispatch({ type: "NEXT_STEP" });
              else {
                // Final step — submit (stub for now, other steps pending)
                onCreated && onCreated();
              }
            }}
            disabled={!canNext()}
            title={!canNext() ? "Enter a unique name and slug to continue" : ""}
            style={{
              padding: "10px 28px", borderRadius: 100, border: "none",
              background: canNext() ? "var(--md-primary, #6750A4)" : "var(--md-surface-variant)",
              color: canNext() ? "#fff" : "var(--md-on-surface-variant)",
              cursor: canNext() ? "pointer" : "not-allowed", fontSize: 14,
              fontWeight: 600, fontFamily: "'Inter', system-ui",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 200ms",
            }}
          >
            {state.step < STEPS.length - 1 ? (
              <>Next <ChevronRight size={16} /></>
            ) : (
              "Create App"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
