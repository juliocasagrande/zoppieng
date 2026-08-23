import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.js";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { session, profile, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Carregando…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div style={{ padding: 40 }}>Sua conta não está vinculada a um perfil Zoppi. Contate o administrador.</div>;
  return <>{children}</>;
}
