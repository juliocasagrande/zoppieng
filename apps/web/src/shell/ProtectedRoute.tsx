import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.js";
import { Skeleton } from "../shared/components/Skeleton.js";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { session, profile, loading } = useAuth();
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
  if (!profile) return <div style={{ padding: 40 }}>Sua conta não está vinculada a um perfil Zoppi. Contate o administrador.</div>;
  return <>{children}</>;
}
