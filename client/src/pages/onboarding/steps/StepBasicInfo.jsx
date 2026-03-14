import { useEffect, useRef } from "react";
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

export default function StepBasicInfo({ state, dispatch }) {
  const nameRef = useRef(null);

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
      // Scratch: clear the prefilled fields (but only if they were auto-filled)
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
      {/* Template gallery */}
      <div className="step-field" style={{ "--field-index": 0 }}>
        <div style={sectionHeaderStyle}>
          <span>Choose a starting point</span>
        </div>
        <TemplateGallery
          selectedTemplate={state.selectedTemplate ?? null}
          onSelect={handleTemplateSelect}
        />
      </div>

      {/* Divider */}
      <div className="step-field" style={{ "--field-index": 1, height: 1, background: "#F3F4F6", margin: "4px 0" }} />

      {/* App name */}
      <div className="step-field" style={{ "--field-index": 2 }}>
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

      <div className="step-field" style={{ "--field-index": 3 }}>
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

      <div className="step-field" style={{ "--field-index": 4 }}>
        <label style={labelStyle}>Description (optional)</label>
        <textarea
          value={state.description}
          onChange={e => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
          placeholder="What does this app do?"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
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

      <div className="step-field" style={{ "--field-index": 5 }}>
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
