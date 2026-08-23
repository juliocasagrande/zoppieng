import type { PropsWithChildren } from "react";

export function FormField({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span
        style={{
          display: "block",
          marginBottom: 6,
          fontFamily: "var(--font-label)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontSize: "0.7rem",
          color: "var(--color-gray)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid var(--color-gray-light)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
  color: "var(--color-text)",
  background: "var(--color-white)",
};
