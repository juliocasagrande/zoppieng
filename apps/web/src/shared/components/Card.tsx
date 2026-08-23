import type { PropsWithChildren } from "react";

export function Card({ children, style, padding = 24 }: PropsWithChildren<{ style?: React.CSSProperties; padding?: number }>) {
  return (
    <div
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
