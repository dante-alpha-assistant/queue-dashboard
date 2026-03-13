import { Check } from "lucide-react";

const STEPS = [
  { key: "basic", label: "Name & Description" },
  { key: "repos", label: "Connect Repos" },
  { key: "deploy", label: "Deploy Targets" },
  { key: "credentials", label: "Credentials" },
  { key: "review", label: "Review & Create" },
];

export default function OnboardingStepIndicator({ currentStep }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 0, padding: "24px 20px 20px", width: "100%", maxWidth: 600, margin: "0 auto",
    }}>
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <div key={step.key} style={{
            display: "flex", alignItems: "center",
            flex: i < STEPS.length - 1 ? 1 : "none",
          }}>
            {/* Dot + label */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              position: "relative", zIndex: 1,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: isDone
                  ? "#7C3AED"
                  : isActive
                    ? "#7C3AED"
                    : "#1E293B",
                color: isDone || isActive ? "#fff" : "#475569",
                border: isActive ? "3px solid rgba(124,58,237,0.35)" : "none",
                transition: "all 300ms ease-out",
                animation: isActive ? "pulse-dot 2s ease-in-out infinite" : "none",
              }}>
                {isDone ? <Check size={16} strokeWidth={3} /> : i + 1}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#A78BFA" : isDone ? "#94A3B8" : "#475569",
                whiteSpace: "nowrap", transition: "all 300ms",
                position: "absolute", top: 40, textAlign: "center",
              }}>
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 3, borderRadius: 2, margin: "0 8px",
                background: "#1E293B",
                position: "relative", overflow: "hidden",
                marginTop: -14,
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, height: "100%",
                  borderRadius: 2,
                  background: "var(--md-primary, #6750A4)",
                  width: isDone ? "100%" : isActive ? "50%" : "0%",
                  transition: "width 400ms ease-out",
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
