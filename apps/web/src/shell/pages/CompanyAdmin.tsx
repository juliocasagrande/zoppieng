import { useEffect, useState } from "react";
import type { Company } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Button } from "../../shared/components/Button.js";

export function CompanyAdminPage() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

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
      });
    } finally {
      setSaving(false);
    }
  }

  if (!company) return <p>Carregando…</p>;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Empresa</h1>
      <Card padding={32}>
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
    </div>
  );
}
