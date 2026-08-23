export const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  awaiting_field: "Aguardando campo",
  in_review: "Em revisão",
  changes_requested: "Correção solicitada",
  signed: "Assinado",
  delivered: "Entregue",
  rejected: "Rejeitado",
};

export const REPORT_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  draft: "info",
  awaiting_field: "warning",
  in_review: "info",
  changes_requested: "warning",
  signed: "success",
  delivered: "success",
  rejected: "danger",
};

export const PULL_TEST_RESULT_LABELS: Record<string, string> = {
  aprovado: "Aprovado",
  atencao: "Atenção",
  reprovado: "Reprovado",
};

export const PULL_TEST_RESULT_TONE: Record<string, "success" | "warning" | "danger"> = {
  aprovado: "success",
  atencao: "warning",
  reprovado: "danger",
};

// NBR 16325-1 device classification, offered to the field technician per
// anchor point (spec: laudo must state the device type tested, e.g. "Tipo A1").
export const ANCHOR_DEVICE_TYPE_LABELS: Record<string, string> = {
  A: "Tipo A — ponto de ancoragem fixo simples",
  A1: "Tipo A1 — olhal/estrutura rígida certificada",
  B: "Tipo B — múltiplos pontos fixos interligados",
  C: "Tipo C — linha de vida flexível horizontal",
  D: "Tipo D — trilho rígido horizontal",
};

// Fallback PDF brand — used whenever a company hasn't set its own logo/colors.
export const DEFAULT_BRAND_PRIMARY_COLOR = "#151F5C";
export const DEFAULT_BRAND_SECONDARY_COLOR = "#E86020";

export const REPORT_NAME_PRESETS = [
  "Laudo de Inspeção de Pontos de Ancoragem",
  "Laudo de Instalação de Linha de Vida",
  "Laudo de Recertificação de Pontos de Ancoragem",
];

// Checklist offered to the field technician for each anchor point (spec
// section 4.4 "observações" + checkbox capture requested for the field flow).
export const ANCHOR_ISSUE_TAGS = [
  { value: "corrosao", label: "Corrosão visível" },
  { value: "fixacao_solta", label: "Fixação solta ou com folga" },
  { value: "trinca_concreto", label: "Trinca ou rachadura no concreto" },
  { value: "impacto_deformacao", label: "Sinais de impacto ou deformação" },
  { value: "rosca_danificada", label: "Rosca danificada" },
  { value: "identificacao_ausente", label: "Etiqueta/identificação ausente ou ilegível" },
] as const;

export const USER_ROLE_LABELS: Record<string, string> = {
  zoppi_admin: "Zoppi Admin",
  zoppi_engineer: "Zoppi Engenheiro",
  company_admin: "Admin da Empresa",
  company_operational: "Operacional",
};
