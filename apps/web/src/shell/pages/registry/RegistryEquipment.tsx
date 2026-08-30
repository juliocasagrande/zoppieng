import type { RegistryEquipment } from "@zoppi/shared";
import { EQUIPMENT_CATEGORY_LABELS } from "@zoppi/shared";
import { useAuth } from "../../AuthContext.js";
import { RegistryCrudPage, type RegistryWizardStep } from "./RegistryCrudPage.js";

const CATEGORY_OPTIONS = Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY: Partial<RegistryEquipment> = { name: "", category: "outro" };

const STEPS: RegistryWizardStep[] = [
  {
    id: "identificacao",
    title: "Identificação",
    color: "var(--color-navy)",
    fields: [
      { key: "name", label: "Nome", required: true },
      { key: "category", label: "Categoria", type: "select", options: CATEGORY_OPTIONS },
      { key: "manufacturer", label: "Fabricante" },
      { key: "model", label: "Modelo" },
      { key: "serial_number", label: "Número de série" },
      { key: "capacity_kgf", label: "Capacidade (kgf)", type: "number" },
    ],
  },
  {
    id: "calibracao",
    title: "Calibração",
    color: "var(--color-orange)",
    description: "O certificado de calibração pode ser anexado depois, na lista.",
    fields: [
      { key: "calibration_issued_at", label: "Calibração emitida em", type: "date" },
      { key: "calibration_expires_at", label: "Calibração válida até", type: "date" },
    ],
  },
  {
    id: "observacoes",
    title: "Observações",
    color: "var(--color-navy-light)",
    fields: [{ key: "notes", label: "Observações", type: "textarea" }],
  },
];

export function RegistryEquipmentPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "zoppi_engineer" || profile?.role === "company_admin";

  return (
    <RegistryCrudPage<RegistryEquipment>
      title="Equipamentos"
      description="Instrumentos de ensaio e outros equipamentos usados em campo (dinamômetros, trenas, torquímetros) com controle de calibração. Um Engenheiro Zoppi que cadastra aqui registra o próprio equipamento — usado em qualquer empresa que ele atenda."
      endpoint="/registry/equipment"
      canEdit={canEdit}
      emptyForm={EMPTY}
      steps={STEPS}
      ownershipMode="personal-for-engineer"
      searchFields={["name", "manufacturer", "model", "serial_number"]}
      filterSelect={{ key: "category", label: "Categoria", options: CATEGORY_OPTIONS }}
      documentField={{ pathKey: "calibration_certificate_path", urlKey: "calibration_certificate_url", label: "Certificado de calibração" }}
      renderSummary={(row) => ({
        heading: row.name,
        lines: [
          [EQUIPMENT_CATEGORY_LABELS[row.category], row.manufacturer, row.model].filter(Boolean).join(" · "),
          row.calibration_expires_at ? `Calibração válida até ${row.calibration_expires_at}` : "",
        ].filter((line) => line.length > 0),
      })}
    />
  );
}
