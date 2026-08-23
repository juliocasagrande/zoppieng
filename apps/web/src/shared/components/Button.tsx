import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "destructive";

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--color-orange)", borderColor: "var(--color-orange)", color: "#fff" },
  secondary: { background: "var(--color-navy)", borderColor: "var(--color-navy)", color: "#fff" },
  outline: { background: "transparent", borderColor: "var(--color-gray-light)", color: "var(--color-navy)" },
  destructive: { background: "var(--color-danger)", borderColor: "var(--color-danger)", color: "#fff" },
};

export function Button({
  variant = "primary",
  disabled,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        borderRadius: "var(--radius)",
        padding: "12px 26px",
        border: "2px solid",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease",
        ...(disabled
          ? { background: "var(--color-gray-light)", borderColor: "var(--color-gray-light)", color: "var(--color-gray)" }
          : variantStyles[variant]),
        ...style,
      }}
    />
  );
}
