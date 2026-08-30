import { useEffect, useRef, useState } from "react";
import type { AppUser, CnpjLookupResult, Company } from "@zoppi/shared";
import { api } from "../../../lib/api.js";
import { useAuth } from "../../AuthContext.js";
import { Card } from "../../../shared/components/Card.js";
import { Button } from "../../../shared/components/Button.js";
import { FormField, inputStyle } from "../../../shared/components/FormField.js";
import { CnpjLookupField } from "../../../shared/components/CnpjLookupField.js";
import { SearchInput } from "../../../shared/components/SearchInput.js";
import { Skeleton } from "../../../shared/components/Skeleton.js";
import { Alert } from "../../../shared/components/Alert.js";
import { Modal } from "../../../shared/components/Modal.js";
import { Section, StepPills, type WizardStep } from "../../../shared/components/WizardParts.js";

type FieldType = "text" | "textarea" | "select" | "date" | "number" | "cnpj";

export interface RegistryFieldConfig {
  key: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  // Only used when type === "cnpj": maps the CNPJ lookup result onto other
  // fields of the same form (e.g. legal name, address) in one go.
  onCnpjResult?: (result: CnpjLookupResult) => Record<string, unknown>;
}

// One page of the creation wizard (see RegistryWizardModal) — the same
// fields also get flattened for the plain inline edit form below, so a field
// is only ever defined once.
export interface RegistryWizardStep {
  id: string;
  title: string;
  color: string;
  description?: string;
  fields: RegistryFieldConfig[];
}

export interface RegistryDocumentFieldConfig {
  pathKey: string;
  urlKey: string;
  label: string;
  accept?: string;
}

// Engineers/equipment/vehicles have a *dual* owner (see
// supabase/migrations/0017_registry_ownership.sql): either a subscriber
// company, or — when a zoppi_engineer created it — the engineer personally.
// A company can *see* an engineer's personal record (if that engineer has
// served them — see registry/routes.ts attendedEngineerIds), but only the
// actual owner (or zoppi_admin) can edit it. Exported so the bespoke
// "Documentação" tab in RegistryEngineers.tsx (which manages its own list
// outside RegistryCrudPage) can apply the exact same rule.
export function isOwnedByViewer(
  row: { company_id?: string | null; owner_user_id?: string | null },
  profile: Pick<AppUser, "role" | "id" | "company_id"> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === "zoppi_admin") return true;
  if (row.owner_user_id) return row.owner_user_id === profile.id;
  if (row.company_id) return row.company_id === profile.company_id;
  return false;
}

