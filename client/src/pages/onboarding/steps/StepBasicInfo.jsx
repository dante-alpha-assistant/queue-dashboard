import { useEffect, useRef } from "react";
import { Sparkles, Link2, Check } from "lucide-react";
import TemplateGallery, { TEMPLATES } from "./TemplateGallery";

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: 12,
  border: "1px solid var(--md-surface-variant, #E7E0EC)",
  background: "var(--md-surface, #FFFBFE)",
  color: "var(--md-on-surface, #1C1B1F)", fontSize: 14,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 200ms, box-shadow 200ms",
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant, #49454F)",
  marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
};

const sectionHeaderStyle = {
  fontSize: 13, fontWeight: 700, color: "#374151",
  marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
};

function StartingPointCard({ id, icon, title, subtitle, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "20px 18px", borderRadius: 16, cursor: "pointer", textAlign: "left",
        border: `2px solid ${active ? "#7C3AED" : "#E2E8F0"}`,
        background: active ? "rgba(124,58,237,0.06)" : "#FFFFFF",
        boxShadow: active ? "0 2px 12px rgba(124,58,237,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
        transition: "all 200ms",
        display: "flex", flexDirection: "column", gap: 8,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: active ? "#7C3AED" : "#F1F5F9",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: active ? "#fff" : "#6B7280",
          transition: "all 200ms",
        }}>
          {icon}
        </div>
        {active && (
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "#7C3AED",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Check size={13} color="#fff" strokeWidth={3} />
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{subtitle}</div>
      </div>
    </button>
  );
}

