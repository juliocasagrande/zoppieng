// Shared visual building blocks for multi-step wizards rendered inside a
// Modal (see Modal.tsx) — used by both the report-creation wizard and the
// engineering-review wizard so their step pills/section headers stay
// visually consistent.

export interface WizardStep<Id extends string> {
  id: Id;
  title: string;
  color: string;
}

// Compact step pills below the modal's header progress bar — clicking a
// reached step jumps back to it. Each pill picks up its own step color when
// active, and shows a check once passed.
export function StepPills<Id extends string>({
  steps,
  current,
  maxReached,
  onSelect,
}: {
  steps: WizardStep<Id>[];
  current: number;
  maxReached: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {steps.map((s, i) => {
        const active = i === current;
        const reachable = i <= maxReached;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(i)}
            disabled={!reachable}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 20,
              border: `1px solid ${active ? s.color : "var(--color-gray-light)"}`,
              background: active ? `color-mix(in srgb, ${s.color} 10%, transparent)` : "var(--color-white)",
              color: active ? s.color : reachable ? "var(--color-text)" : "var(--color-gray)",
              cursor: reachable ? "pointer" : "default",
              fontSize: "0.78rem",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: active || i < current ? s.color : "var(--color-gray-light)",
                color: active || i < current ? "#fff" : "var(--color-gray)",
                fontSize: "0.62rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {i < current ? "✓" : i + 1}
            </span>
            {s.title}
          </button>
        );
      })}
    </div>
  );
}

// Every step's fields live inside a Section: a colored left rail + heading
// visually separates "what this step is about" from the rest of the modal.
export function Section({ color, title, description, children }: { color: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
        <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: color, flexShrink: 0, minHeight: 32 }} />
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--color-dark)" }}>{title}</h3>
          {description && <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--color-gray)" }}>{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
