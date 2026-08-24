import { useState, type PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.js";
import { Skeleton } from "../shared/components/Skeleton.js";
import { Card } from "../shared/components/Card.js";
import { Alert } from "../shared/components/Alert.js";
import { Button } from "../shared/components/Button.js";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { session, profile, profileError, loading, refreshProfile, signOut } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSignOut() {
    setActionError(null);
    try {
      await signOut();
    } catch {
      setActionError("Não foi possível encerrar a sessão. Tente novamente.");
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex" }}>
        <div style={{ width: "var(--sidebar-width)", background: "var(--color-navy)" }} />
        <div style={{ flex: 1, padding: 40 }}>
          <Skeleton height={32} width={280} style={{ marginBottom: 24 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton height={72} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </div>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) {
    const isMissingProfile = profileError?.kind === "missing_profile";
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          background: "var(--color-off-white)",
        }}
      >
        <Card style={{ width: "min(100%, 520px)", boxShadow: "var(--shadow)" }} padding={32}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--color-navy)", marginBottom: 20 }}>
            ZOPPI
          </div>
          <h1 style={{ fontSize: "1.6rem" }}>{isMissingProfile ? "Perfil não encontrado" : "Não foi possível carregar seu perfil"}</h1>
          <p style={{ lineHeight: 1.55, margin: "0 0 18px" }}>
            {profileError?.message ?? "Ocorreu um erro ao consultar os dados desta conta."}
          </p>
          <Alert tone={isMissingProfile ? "warning" : "danger"}>
            Você está conectado como <strong>{session.user.email ?? "conta sem e-mail"}</strong>.
            {isMissingProfile ? " Se esta não é a conta esperada, saia e entre novamente." : " Tente carregar novamente antes de trocar de conta."}
          </Alert>
          {actionError && (
            <div style={{ marginTop: 12 }}>
              <Alert tone="danger">{actionError}</Alert>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
            <Button onClick={() => void refreshProfile()}>Tentar novamente</Button>
            <Button variant="outline" onClick={() => void handleSignOut()}>
              Sair e entrar com outra conta
            </Button>
          </div>
        </Card>
      </main>
    );
  }
  return <>{children}</>;
}
