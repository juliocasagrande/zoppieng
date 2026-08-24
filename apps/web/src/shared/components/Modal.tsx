import { useEffect, type PropsWithChildren, type ReactNode } from "react";

interface ModalProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  onClose: () => void;
  progress?: { current: number; total: number };
  footer?: ReactNode;
  width?: number;
}

// Generic centered overlay dialog. Fixed positioning works without a portal
// here because no ancestor in ShellLayout sets `overflow` or a CSS
// `transform` that would trap it (see shell/layout/ShellLayout.tsx).
export function Modal({
  title,
  subtitle,
  accentColor = "var(--color-orange)",
  onClose,
  progress,
  footer,
  width = 720,
  children,
}: PropsWithChildren<ModalProps>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,28,46,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          background: "var(--color-white)",
          borderRadius: 8,
          boxShadow: "var(--shadow-elevated)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--color-gray-light)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.3rem", color: accentColor, transition: "color 0.2s ease" }}>{title}</h2>
              {subtitle && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--color-gray)" }}>{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                background: "var(--color-off-white)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                fontSize: "1.1rem",
                lineHeight: 1,
                cursor: "pointer",
                color: "var(--color-gray)",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {progress && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="zp-eyebrow">
                  Etapa {progress.current} de {progress.total}
                </span>
                <span className="zp-eyebrow">{pct}% concluído</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--color-gray-light)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: accentColor, transition: "width 0.25s ease, background 0.2s ease" }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>{children}</div>

        {footer && <div style={{ padding: "16px 28px", borderTop: "1px solid var(--color-gray-light)", flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}
