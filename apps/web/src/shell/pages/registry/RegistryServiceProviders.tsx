import type { RegistryServiceProvider } from "@zoppi/shared";
import { SERVICE_PROVIDER_DOCUMENT_TYPE_LABELS } from "@zoppi/shared";
import { useAuth } from "../../AuthContext.js";
import { RegistryCrudPage, type RegistryWizardStep } from "./RegistryCrudPage.js";

const DOCUMENT_TYPE_OPTIONS = Object.entries(SERVICE_PROVIDER_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY: Partial<RegistryServiceProvider> = { name: "", document_type: "cnpj" };

const STEPS: RegistryWizardStep[] = [
  {
    id: "identificacao",
    title: "Identificação",
    color: "var(--color-navy)",
    fields: [
      { key: "name", label: "Nome / razão social", required: true },
      { key: "document_type", label: "Tipo", type: "select", options: DOCUMENT_TYPE_OPTIONS },
      { key: "document_number", label: "CNPJ / CPF" },
      { key: "service_type", label: "Tipo de serviço" },
    ],
  },
  {
    id: "contato",
    title: "Contato",
    color: "var(--color-orange)",
    fields: [
      { key: "address", label: "Endereço" },
      { key: "contact_phone", label: "Telefone" },
      { key: "contact_email", label: "E-mail" },
    ],
  },
  {
    id: "observacoes",
    title: "Observações",
    color: "var(--color-navy-light)",
    fields: [{ key: "notes", label: "Observações", type: "textarea" }],
  },
];

export function RegistryServiceProvidersPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "company_admin";

  return (
    <RegistryCrudPage<RegistryServiceProvider>
      title="Prestadores de Serviço"
      description="Empresas ou autônomos subcontratados para apoiar sua operação (calibração, manutenção, mão de obra, etc.)."
      endpoint="/registry/service-providers"
      canEdit={canEdit}
      emptyForm={EMPTY}
      steps={STEPS}
      searchFields={["name", "document_number", "service_type"]}
      filterSelect={{ key: "document_type", label: "Tipo", options: DOCUMENT_TYPE_OPTIONS }}
      renderSummary={(row) => ({
        heading: row.name,
        lines: [row.service_type ?? "", [SERVICE_PROVIDER_DOCUMENT_TYPE_LABELS[row.document_type], row.document_number].filter(Boolean).join(" · ")].filter(
          (line) => line.length > 0,
        ),
      })}
    />
  );
}
