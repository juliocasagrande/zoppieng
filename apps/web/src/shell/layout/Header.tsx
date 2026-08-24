import { useAuth } from "../AuthContext.js";
import { USER_ROLE_LABELS } from "@zoppi/shared";

export function Header() {
  const { profile, signOut } = useAuth();
  return (
    <header
      className="zp-header"
      style={{
        background: "var(--color-navy-dark)",
        color: "#fff",
        padding: "18px 40px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div className="zp-header-brand" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: "var(--radius)", padding: "6px 10px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--color-navy-dark)" }}>ZOPPI</span>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: "1.1rem" }}>
            Zoppi Segurança
          </div>
          <div className="zp-eyebrow zp-header-tagline" style={{ color: "rgba(255,255,255,0.55)" }}>
            Plataforma de laudos técnicos
          </div>
        </div>
      </div>
      {profile && (
        <div className="zp-header-profile" style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "var(--font-body)" }}>
          <div className="zp-header-profile-text" style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600 }}>{profile.full_name}</div>
            <div className="zp-eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>
              {USER_ROLE_LABELS[profile.role]}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: "var(--radius)", padding: "8px 14px", cursor: "pointer" }}
          >
            Sair
          </button>
        </div>
      )}
    </header>
  );
}
