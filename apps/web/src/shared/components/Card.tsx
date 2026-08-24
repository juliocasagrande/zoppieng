import type { PropsWithChildren } from "react";

export function Card({ children, style, padding = 24, className }: PropsWithChildren<{ style?: React.CSSProperties; padding?: number; className?: string }>) {
  return (
    <div
      className={className}
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-gray-light)",
        borderRadius: "var(--radius)",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