export default function StepBasicInfo({ state, dispatch }) {
  const nameRef = useRef(null);
  const isExisting = state.startingMode === "existing";

  useEffect(() => {
    // Focus name input with a small delay to allow animation — only on scratch
    if (!state.selectedTemplate) {
      const timer = setTimeout(() => nameRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [state.selectedTemplate]);

  function handleTemplateSelect(templateId) {
    dispatch({ type: "SET_FIELD", field: "selectedTemplate", value: templateId });
    if (templateId === null) {
      dispatch({ type: "SET_NAME", value: "" });
      dispatch({ type: "SET_FIELD", field: "description", value: "" });
      dispatch({ type: "SET_FIELD", field: "icon", value: "" });
    } else {
      const tpl = TEMPLATES.find(t => t.id === templateId);
      if (tpl) {
        dispatch({ type: "SET_NAME", value: tpl.defaultName });
        dispatch({ type: "SET_FIELD", field: "description", value: tpl.defaultDescription });
        dispatch({ type: "SET_FIELD", field: "icon", value: tpl.emoji });
      }
    }
  }

  return (
    <div className="step-fields-stagger">
      {/* Starting point selector */}
      <div className="step-field" style={{ "--field-index": 0 }}>
        <div style={sectionHeaderStyle}>
          <span>Choose a starting point</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <StartingPointCard
            id="scratch"
            icon={<Sparkles size={20} />}
            title="Start from scratch"
            subtitle="Describe your app — AI builds, scaffolds, and deploys it automatically"
            active={!isExisting}
            onClick={() => dispatch({ type: "SET_STARTING_MODE", value: "scratch" })}
          />
          <StartingPointCard
            id="existing"
            icon={<Link2 size={20} />}
            title="Connect existing app"
            subtitle="Link an already-deployed app — no scaffolding or AI codegen"
            active={isExisting}
            onClick={() => dispatch({ type: "SET_STARTING_MODE", value: "existing" })}
          />
        </div>
      </div>

      {/* Template gallery — scratch only */}
      {!isExisting && (
        <div className="step-field" style={{ "--field-index": 1 }}>
          <TemplateGallery
            selectedTemplate={state.selectedTemplate ?? null}
            onSelect={handleTemplateSelect}
          />
        </div>
      )}

      {/* Divider */}
      <div className="step-field" style={{ "--field-index": 2, height: 1, background: "#F3F4F6", margin: "4px 0" }} />

      {/* App name */}
      <div className="step-field" style={{ "--field-index": 3 }}>
        <label style={labelStyle}>App Name *</label>
        <input
          ref={nameRef}
          value={state.name}
          onChange={e => dispatch({ type: "SET_NAME", value: e.target.value })}
          placeholder="My Awesome App"
          style={inputStyle}
          onFocus={e => {
            e.target.style.borderColor = "var(--md-primary, #6750A4)";
            e.target.style.boxShadow = "0 0 0 3px rgba(103,80,164,0.12)";
          }}
          onBlur={e => {
            e.target.style.borderColor = "var(--md-surface-variant, #E7E0EC)";
            e.target.style.boxShadow = "none";
          }}
        />
      </div>

      <div className="step-field" style={{ "--field-index": 4 }}>
        <label style={labelStyle}>Slug</label>
        <input
          value={state.slug}
          onChange={e => dispatch({ type: "SET_FIELD", field: "slug", value: e.target.value })}
          onFocus={e => {
            dispatch({ type: "SET_FIELD", field: "slugManual", value: true });
            e.target.style.borderColor = "var(--md-primary, #6750A4)";
            e.target.style.boxShadow = "0 0 0 3px rgba(103,80,164,0.12)";
          }}
          onBlur={e => {
            e.target.style.borderColor = "var(--md-surface-variant, #E7E0EC)";
            e.target.style.boxShadow = "none";
          }}
          placeholder="my-awesome-app"
          style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
        />
        <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginTop: 4, display: "block" }}>
          Auto-generated from name with a unique suffix to prevent collisions. Edit to customize.
        </span>
      </div>

      {/* Description — required for scratch, hidden for existing */}
      {!isExisting ? (
        <div className="step-field" style={{ "--field-index": 5 }}>
          <label style={labelStyle}>Description *</label>
          {(() => {
            const descLen = (state.description || "").trim().length;
            const isTooShort = descLen > 0 && descLen < 50;
            const isValid = descLen >= 50;
            const borderColor = isTooShort
              ? "#F57C00"
              : isValid
              ? "var(--md-primary, #6750A4)"
              : "var(--md-surface-variant, #E7E0EC)";
            const boxShadow = isTooShort
              ? "0 0 0 3px rgba(245,124,0,0.12)"
              : isValid
              ? "0 0 0 3px rgba(103,80,164,0.12)"
              : "none";
            return (
              <>
                <textarea
                  value={state.description}
                  onChange={e => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
                  placeholder="What does this app do? Describe the features, purpose, and target users. More detail = better AI-generated code."
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: 90,
                    borderColor,
                    boxShadow,
                  }}
                  onFocus={e => {
                    if (!isTooShort) {
                      e.target.style.borderColor = "var(--md-primary, #6750A4)";
                      e.target.style.boxShadow = "0 0 0 3px rgba(103,80,164,0.12)";
                    }
                  }}
                  onBlur={e => {
                    if (!isTooShort && !isValid) {
                      e.target.style.borderColor = "var(--md-surface-variant, #E7E0EC)";
                      e.target.style.boxShadow = "none";
                    }
                  }}
                />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
                  {isTooShort ? (
                    <span style={{ fontSize: 11, color: "#F57C00" }}>
                      Add more detail so the AI can generate better code (minimum 50 characters)
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                      The more detail you provide, the better the AI-generated code will be.
                    </span>
                  )}
                  <span style={{
                    fontSize: 11,
                    color: isTooShort ? "#F57C00" : isValid ? "#1B5E20" : "var(--md-on-surface-variant)",
                    flexShrink: 0,
                    fontWeight: isTooShort ? 600 : 400,
                  }}>
                    {descLen} / 50 characters minimum
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        /* Optional description for existing apps */
        <div className="step-field" style={{ "--field-index": 5 }}>
          <label style={{ ...labelStyle, opacity: 0.6 }}>Description <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
          <textarea
            value={state.description}
            onChange={e => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
            placeholder="Short description of this app (optional)"
            rows={2}
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: 60,
              opacity: 0.7,
            }}
            onFocus={e => {
              e.target.style.opacity = "1";
              e.target.style.borderColor = "var(--md-primary, #6750A4)";
              e.target.style.boxShadow = "0 0 0 3px rgba(103,80,164,0.12)";
            }}
            onBlur={e => {
              e.target.style.opacity = "0.7";
              e.target.style.borderColor = "var(--md-surface-variant, #E7E0EC)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>
      )}

      <div className="step-field" style={{ "--field-index": 6 }}>
        <label style={labelStyle}>Icon / Emoji (optional)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--md-surface-container, #F5F0FB)", fontSize: 28,
            border: "2px solid var(--md-surface-variant, #E7E0EC)",
            transition: "all 200ms",
          }}>
            {state.icon || (state.name ? state.name[0].toUpperCase() : "📦")}
          </div>
          <input
            value={state.icon}
            onChange={e => dispatch({ type: "SET_FIELD", field: "icon", value: e.target.value })}
            placeholder="🚀 or a letter"
            style={{ ...inputStyle, flex: 1 }}
            maxLength={2}
          />
        </div>
      </div>
    </div>
  );
}