// Generic list+wizard-create+inline-edit screen shared by the "Cadastro"
// registries (clients, suppliers, service providers, engineers, equipment,
// vehicles). Editing reuses the flat AccessoryCatalog.tsx-style Card form;
// creation walks through `steps` in a Modal, same shell as ReportWizard.tsx.
export function RegistryCrudPage<Row extends { id: string; active?: boolean; company_id?: string | null; owner_user_id?: string | null }>({
  title,
  description,
  endpoint,
  steps,
  emptyForm,
  documentField,
  canEdit,
  ownershipMode = "company",
  searchFields,
  filterSelect,
  renderSummary,
}: {
  title: string;
  description?: string;
  endpoint: string;
  steps: RegistryWizardStep[];
  emptyForm: Record<string, unknown>;
  documentField?: RegistryDocumentFieldConfig;
  canEdit: boolean;
  // "personal-for-engineer": a zoppi_engineer creating one of these owns it
  // personally (no company picker — see isOwnedByViewer above); a
  // company_admin still creates their own company's, unchanged.
  ownershipMode?: "company" | "personal-for-engineer";
  // Row keys checked (case-insensitive substring) against the search box.
  searchFields?: string[];
  // One extra entity-specific select filter (category/kind/document type) —
  // reuses whatever option list the page already defines for its form.
  filterSelect?: { key: string; label: string; options: { value: string; label: string }[] };
  renderSummary: (row: Row) => { heading: string; lines: string[] };
}) {
  const { profile } = useAuth();
  // Only zoppi_admin picks "which company" — a zoppi_engineer never does:
  // for the 3 plain company-owned registries they have no write access at
  // all (see Sidebar.tsx/pages' canEdit), and for the personal-ownership
  // ones their record is automatically their own, no picker needed.
  const isZoppiAdmin = profile?.role === "zoppi_admin";
  const [companies, setCompanies] = useState<Company[]>([]);
  useEffect(() => {
    if (isZoppiAdmin) api.get("/companies").then(setCompanies).catch(() => {});
  }, [isZoppiAdmin]);
  const companyField: RegistryFieldConfig | undefined = isZoppiAdmin
    ? {
        key: "company_id",
        // Spelled out (not just "Empresa") because this only appears for
        // Zoppi staff, who don't belong to a company themselves — it picks
        // which subscriber account this Cadastro record is being created for.
        label: "Empresa assinante (dona deste cadastro)",
        type: "select",
        required: true,
        options: companies.map((c) => ({ value: c.id, label: c.legal_name })),
      }
    : undefined;

  const fields = steps.flatMap((s) => s.fields);

  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectFilterValue, setSelectFilterValue] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    api
      .get(endpoint)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }
  useEffect(reload, [endpoint]);

  function patchForm(partial: Record<string, unknown>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function startEdit(row: Row) {
    setWizardOpen(false);
    setEditingId(row.id);
    setForm(row as unknown as Record<string, unknown>);
    setShowForm(true);
    setError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`${endpoint}/${editingId}`, form);
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleWizardSubmit(wizardForm: Record<string, unknown>) {
    setCreating(true);
    setCreateError(null);
    try {
      await api.post(endpoint, wizardForm);
      setWizardOpen(false);
      reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(row: Row) {
    await api.delete(`${endpoint}/${row.id}`);
    reload();
  }

  async function handleToggleActive(row: Row) {
    await api.patch(`${endpoint}/${row.id}`, { active: !row.active });
    reload();
  }

  async function handleDocumentUpload(row: Row, file: File) {
    if (!documentField) return;
    setUploadingId(row.id);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const { path, signedUrl } = await api.post(`${endpoint}/${row.id}/document-upload-url`, { ext });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      await api.patch(`${endpoint}/${row.id}`, { [documentField.pathKey]: path });
      reload();
    } finally {
      setUploadingId(null);
    }
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredItems = items.filter((row) => {
    if (activeFilter === "active" && row.active === false) return false;
    if (activeFilter === "inactive" && row.active !== false) return false;
    if (filterSelect && selectFilterValue && (row as unknown as Record<string, unknown>)[filterSelect.key] !== selectFilterValue) return false;
    if (searchTerm && searchFields) {
      const haystack = searchFields
        .map((key) => String((row as unknown as Record<string, unknown>)[key] ?? ""))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <h1>{title}</h1>
          {description && (
            <p className="zp-eyebrow" style={{ maxWidth: 560 }}>
              {description}
            </p>
          )}
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setShowForm(false);
              setCreateError(null);
              setWizardOpen(true);
            }}
          >
            Novo cadastro
          </Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {searchFields && <SearchInput value={search} onChange={setSearch} placeholder={`Buscar em ${title.toLowerCase()}...`} />}
        {filterSelect && (
          <select style={{ ...inputStyle, flex: "0 1 200px" }} value={selectFilterValue} onChange={(e) => setSelectFilterValue(e.target.value)}>
            <option value="">{filterSelect.label} — todos</option>
            {filterSelect.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        <select
          style={{ ...inputStyle, flex: "0 1 160px" }}
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
        >
          <option value="all">Ativos e inativos</option>
          <option value="active">Só ativos</option>
          <option value="inactive">Só inativos</option>
        </select>
      </div>

      {wizardOpen && (
        <RegistryWizardModal
          title={title}
          steps={steps}
          initialForm={{ ...emptyForm, ...(companyField ? { company_id: "" } : {}) }}
          companyField={companyField}
          saving={creating}
          error={createError}
          onSubmit={handleWizardSubmit}
          onClose={() => setWizardOpen(false)}
        />
      )}

      {showForm && (
        <Card style={{ marginBottom: 24 }}>
          <form onSubmit={handleEditSubmit}>
            {error && (
              <div style={{ marginBottom: 16 }}>
                <Alert tone="danger">{error}</Alert>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {fields.map((field) => (
                <RegistryField key={field.key} field={field} form={form} onChange={patchForm} />
              ))}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <Skeleton height={14} width="40%" style={{ marginBottom: 8 }} />
                <Skeleton height={11} width="60%" />
              </Card>
            ))
          : filteredItems.map((row) => (
              <RegistryRow
                key={row.id}
                row={row}
                summary={renderSummary(row)}
                editable={ownershipMode === "personal-for-engineer" ? canEdit && isOwnedByViewer(row, profile) : canEdit}
                ownershipBadge={ownershipMode === "personal-for-engineer"}
                documentField={documentField}
                uploading={uploadingId === row.id}
                onEdit={() => startEdit(row)}
                onDelete={() => handleDelete(row)}
                onToggleActive={() => handleToggleActive(row)}
                onDocumentUpload={(file) => handleDocumentUpload(row, file)}
              />
            ))}
        {!loading && items.length === 0 && <p style={{ color: "var(--color-gray)" }}>Nenhum registro cadastrado ainda.</p>}
        {!loading && items.length > 0 && filteredItems.length === 0 && (
          <p style={{ color: "var(--color-gray)" }}>Nenhum registro encontrado para esse filtro.</p>
        )}
      </div>
    </div>
  );
}

// Multi-step creation dialog — same shell as ReportWizard.tsx (Modal +
// StepPills + Section), generalized so any Cadastro entity can plug in its
// own steps without rebuilding the wizard chrome. The review step is
// generic (label: value for every filled field) rather than a custom
// summary per entity, since there are six of these.
function RegistryWizardModal({
  title,
  steps,
  initialForm,
  companyField,
  saving,
  error,
  onSubmit,
  onClose,
}: {
  title: string;
  steps: RegistryWizardStep[];
  initialForm: Record<string, unknown>;
  companyField?: RegistryFieldConfig;
  saving: boolean;
  error: string | null;
  onSubmit: (form: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const effectiveSteps = companyField ? [{ ...steps[0], fields: [companyField, ...steps[0].fields] }, ...steps.slice(1)] : steps;
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [form, setForm] = useState<Record<string, unknown>>(initialForm);

  const isReview = stepIndex === effectiveSteps.length;
  const currentStep = effectiveSteps[stepIndex];
  const reviewColor = effectiveSteps[effectiveSteps.length - 1]?.color ?? "var(--color-orange)";
  const pillSteps: WizardStep<string>[] = [
    ...effectiveSteps.map((s) => ({ id: s.id, title: s.title, color: s.color })),
    { id: "review", title: "Revisão", color: reviewColor },
  ];

  function patchForm(partial: Record<string, unknown>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function isStepValid(step: RegistryWizardStep) {
    return step.fields.every((f) => !f.required || String(form[f.key] ?? "").trim().length > 0);
  }

  function goTo(index: number) {
    if (index > maxReached) return;
    setStepIndex(index);
  }

  function goNext() {
    if (currentStep && !isStepValid(currentStep)) return;
    const next = Math.min(stepIndex + 1, effectiveSteps.length);
    setStepIndex(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <Modal
      title={`Novo cadastro — ${title}`}
      subtitle={isReview ? "Revisão" : currentStep?.title}
      accentColor={isReview ? reviewColor : currentStep?.color}
      onClose={onClose}
      progress={{ current: stepIndex + 1, total: pillSteps.length }}
      width={680}
      footer={
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0} style={{ flex: "1 1 120px" }}>
            ← Voltar
          </Button>
          {isReview ? (
            <Button type="button" onClick={() => onSubmit(form)} disabled={saving} style={{ flex: "2 1 160px" }}>
              {saving ? "Salvando..." : "Criar cadastro"}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} style={{ flex: "2 1 160px" }}>
              Próximo →
            </Button>
          )}
        </div>
      }
    >
      <StepPills steps={pillSteps} current={stepIndex} maxReached={maxReached} onSelect={goTo} />

      {error && (
        <div style={{ margin: "16px 0" }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {isReview ? (
          <Section color={reviewColor} title="Confira antes de salvar">
            <div style={{ display: "grid", gap: 8 }}>
              {effectiveSteps
                .flatMap((s) => s.fields)
                .map((field) => {
                  const raw = form[field.key];
                  if (raw === undefined || raw === null || raw === "") return null;
                  const display = field.type === "select" ? field.options?.find((o) => o.value === raw)?.label ?? String(raw) : String(raw);
                  return (
                    <div
                      key={field.key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        borderBottom: "1px solid var(--color-gray-light)",
                        paddingBottom: 6,
                      }}
                    >
                      <span className="zp-eyebrow">{field.label}</span>
                      <span>{display}</span>
                    </div>
                  );
                })}
            </div>
          </Section>
        ) : (
          currentStep && (
            <Section color={currentStep.color} title={currentStep.title} description={currentStep.description}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                {currentStep.fields.map((field) => (
                  <RegistryField key={field.key} field={field} form={form} onChange={patchForm} />
                ))}
              </div>
            </Section>
          )
        )}
      </div>
    </Modal>
  );
}

function RegistryField({
  field,
  form,
  onChange,
}: {
  field: RegistryFieldConfig;
  form: Record<string, unknown>;
  onChange: (partial: Record<string, unknown>) => void;
}) {
  const value = (form[field.key] as string | number | null | undefined) ?? "";

  if (field.type === "cnpj") {
    return (
      <CnpjLookupField
        value={String(value)}
        onChange={(v) => onChange({ [field.key]: v })}
        onResult={(result) => onChange({ [field.key]: result.cnpj, ...(field.onCnpjResult?.(result) ?? {}) })}
      />
    );
  }

  if (field.type === "select") {
    return (
      <FormField label={field.label}>
        <select style={inputStyle} value={String(value)} onChange={(e) => onChange({ [field.key]: e.target.value })}>
          {value === "" && <option value="">Selecione...</option>}
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }

  if (field.type === "textarea") {
    return (
      <FormField label={field.label}>
        <textarea
          style={{ ...inputStyle, minHeight: 70, gridColumn: "1 / -1" }}
          value={String(value)}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
        />
      </FormField>
    );
  }

  return (
    <FormField label={field.label}>
      <input
        style={inputStyle}
        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        required={field.required}
        value={value}
        onChange={(e) => onChange({ [field.key]: field.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })}
      />
    </FormField>
  );
}

function RegistryRow<Row extends { id: string; active?: boolean; company_id?: string | null; owner_user_id?: string | null }>({
  row,
  summary,
  editable,
  ownershipBadge,
  documentField,
  uploading,
  onEdit,
  onDelete,
  onToggleActive,
  onDocumentUpload,
}: {
  row: Row;
  summary: { heading: string; lines: string[] };
  editable: boolean;
  ownershipBadge: boolean;
  documentField?: RegistryDocumentFieldConfig;
  uploading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onDocumentUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentUrl = documentField ? (row as unknown as Record<string, unknown>)[documentField.urlKey] : null;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <strong>{summary.heading}</strong>
          {row.active === false && <span className="zp-eyebrow" style={{ marginLeft: 8, color: "var(--color-gray)" }}>Inativo</span>}
          {ownershipBadge && (
            <span className="zp-eyebrow" style={{ marginLeft: 8, color: "var(--color-orange)" }}>
              {row.owner_user_id ? "Pessoal do engenheiro" : "Da empresa"}
            </span>
          )}
          {summary.lines.map((line, i) => (
            <p key={i} style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--color-gray)" }}>
              {line}
            </p>
          ))}
        </div>
        {editable && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {documentField && (
              <>
                {typeof documentUrl === "string" && documentUrl && (
                  <Button type="button" variant="outline" onClick={() => window.open(documentUrl, "_blank", "noopener")}>
                    Ver {documentField.label.toLowerCase()}
                  </Button>
                )}
                <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? "Enviando..." : documentUrl ? "Substituir arquivo" : "Anexar arquivo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={documentField.accept ?? "application/pdf,image/*"}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onDocumentUpload(file);
                    e.target.value = "";
                  }}
                />
              </>
            )}
            <Button type="button" variant="outline" onClick={onToggleActive}>
              {row.active === false ? "Reativar" : "Inativar"}
            </Button>
            <Button type="button" variant="outline" onClick={onEdit}>
              Editar
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete}>
              Excluir
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
