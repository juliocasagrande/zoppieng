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

// "Finalidade" is the one per-point system-description field that stays a
// curated text pick rather than an image-illustrated catalog entry — a photo
// doesn't help distinguish "restrição" from "retenção de queda", it's a
// declared intent, not something visually identifiable. Grounded in
// NR-35/EN 795 use categories. The other four (tipo do sistema, tipo de
// dispositivo, estrutura suporte, condição ambiental) moved to the
// customizable, image-illustrated field_option_catalog — see
// FieldOptionKey/FieldOptionCatalogItem in types.ts.
export const SYSTEM_PURPOSE_OPTIONS = [
  "Restrição de movimentação",
  "Retenção de queda",
  "Posicionamento no trabalho",
  "Acesso por corda / trabalho suspenso",
  "Resgate",
] as const;

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

// Fixed checklist for master-template section 4 ("VERIFICAÇÃO DE
// IDENTIFICAÇÃO DO DISPOSITIVO") — same five items on every report; the
// engineer fills in situation (C/NC/NA) and observation during review.
export const DEVICE_VERIFICATION_LABELS = [
  "Fabricante / identificação",
  "Modelo / código / série",
  "Material / capacidade indicada",
  "Limite de usuários / força aplicável",
  "Rastreabilidade e documentação",
] as const;

export const VERIFICATION_SITUATION_LABELS: Record<string, string> = {
  C: "Conforme",
  NC: "Não conforme",
  NA: "Não aplicável",
};

export const NONCONFORMITY_SEVERITY_LABELS: Record<string, string> = {
  atencao: "Atenção",
  critica: "Crítica",
};

export const NONCONFORMITY_STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};

// Annex index categories (master template section A) — what the engineer can
// attach to a laudo before finalizing it.
export const ATTACHMENT_CATEGORY_LABELS: Record<string, string> = {
  art: "ART — Anotação de Responsabilidade Técnica",
  calibration_certificate: "Certificado de calibração do instrumento de ensaio",
  site_plan: "Croqui / planta de localização e identificação dos pontos",
  datasheet: "Fichas técnicas e certificados dos dispositivos/acessórios",
  project_memorial: "Projeto / memorial de cálculo / detalhes de fixação",
  lab_report: "Relatórios laboratoriais / resistência / corrosão",
  point_labels: "Etiquetas de identificação dos pontos",
  other: "Outros documentos",
};

export const USER_ROLE_LABELS: Record<string, string> = {
  zoppi_admin: "Zoppi Admin",
  zoppi_engineer: "Zoppi Engenheiro",
  company_admin: "Admin da Empresa",
  company_operational: "Operacional",
};
