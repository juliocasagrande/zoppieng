import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { REPORT_NAME_PRESETS } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Button } from "../../shared/components/Button.js";
import { Alert } from "../../shared/components/Alert.js";

const CUSTOM_NAME = "__custom__";

export function ReportWizardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [namePreset, setNamePreset] = useState(REPORT_NAME_PRESETS[0]);
  const [customName, setCustomName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteIdentification, setSiteIdentification] = useState("");
  const [contratanteName, setContratanteName] = useState("");
  const [contratadaName, setContratadaName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.company_id) {
      setError("Seu usuário não está vinculado a uma empresa assinante.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await api.post("/reports", {
        companyId: profile.company_id,
        name: namePreset === CUSTOM_NAME ? customName : namePreset,
        siteAddress,
        siteIdentification,
        contratante: { legalName: contratanteName },
        contratada: { legalName: contratadaName },
      });
      navigate(`/app/reports/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar laudo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Novo laudo de Ancoragem</h1>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <Card padding={32}>
        <form onSubmit={handleSubmit}>
          <FormField label="Nome do laudo">
            <select style={inputStyle} value={namePreset} onChange={(e) => setNamePreset(e.target.value)}>
              {REPORT_NAME_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
              <option value={CUSTOM_NAME}>Personalizado…</option>
            </select>
          </FormField>
          {namePreset === CUSTOM_NAME && (
            <FormField label="Nome personalizado">
              <input style={inputStyle} value={customName} onChange={(e) => setCustomName(e.target.value)} required />
            </FormField>
          )}
          <FormField label="Endereço do local">
            <input style={inputStyle} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
          </FormField>
          <FormField label="Identificação da obra/planta">
            <input style={inputStyle} value={siteIdentification} onChange={(e) => setSiteIdentification(e.target.value)} />
          </FormField>
          <FormField label="Contratante (razão social)">
            <input style={inputStyle} value={contratanteName} onChange={(e) => setContratanteName(e.target.value)} required />
          </FormField>
          <FormField label="Contratada (razão social)">
            <input style={inputStyle} value={contratadaName} onChange={(e) => setContratadaName(e.target.value)} required />
          </FormField>
          <Button type="submit" disabled={loading}>
            {loading ? "Criando…" : "Criar laudo"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
