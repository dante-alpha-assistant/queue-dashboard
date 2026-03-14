import { useState } from "react";
import { Code2, Check } from "lucide-react";

export const TEMPLATES = [
  {
    id: "personal-crm",
    name: "Personal CRM",
    description: "Contacts, deals, activity timeline & email integration",
    emoji: "🤝",
    tags: ["CRM", "Contacts", "Deals"],
    githubTemplate: "dante-alpha-assistant/crm-template",
    defaultName: "My CRM",
    defaultDescription: "Track contacts, deals, and communication history",
  },
  {
    id: "project-dashboard",
    name: "Project Dashboard",
    description: "Tasks, milestones, team view & burndown chart",
    emoji: "📊",
    tags: ["Tasks", "Milestones", "Teams"],
    githubTemplate: "dante-alpha-assistant/project-dashboard-template",
    defaultName: "My Project Dashboard",
    defaultDescription: "Manage tasks, milestones, and team progress",
  },
  {
    id: "content-calendar",
    name: "Content Calendar",
    description: "Posts, scheduling, platform connections & analytics",
    emoji: "📅",
    tags: ["Content", "Scheduling", "Analytics"],
    githubTemplate: "dante-alpha-assistant/content-calendar-template",
    defaultName: "My Content Calendar",
    defaultDescription: "Plan, schedule, and track content across platforms",
  },
  {
    id: "invoice-manager",
    name: "Invoice Manager",
    description: "Clients, invoices, payments & PDF generation",
    emoji: "🧾",
    tags: ["Invoices", "Clients", "Payments"],
    githubTemplate: "dante-alpha-assistant/invoice-manager-template",
    defaultName: "My Invoice Manager",
    defaultDescription: "Manage clients, invoices, and payment tracking",
  },
  {
    id: "habit-tracker",
    name: "Habit Tracker",
    description: "Habits, streaks, daily check-in & charts",
    emoji: "✅",
    tags: ["Habits", "Streaks", "Wellness"],
    githubTemplate: "dante-alpha-assistant/habit-tracker-template",
    defaultName: "My Habit Tracker",
    defaultDescription: "Track daily habits, streaks, and progress",
  },
];

const TAG_STYLE = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 20,
  background: "#EDE9FE",
  color: "#5B21B6",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.02em",
};

const CARD_BASE = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "16px 18px",
  borderRadius: 14,
  cursor: "pointer",
  transition: "border-color 180ms, box-shadow 180ms, background 180ms",
  textAlign: "left",
  background: "#FFFFFF",
  outline: "none",
  width: "100%",
};

function TemplateCard({ template, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);

  const borderColor = selected
    ? "#7C3AED"
    : hovered
    ? "#C4B5FD"
    : "#E5E7EB";

  const boxShadow = selected
    ? "0 0 0 3px rgba(124,58,237,0.15)"
    : hovered
    ? "0 2px 8px rgba(124,58,237,0.08)"
    : "none";

  return (
    <button
      type="button"
      style={{
        ...CARD_BASE,
        border: `2px solid ${borderColor}`,
        boxShadow,
        background: selected ? "#FAF5FF" : hovered ? "#FAFAFA" : "#FFFFFF",
      }}
      onClick={() => onSelect(template.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {selected && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 20, height: 20, borderRadius: "50%",
          background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={12} color="#FFFFFF" strokeWidth={3} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: selected ? "#EDE9FE" : "#F5F3FF",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24,
          transition: "background 180ms",
        }}>
          {template.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: selected ? "#5B21B6" : "#111827",
            marginBottom: 2,
            transition: "color 180ms",
          }}>
            {template.name}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {template.description}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {template.tags.map(tag => (
          <span key={tag} style={TAG_STYLE}>{tag}</span>
        ))}
      </div>
    </button>
  );
}

function ScratchCard({ selected, onSelect }) {
  const [hovered, setHovered] = useState(false);

  const borderColor = selected
    ? "#7C3AED"
    : hovered
    ? "#C4B5FD"
    : "#D1D5DB";

  return (
    <button
      type="button"
      style={{
        ...CARD_BASE,
        border: selected ? `2px solid ${borderColor}` : `2px dashed ${borderColor}`,
        boxShadow: selected ? "0 0 0 3px rgba(124,58,237,0.15)" : "none",
        background: selected ? "#FAF5FF" : hovered ? "#F9FAFB" : "#FAFAFA",
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
      onClick={() => onSelect(null)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {selected && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 20, height: 20, borderRadius: "50%",
          background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={12} color="#FFFFFF" strokeWidth={3} />
        </div>
      )}
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: selected ? "#EDE9FE" : "#F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 180ms",
      }}>
        <Code2 size={22} color={selected ? "#7C3AED" : "#6B7280"} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: selected ? "#5B21B6" : "#374151", marginBottom: 2 }}>
          Start from scratch
        </div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          Describe your app and let AI build it
        </div>
      </div>
    </button>
  );
}

export default function TemplateGallery({ selectedTemplate, onSelect }) {
  return (
    <div>
      {/* Scratch option */}
      <div style={{ marginBottom: 10 }}>
        <ScratchCard selected={selectedTemplate === null} onSelect={onSelect} />
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          Or pick a template
        </span>
        <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
      </div>

      {/* Template grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 10,
      }}>
        {TEMPLATES.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            selected={selectedTemplate === t.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
