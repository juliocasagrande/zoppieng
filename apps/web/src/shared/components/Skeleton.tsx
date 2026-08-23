export function Skeleton({
  width = "100%",
  height = 14,
  radius,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}) {
  return <span className="zp-skeleton" style={{ width, height, borderRadius: radius ?? "var(--radius)", ...style }} />;
}

export function SkeletonText({ lines = 1, width = "100%", lastLineWidth = "60%" }: { lines?: number; width?: number | string; lastLineWidth?: number | string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? lastLineWidth : width} />
      ))}
    </div>
  );
}
