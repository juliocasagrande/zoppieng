import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { Button } from "../../shared/components/Button.js";
import { Card } from "../../shared/components/Card.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Alert } from "../../shared/components/Alert.js";

// Landing page for the link sent by supabase.auth.resetPasswordForEmail.
// Supabase's client picks up the recovery token from the URL fragment and
// fires a PASSWORD_RECOVERY auth event, which creates a temporary session —
// we just need to collect the new password and call updateUser.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/app/reports"), 1500);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-navy-dark)", padding: 16 }}>
      <Card style={{ width: 380 }} padding={32}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-block", background: "var(--color-navy-dark)", borderRadius: "var(--radius)", padding: "8px 14px", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff" }}>ZOPPI</span>
          </div>
          <h1 style={{ fontSize: "1.3rem" }}>Nova senha</h1>
        </div>

        {!ready && !done && <Alert tone="info">Validando o link de redefinição…</Alert>}

        {done && <Alert tone="success">Senha atualizada! Redirecionando…</Alert>}

        {ready && !done && (
          <>
            {error && (
              <div style={{ marginBottom: 16 }}>
                <Alert tone="danger">{error}</Alert>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <FormField label="Nova senha">
                <input style={inputStyle} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormField>
              <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
                {loading ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
