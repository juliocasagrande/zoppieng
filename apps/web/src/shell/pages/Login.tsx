import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { publicApi } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Button } from "../../shared/components/Button.js";
import { Card } from "../../shared/components/Card.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Alert } from "../../shared/components/Alert.js";

type Mode = "login" | "signup" | "forgot";

function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 24 }}>
      <div style={{ display: "inline-block", background: "var(--color-navy-dark)", borderRadius: "var(--radius)", padding: "8px 14px", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff" }}>ZOPPI</span>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("login");

  if (session) return <Navigate to="/app/reports" replace />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-navy-dark)", padding: 16 }}>
      <Card style={{ width: 400 }} padding={32}>
        <Logo />
        {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} onSignup={() => setMode("signup")} />}
        {mode === "signup" && <SignupForm onBack={() => setMode("login")} />}
        {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}
      </Card>
    </div>
  );
}

function LoginForm({ onForgot, onSignup }: { onForgot: () => void; onSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <>
      <h1 style={{ fontSize: "1.3rem", textAlign: "center" }}>Entrar</h1>
      {error && (
        <div style={{ margin: "16px 0" }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: "0.85rem" }}>
        <LinkButton onClick={onForgot}>Esqueci minha senha</LinkButton>
        <LinkButton onClick={onSignup}>Criar conta</LinkButton>
      </div>
    </>
  );
}

function SignupForm({ onBack }: { onBack: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyLegalName, setCompanyLegalName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await publicApi.post("/register", { fullName, email, password, companyLegalName, companyCnpj });
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <Alert tone="success">Conta criada com sucesso! Faça login para continuar.</Alert>
        <Button variant="outline" style={{ width: "100%", marginTop: 16 }} onClick={onBack}>
          Voltar para o login
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: "1.3rem", textAlign: "center" }}>Criar conta</h1>
      <p className="zp-eyebrow" style={{ textAlign: "center", marginBottom: 16 }}>
        Cadastre sua empresa para solicitar laudos
      </p>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <FormField label="Seu nome completo">
          <input style={inputStyle} required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="E-mail">
          <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Senha">
          <input style={inputStyle} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <FormField label="Razão social da empresa">
          <input style={inputStyle} required value={companyLegalName} onChange={(e) => setCompanyLegalName(e.target.value)} />
        </FormField>
        <FormField label="CNPJ">
          <input style={inputStyle} required value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} />
        </FormField>
        <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
          {loading ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.85rem" }}>
        <LinkButton onClick={onBack}>Já tenho conta — voltar ao login</LinkButton>
      </div>
    </>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <>
        <Alert tone="success">Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.</Alert>
        <Button variant="outline" style={{ width: "100%", marginTop: 16 }} onClick={onBack}>
          Voltar para o login
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: "1.3rem", textAlign: "center" }}>Esqueci minha senha</h1>
      {error && (
        <div style={{ margin: "16px 0" }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <FormField label="E-mail">
          <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
          {loading ? "Enviando…" : "Enviar link de redefinição"}
        </Button>
      </form>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.85rem" }}>
        <LinkButton onClick={onBack}>Voltar para o login</LinkButton>
      </div>
    </>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "none", border: "none", color: "var(--color-navy)", cursor: "pointer", padding: 0, fontFamily: "var(--font-body)", fontWeight: 600 }}
    >
      {children}
    </button>
  );
}
