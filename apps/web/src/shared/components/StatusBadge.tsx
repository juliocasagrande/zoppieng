type Tone = "success" | "warning" | "danger" | "info";

const toneColor: Record<Tone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const color = toneColor[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 20,
        fontFamily: "var(--font-label)",
        fontWeight: 600,
        textTransform: "uppercase",
        fontSize: "0.72rem",
        letterSpacing: "0.05em",
        color,
        background: `color-mix(in srgb, ${color} 8%, white)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, white)`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}
