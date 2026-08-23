import { useEffect, useState } from "react";
import type { Company } from "@zoppi/shared";
import { DEFAULT_BRAND_PRIMARY_COLOR, DEFAULT_BRAND_SECONDARY_COLOR } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Button } from "../../shared/components/Button.js";
import { Skeleton } from "../../shared/components/Skeleton.js";

type CompanyWithLogo = Company & { logo_url: string | null };

export function CompanyAdminPage() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<CompanyWithLogo | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (profile?.company_id) api.get(`/companies/${profile.company_id}`).then(setCompany);
  }, [profile?.company_id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    try {
      await api.patch(`/companies/${company.id}`, {
        legal_name: company.legal_name,
        cnpj: company.cnpj,
        contact_name: company.contact_name,
        contact_email: company.contact_email,
        contact_phone: company.contact_phone,
        brand_primary_color: company.brand_primary_color,
        brand_secondary_color: company.brand_secondary_color,
        pdf_header_text: company.pdf_header_text,
        pdf_footer_text: company.pdf_footer_text,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(file: File) {
    if (!company) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const { path, signedUrl } = await api.post(`/companies/${company.id}/logo-upload-url`, { ext });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/png" } });
      const updated = await api.patch(`/companies/${company.id}`, { logo_path: path });
      setCompany(updated);
    } finally {
      setUploadingLogo(false);
    }
  }

  if (!company) {
    return (
      <div style={{ maxWidth: 560 }}>
        <h1>Empresa</h1>
        <Card padding={32}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <Skeleton height={11} width={90} style={{ marginBottom: 8 }} />
              <Skeleton height={38} />
            </div>
          ))}
          <Skeleton height={38} width={110} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Empresa</h1>
      <Card padding={32} style={{ marginBottom: 24 }}>
        <form onSubmit={handleSave}>
          <FormField label="Razão social">
            <input style={inputStyle} value={company.legal_name} onChange={(e) => setCompany({ ...company, legal_name: e.target.value })} />
          </FormField>
          <FormField label="CNPJ">
            <input style={inputStyle} value={company.cnpj} onChange={(e) => setCompany({ ...company, cnpj: e.target.value })} />
          </FormField>
          <FormField label="Contato">
            <input style={inputStyle} value={company.contact_name ?? ""} onChange={(e) => setCompany({ ...company, contact_name: e.target.value })} />
          </FormField>
          <FormField label="E-mail de contato">
            <input style={inputStyle} value={company.contact_email ?? ""} onChange={(e) => setCompany({ ...company, contact_email: e.target.value })} />
          </FormField>
          <FormField label="Telefone">
            <input style={inputStyle} value={company.contact_phone ?? ""} onChange={(e) => setCompany({ ...company, contact_phone: e.target.value })} />
          </FormField>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Card>

      <Card padding={32}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: 4 }}>Identidade visual do laudo (PDF)</h3>
        <p className="zp-eyebrow" style={{ marginBottom: 16 }}>
          Personalize a aparência dos laudos em PDF gerados para sua empresa.
        </p>
        <form onSubmit={handleSave}>
          <FormField label="Logo">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 96,
                  height: 48,
                  border: "1px solid var(--color-gray-light)",
                  borderRadius: "var(--radius)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "var(--color-off-white)",
                }}
              >
                {company.logo_url ? (
                  <img src={company.logo_url} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <span className="zp-eyebrow">Sem logo</span>
                )}
              </div>
              <label>
                <Button type="button" variant="outline" disabled={uploadingLogo} onClick={() => document.getElementById("logo-upload-input")?.click()}>
                  {uploadingLogo ? "Enviando…" : "Enviar logo"}
                </Button>
                <input
                  id="logo-upload-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleLogoChange(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <FormField label="Cor primária">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={company.brand_primary_color || DEFAULT_BRAND_PRIMARY_COLOR}
                  onChange={(e) => setCompany({ ...company, brand_primary_color: e.target.value })}
                  style={{ width: 44, height: 38, padding: 2, border: "1px solid var(--color-gray-light)", borderRadius: "var(--radius)" }}
                />
                <input
                  style={inputStyle}
                  value={company.brand_primary_color ?? ""}
                  placeholder={DEFAULT_BRAND_PRIMARY_COLOR}
                  onChange={(e) => setCompany({ ...company, brand_primary_color: e.target.value })}
                />
              </div>
            </FormField>
            <FormField label="Cor secundária">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={company.brand_secondary_color || DEFAULT_BRAND_SECONDARY_COLOR}
                  onChange={(e) => setCompany({ ...company, brand_secondary_color: e.target.value })}
                  style={{ width: 44, height: 38, padding: 2, border: "1px solid var(--color-gray-light)", borderRadius: "var(--radius)" }}
                />
                <input
                  style={inputStyle}
                  value={company.brand_secondary_color ?? ""}
                  placeholder={DEFAULT_BRAND_SECONDARY_COLOR}
                  onChange={(e) => setCompany({ ...company, brand_secondary_color: e.target.value })}
                />
              </div>
            </FormField>
          </div>

          <FormField label="Texto do cabeçalho (opcional — use {report} para o nome do laudo)">
            <input
              style={inputStyle}
              value={company.pdf_header_text ?? ""}
              placeholder="Ex.: Minha Empresa — {report}"
              onChange={(e) => setCompany({ ...company, pdf_header_text: e.target.value })}
            />
          </FormField>
          <FormField label="Texto do rodapé (opcional — use {engineer}, {crea}, {reportNumber})">
            <input
              style={inputStyle}
              value={company.pdf_footer_text ?? ""}
              placeholder="Ex.: Resp. técnico: {engineer} · CREA {crea} · Laudo {reportNumber}"
              onChange={(e) => setCompany({ ...company, pdf_footer_text: e.target.value })}
            />
          </FormField>

          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar identidade visual"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
