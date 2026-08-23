type Tone = "warning" | "danger" | "info" | "success";

const toneStyles: Record<Tone, { bg: string; text: string; dot: string }> = {
  warning: { bg: "#FCE8DB", text: "#A8460F", dot: "var(--color-orange)" },
  danger: { bg: "#F8DADA", text: "#A02323", dot: "var(--color-danger)" },
  info: { bg: "#DEE1F2", text: "var(--color-navy-dark)", dot: "var(--color-info)" },
  success: { bg: "#DBF0E2", text: "#1E6B3C", dot: "var(--color-success)" },
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = toneStyles[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        borderRadius: "var(--radius)",
        padding: "14px 18px",
        background: t.bg,
        color: t.text,
        fontFamily: "var(--font-body)",
        fontSize: "0.9rem",
      }}
    >
      <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
}
