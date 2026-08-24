import { useState } from "react";
import { formatCnpj, isValidCnpj, normalizeCnpj, type CnpjLookupResult } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { Button } from "./Button.js";
import { FormField, inputStyle } from "./FormField.js";

interface CnpjLookupFieldProps {
  value: string;
  onChange: (value: string) => void;
  onResult: (result: CnpjLookupResult) => void;
}

export function CnpjLookupField({ value, onChange, onResult }: CnpjLookupFieldProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isValidCnpj(value);

  async function lookup() {
    if (!valid) {
      setError("Informe um CNPJ válido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = (await api.get(`/companies/lookup/cnpj/${normalizeCnpj(value)}`)) as CnpjLookupResult;
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^"|"$/g, "") : "Não foi possível consultar o CNPJ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormField label="CNPJ">
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          style={{ ...inputStyle, minWidth: 0 }}
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          placeholder="00.000.000/0000-00"
          value={formatCnpj(value)}
          onChange={(event) => {
            setError(null);
            onChange(formatCnpj(event.target.value));
          }}
        />
        <Button type="button" variant="outline" disabled={loading || !valid} onClick={lookup} style={{ paddingInline: 16, whiteSpace: "nowrap" }}>
          {loading ? "Buscando..." : "Buscar CNPJ"}
        </Button>
      </div>
      {error && <div style={{ color: "var(--color-danger)", fontSize: "0.8rem", marginTop: 6 }}>{error}</div>}
    </FormField>
  );
}
