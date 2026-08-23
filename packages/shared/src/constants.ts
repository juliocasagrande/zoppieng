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

export const REPORT_NAME_PRESETS = [
  "Laudo de Inspeção de Pontos de Ancoragem",
  "Laudo de Instalação de Linha de Vida",
  "Laudo de Recertificação de Pontos de Ancoragem",
];

export const USER_ROLE_LABELS: Record<string, string> = {
  zoppi_admin: "Zoppi Admin",
  zoppi_engineer: "Zoppi Engenheiro",
  company_admin: "Admin da Empresa",
  company_operational: "Operacional",
};
