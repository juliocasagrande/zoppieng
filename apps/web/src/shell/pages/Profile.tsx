import { useState } from "react";
import { useAuth } from "../AuthContext.js";
import { api } from "../../lib/api.js";
import { Card } from "../../shared/components/Card.js";
import { Button } from "../../shared/components/Button.js";
import { Alert } from "../../shared/components/Alert.js";

// Lets a signing engineer (or admin) upload a signature image — a scan/photo
// of a handwritten signature on white background — used in the laudo PDF
// signature block alongside (not instead of) the ICP-Brasil digital
// certificate and the ART number.
export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignatureChange(file: File) {
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const { path, signedUrl } = await api.post("/users/me/signature-upload-url", { ext });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/png" } });
      await api.patch(`/users/${profile!.id}`, { signature_path: path });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar assinatura.");
    } finally {
      setUploading(false);
    }
  }

  if (!profile) return null;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Meu perfil</h1>
      <Card padding={32} style={{ marginTop: 16 }}>
        <p>
          <strong>{profile.full_name}</strong>
        </p>
        <p style={{ color: "var(--color-gray)" }}>{profile.email}</p>
        {profile.crea_number && <p style={{ color: "var(--color-gray)" }}>CREA {profile.crea_number}</p>}
      </Card>

      <Card padding={32} style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: 4 }}>Assinatura</h3>
        <p className="zp-eyebrow" style={{ marginBottom: 16 }}>
          Envie uma imagem da sua assinatura em fundo branco (como se tivesse assinado no papel). Ela aparece nos laudos em PDF, ao lado do
          certificado digital ICP-Brasil e da ART — não os substitui.
        </p>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 160,
              height: 70,
              border: "1px solid var(--color-gray-light)",
              borderRadius: "var(--radius)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
              background: "#fff",
            }}
          >
            {profile.signature_url ? (
              <img src={profile.signature_url} alt="Assinatura" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <span className="zp-eyebrow">Sem assinatura</span>
            )}
          </div>
          <label>
            <Button type="button" variant="outline" disabled={uploading} onClick={() => document.getElementById("signature-upload-input")?.click()}>
              {uploading ? "Enviando…" : "Enviar assinatura"}
            </Button>
            <input
              id="signature-upload-input"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.[0]) handleSignatureChange(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </Card>
    </div>
  );
}
