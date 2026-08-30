import type { RegistrySupplier } from "@zoppi/shared";
import { SUPPLIER_CATEGORY_LABELS } from "@zoppi/shared";
import { useAuth } from "../../AuthContext.js";
import { RegistryCrudPage, type RegistryWizardStep } from "./RegistryCrudPage.js";

const CATEGORY_OPTIONS = Object.entries(SUPPLIER_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY: Partial<RegistrySupplier> = { legal_name: "", category: "outro" };

const STEPS: RegistryWizardStep[] = [
  {
    id: "identificacao",
    title: "Identificação",
    color: "var(--color-navy)",
    description: "Informe o CNPJ para buscar os dados automaticamente, ou preencha manualmente.",
    fields: [
      {
        key: "cnpj",
        label: "CNPJ",
        type: "cnpj",
        onCnpjResult: (result) => ({ legal_name: result.legalName, trade_name: result.tradeName ?? "", address: result.address ?? "" }),
      },
      { key: "legal_name", label: "Razão social", required: true },
      { key: "trade_name", label: "Nome fantasia" },
      { key: "category", label: "Categoria", type: "select", options: CATEGORY_OPTIONS },
    ],
  },
  {
    id: "contato",
    title: "Endereço e contato",
    color: "var(--color-orange)",
    fields: [
      { key: "address", label: "Endereço" },
      { key: "contact_name", label: "Contato — nome" },
      { key: "contact_phone", label: "Contato — telefone" },
      { key: "contact_email", label: "Contato — e-mail" },
    ],
  },
  {
    id: "observacoes",
    title: "Observações",
    color: "var(--color-navy-light)",
    fields: [{ key: "notes", label: "Observações", type: "textarea" }],
  },
];

export function RegistrySuppliersPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "company_admin";

  return (
    <RegistryCrudPage<RegistrySupplier>
      title="Fornecedores"
      description="Empresas que fornecem materiais, EPIs ou serviços de calibração para a sua operação."
      endpoint="/registry/suppliers"
      canEdit={canEdit}
      emptyForm={EMPTY}
      steps={STEPS}
      searchFields={["legal_name", "trade_name", "cnpj"]}
      filterSelect={{ key: "category", label: "Categoria", options: CATEGORY_OPTIONS }}
      renderSummary={(row) => ({
        heading: row.legal_name,
        lines: [SUPPLIER_CATEGORY_LABELS[row.category], [row.contact_name, row.contact_phone].filter(Boolean).join(" · ")].filter(
          (line) => line.length > 0,
        ),
      })}
    />
  );
}
