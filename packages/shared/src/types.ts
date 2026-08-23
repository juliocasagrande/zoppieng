// Domain types shared between apps/api and apps/web.
// These mirror the Postgres schema in supabase/migrations — keep in sync.

export type UserRole =
  | "zoppi_admin"
  | "zoppi_engineer"
  | "company_admin"
  | "company_operational";

export type CompanyKind = "service_provider" | "facility_owner" | "both";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

export type ReportStatus =
  | "draft"
  | "awaiting_field"
  | "in_review"
  | "changes_requested"
  | "signed"
  | "delivered"
  | "rejected";

export type FieldLinkStatus = "pending" | "used" | "expired" | "revoked";

export type FieldLinkPurpose = "initial" | "correction";

export type ReportPartyRole = "contratante" | "contratada";

export type AccessoryScope = "zoppi_standard" | "company_custom";

export type InstallationMode = "quimico" | "mecanico";

export type PullTestResult = "aprovado" | "atencao" | "reprovado";

export type NotificationChannel = "email" | "whatsapp";

export interface Company {
  id: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string;
  kind: CompanyKind;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  company_id: string | null;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  crea_number: string | null;
  active: boolean;
}

export interface ModuleSubscription {
  id: string;
  company_id: string;
  module_id: string;
  status: SubscriptionStatus;
  plan_code: string;
  monthly_amount_cents: number;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
}

export interface Report {
  id: string;
  module_id: string;
  company_id: string;
  name: string;
  status: ReportStatus;
  site_address: string | null;
  site_identification: string | null;
  assigned_engineer_id: string | null;
  issued_at: string | null;
  valid_until: string | null;
  report_number: string | null;
  pdf_url: string | null;
  labels_pdf_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportParty {
  id: string;
  report_id: string;
  role: ReportPartyRole;
  company_id: string | null;
  legal_name: string;
  cnpj: string | null;
  address: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface AccessoryCatalogItem {
  id: string;
  scope: AccessoryScope;
  company_id: string | null;
  name: string;
  category: string;
  manufacturer: string | null;
  spec_diameter_mm: number | null;
  spec_load_capacity_kn: number | null;
  spec_notes: string | null;
  active: boolean;
}

export interface AnchorPoint {
  id: string;
  report_id: string;
  tag: string;
  accessory_id: string | null;
  installation_mode: InstallationMode | null;
  anchor_depth_mm: number | null;
  distance_between_points_mm: number | null;
  test_instrument: string | null;
  test_applied_load_kn: number | null;
  test_duration_seconds: number | null;
  test_result: PullTestResult | null;
  notes: string | null;
  issue_tags: string[];
  sort_order: number;
}

export interface Photo {
  id: string;
  report_id: string;
  anchor_point_id: string | null;
  storage_path: string;
  is_extra: boolean;
  caption: string | null;
  sort_order: number;
}

export interface ReportFieldLink {
  id: string;
  report_id: string;
  status: FieldLinkStatus;
  purpose: FieldLinkPurpose;
  expires_at: string;
  used_at: string | null;
}

export interface Signature {
  id: string;
  report_id: string;
  engineer_id: string;
  provider: string;
  provider_reference: string | null;
  document_hash: string;
  signed_at: string;
}

export interface BestPracticeContent {
  id: string;
  module_id: string | null;
  slug: string;
  title: string;
  body_html: string;
  summary: string | null;
  step_context: string | null;
  sort_order: number;
  active: boolean;
}
