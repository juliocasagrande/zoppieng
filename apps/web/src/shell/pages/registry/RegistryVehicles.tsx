import type { RegistryVehicle } from "@zoppi/shared";
import { VEHICLE_KIND_LABELS } from "@zoppi/shared";
import { useAuth } from "../../AuthContext.js";
import { RegistryCrudPage, type RegistryWizardStep } from "./RegistryCrudPage.js";

const KIND_OPTIONS = Object.entries(VEHICLE_KIND_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY: Partial<RegistryVehicle> = { kind: "outro" };

const STEPS: RegistryWizardStep[] = [
  {
    id: "identificacao",
    title: "Identificação",
    color: "var(--color-navy)",
    fields: [
      { key: "plate", label: "Placa", required: true },
      { key: "kind", label: "Tipo", type: "select", options: KIND_OPTIONS },
      { key: "brand", label: "Marca" },
      { key: "model", label: "Modelo" },
      { key: "year", label: "Ano", type: "number" },
    ],
  },
  {
    id: "seguro",
    title: "Seguro",
    color: "var(--color-orange)",
    description: "O documento do veículo (CRLV) pode ser anexado depois, na lista.",
    fields: [{ key: "insurance_expires_at", label: "Seguro válido até", type: "date" }],
  },
  {
    id: "observacoes",
    title: "Observações",
    color: "var(--color-navy-light)",
    fields: [{ key: "notes", label: "Observações", type: "textarea" }],
  },
];

export function RegistryVehiclesPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "zoppi_engineer" || profile?.role === "company_admin";

  return (
    <RegistryCrudPage<RegistryVehicle>
      title="Veículos"
      description="Frota usada para deslocamento até os locais de inspeção, com documentos e vencimento de seguro. Um Engenheiro Zoppi que cadastra aqui registra o próprio veículo — usado em qualquer empresa que ele atenda."
      endpoint="/registry/vehicles"
      canEdit={canEdit}
      emptyForm={EMPTY}
      steps={STEPS}
      ownershipMode="personal-for-engineer"
      searchFields={["plate", "brand", "model"]}
      filterSelect={{ key: "kind", label: "Tipo", options: KIND_OPTIONS }}
      documentField={{ pathKey: "document_path", urlKey: "document_url", label: "Documento (CRLV)" }}
      renderSummary={(row) => ({
        heading: row.plate ?? "Sem placa",
        lines: [
          [VEHICLE_KIND_LABELS[row.kind], row.brand, row.model].filter(Boolean).join(" · "),
          row.insurance_expires_at ? `Seguro válido até ${row.insurance_expires_at}` : "",
        ].filter((line) => line.length > 0),
      })}
    />
  );
}
