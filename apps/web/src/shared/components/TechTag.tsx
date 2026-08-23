export function TechTag({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 8px",
        fontFamily: "var(--font-label)",
        fontSize: "0.66rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--color-orange)",
        background: "color-mix(in srgb, var(--color-orange) 8%, white)",
        border: "1px solid color-mix(in srgb, var(--color-orange) 16%, white)",
      }}
    >
      {label}
    </span>
  );
}
