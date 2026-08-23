import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { useAuth } from "../AuthContext.js";
import { Button } from "../../shared/components/Button.js";
import { Card } from "../../shared/components/Card.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Alert } from "../../shared/components/Alert.js";

export function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/app/reports" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-navy-dark)" }}>
      <Card style={{ width: 380 }} padding={32}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-block", background: "var(--color-navy-dark)", borderRadius: "var(--radius)", padding: "8px 14px", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff" }}>ZOPPI</span>
          </div>
          <h1 style={{ fontSize: "1.3rem" }}>Entrar</h1>
        </div>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <FormField label="E-mail">
            <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Senha">
            <input style={inputStyle} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
