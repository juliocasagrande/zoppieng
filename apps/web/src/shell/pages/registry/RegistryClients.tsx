import type { RegistryClient } from "@zoppi/shared";
import { useAuth } from "../../AuthContext.js";
import { RegistryCrudPage, type RegistryWizardStep } from "./RegistryCrudPage.js";

const EMPTY: Partial<RegistryClient> = { legal_name: "", trade_name: "", cnpj: "" };

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
        onCnpjResult: (result) => ({
          legal_name: result.legalName,
          trade_name: result.tradeName ?? "",
          address_street: result.street ?? "",
          address_number: result.number ?? "",
          address_complement: result.complement ?? "",
          address_district: result.district ?? "",
          address_city: result.city ?? "",
          address_state: result.state ?? "",
          address_zip: result.zip ?? "",
          contact_phone: result.phone ?? "",
          contact_email: result.email ?? "",
        }),
      },
      { key: "legal_name", label: "Razão social", required: true },
      { key: "trade_name", label: "Nome fantasia" },
    ],
  },
  {
    id: "endereco",
    title: "Endereço",
    color: "var(--color-orange)",
    fields: [
      { key: "address_street", label: "Endereço" },
      { key: "address_number", label: "Número" },
      { key: "address_complement", label: "Complemento" },
      { key: "address_district", label: "Bairro" },
      { key: "address_city", label: "Cidade" },
      { key: "address_state", label: "UF" },
      { key: "address_zip", label: "CEP" },
    ],
  },
  {
    id: "contato",
    title: "Contato",
    color: "var(--color-navy-light)",
    fields: [
      { key: "contact_name", label: "Contato — nome" },
      { key: "contact_role", label: "Contato — cargo" },
      { key: "contact_phone", label: "Contato — telefone" },
      { key: "contact_email", label: "Contato — e-mail" },
      { key: "notes", label: "Observações", type: "textarea" },
    ],
  },
];

export function RegistryClientsPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "company_admin";

  return (
    <RegistryCrudPage<RegistryClient>
      title="Clientes"
      description="Empresas ou proprietários de imóveis atendidos por você — use esse cadastro para preencher laudos mais rápido no futuro."
      endpoint="/registry/clients"
      canEdit={canEdit}
      emptyForm={EMPTY}
      steps={STEPS}
      searchFields={["legal_name", "trade_name", "cnpj", "contact_name", "address_city"]}
      renderSummary={(row) => ({
        heading: row.legal_name,
        lines: [
          [row.address_city, row.address_state].filter(Boolean).join(" - "),
          [row.contact_name, row.contact_phone].filter(Boolean).join(" · "),
        ].filter((line) => line.length > 0),
      })}
    />
  );
}
