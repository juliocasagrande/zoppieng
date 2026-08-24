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

// NBR 16325-1 anchor device classification.
export type AnchorDeviceType = "A" | "A1" | "B" | "C" | "D";

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
  logo_path: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  pdf_header_text: string | null;
  pdf_footer_text: string | null;
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
  can_create_reports: boolean;
  signature_path?: string | null;
  signature_url?: string | null;
}

export type AttachmentCategory =
  | "art"
  | "calibration_certificate"
  | "site_plan"
  | "datasheet"
  | "project_memorial"
  | "lab_report"
  | "point_labels"
  | "other";

export interface ReportAttachment {
  id: string;
  report_id: string;
  category: AttachmentCategory;
  label: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface CnpjLookupResult {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  address: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
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

export interface SubscriptionPlan {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  planCode: string;
  planName: string;
  monthlyAmountCents: number;
}

export type VerificationSituation = "C" | "NC" | "NA";

export interface VerificationCheckItem {
  label: string;
  situation: VerificationSituation | null;
  observation: string | null;
}

export interface ReportComponent {
  item: string;
  manufacturerModel: string | null;
  material: string | null;
  lotSerial: string | null;
  document: string | null;
}

export type NonConformitySeverity = "atencao" | "critica";
export type NonConformityStatus = "aberta" | "em_andamento" | "resolvida";

export interface NonConformity {
  id: string;
  pointTag: string | null;
  description: string;
  severity: NonConformitySeverity;
  actionRequired: string | null;
  status: NonConformityStatus;
}

export interface RevisionEntry {
  revision: string;
  date: string | null;
  responsible: string | null;
  description: string | null;
}

export interface InspectionHistoryEntry {
  date: string | null;
  pointOrSystem: string | null;
  responsible: string | null;
  result: string | null;
  documentNote: string | null;
}

export interface Report {
  id: string;
  module_id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: ReportStatus;
  site_address: string | null;
  site_identification: string | null;
  site_area: string | null;
  os_contract_number: string | null;
  survey_date: string | null;
  assigned_engineer_id: string | null;
  issued_at: string | null;
  valid_until: string | null;
  report_number: string | null;
  art_number: string | null;
  revision: string;
  pdf_url: string | null;
  labels_pdf_url: string | null;
  field_executor_name: string | null;
  field_executor_role: string | null;
  field_executor_accepted_at: string | null;
  accompanying_client_name: string | null;
  accompanying_client_role: string | null;
  accompanying_client_accepted_at: string | null;
  test_equipment_manufacturer: string | null;
  test_equipment_model: string | null;
  test_equipment_serial: string | null;
  test_equipment_capacity_kgf: number | null;
  objective_text: string | null;
  scope_text: string | null;
  recommendations_text: string | null;
  conclusion_text: string | null;
  verification_checks: VerificationCheckItem[];
  components: ReportComponent[];
  nonconformities: NonConformity[];
  revisions: RevisionEntry[];
  inspection_history: InspectionHistoryEntry[];
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
  image_path: string | null;
  image_url: string | null;
}

// The four field-wizard selection fields backed by a customizable,
// image-illustrated catalog (see field_option_catalog table). "device_type"
// still defaults to the NBR 16325-1 A/A1/B/C/D classification as Zoppi's
// standard entries, but the column is free text so companies can add their
// own device categories too.
export type FieldOptionKey = "device_type" | "system_type" | "support_structure" | "environment_condition";

export interface FieldOptionCatalogItem {
  id: string;
  field_key: FieldOptionKey;
  scope: AccessoryScope;
  company_id: string | null;
  value: string;
  label: string;
  image_path: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
}

export interface AnchorPoint {
  id: string;
  report_id: string;
  tag: string;
  accessory_id: string | null;
  installation_mode: InstallationMode | null;
  device_type: string | null;
  anchor_depth_mm: number | null;
  distance_between_points_mm: number | null;
  test_instrument: string | null;
  test_reference_load_kgf: number | null;
  test_applied_load_kgf: number | null;
  test_duration_seconds: number | null;
  test_load_direction: string | null;
  test_result: PullTestResult | null;
  result_confirmed_by: string | null;
  result_confirmed_at: string | null;
  fixation_material_reference: string | null;
  // System description (docx master template section 4) — captured per
  // point because different anchors on the same laudo can sit on different
  // structures/finalities, not once per report.
  system_type: string | null;
  system_purpose: string | null;
  capacity_users: string | null;
  support_structure: string | null;
  fixation_mode_detail: string | null;
  environment_condition: string | null;
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
