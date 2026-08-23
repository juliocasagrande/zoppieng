import { Card } from "./Card.js";

type Tone = "success" | "warning" | "danger" | "info";

const toneColor: Record<Tone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
};

export function KpiCard({ label, value, tone = "info" }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <Card>
      <div className="zp-eyebrow">{label}</div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "2.4rem",
          color: toneColor[tone],
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </Card>
  );
}
