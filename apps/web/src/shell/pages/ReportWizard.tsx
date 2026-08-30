import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatCnpj, REPORT_NAME_PRESETS, type CnpjLookupResult, type Company } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Button } from "../../shared/components/Button.js";
import { Alert } from "../../shared/components/Alert.js";
import { Modal } from "../../shared/components/Modal.js";
import { CnpjLookupField } from "../../shared/components/CnpjLookupField.js";
import { Section, StepPills } from "../../shared/components/WizardParts.js";

const CUSTOM_NAME = "__custom__";

interface SavedParty {
  legalName: string;
  cnpj: string | null;
  address: string | null;
  contactName: string | null;
  contactRole: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

interface SavedSite {
  siteIdentification: string;
  siteAddress: string | null;
}

interface PartyState {
  legalName: string;
  cnpj: string;
  address: string;
}

const emptyParty: PartyState = { legalName: "", cnpj: "", address: "" };

type StepId = "name" | "contratada" | "contratante" | "site" | "review";

// Each step carries an accent color (drawn only from design tokens — see
// tokens.css) so the modal's title, progress bar and section header visually
// change as the user moves through the wizard, making section boundaries
// obvious at a glance.
const STEPS: { id: StepId; title: string; color: string }[] = [
  { id: "name", title: "Nome do laudo", color: "var(--color-navy)" },
  { id: "contratada", title: "Contratada", color: "var(--color-orange)" },
  { id: "contratante", title: "Contratante", color: "var(--color-navy-light)" },
  { id: "site", title: "Local", color: "var(--color-success)" },
  { id: "review", title: "Revisão", color: "var(--color-orange)" },
];

// ART and O.S./contrato are entered by the engineer during review (only
// known once someone with technical responsibility looks at the job), not
// here at report creation — see ReportDetail.tsx's ReviewDetailsEditor. The
// per-point system description (tipo/finalidade/capacidade/estrutura/
// fixação/condição ambiental) is captured by the field technician per anchor
// point — see FieldWizard.tsx — since it can vary point to point.
interface SiteExtraState {
  siteArea: string;
  surveyDate: string;
}

const emptySiteExtra: SiteExtraState = { siteArea: "", surveyDate: "" };

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

export function ReportWizardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetFromQuery = searchParams.get("preset");
  const initialNamePreset =
    presetFromQuery && (REPORT_NAME_PRESETS as readonly string[]).includes(presetFromQuery) ? presetFromQuery : REPORT_NAME_PRESETS[0];
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [namePreset, setNamePreset] = useState(initialNamePreset);
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState(profile?.company_id ?? "");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [siteAddress, setSiteAddress] = useState("");
  const [siteIdentification, setSiteIdentification] = useState("");
  const [contratante, setContratante] = useState<PartyState>(emptyParty);
  const [contratada, setContratada] = useState<PartyState>(emptyParty);
  const [siteExtra, setSiteExtra] = useState<SiteExtraState>(emptySiteExtra);
  const [savedContratantes, setSavedContratantes] = useState<SavedParty[]>([]);
  const [savedContratadas, setSavedContratadas] = useState<SavedParty[]>([]);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.company_id) setCompanyId(profile.company_id);
    if (profile?.role === "zoppi_admin" || profile?.role === "zoppi_engineer") {
      api.get("/companies").then((data: Company[]) => setCompanies(data ?? [])).catch(() => {});
    }
    api
      .get("/reports/parties/saved")
      .then((data: { contratante: SavedParty[]; contratada: SavedParty[] }) => {
        setSavedContratantes(data.contratante ?? []);
        setSavedContratadas(data.contratada ?? []);
      })
      .catch(() => {});
    api
      .get("/reports/sites/saved")
      .then((data: SavedSite[]) => setSavedSites(data ?? []))
      .catch(() => {});
  }, [profile?.company_id, profile?.role]);

  function selectSaved(legalName: string | null, setParty: (p: PartyState) => void, list: SavedParty[]) {
    if (!legalName) {
      setParty(emptyParty);
      return;
    }
    const match = list.find((p) => p.legalName === legalName);
    if (match) setParty({ legalName: match.legalName, cnpj: match.cnpj ?? "", address: match.address ?? "" });
  }

  function selectSavedSite(identification: string | null) {
    if (!identification) {
      setSiteIdentification("");
      setSiteAddress("");
      return;
    }
    const match = savedSites.find((s) => s.siteIdentification === identification);
    if (match) {
      setSiteIdentification(match.siteIdentification);
      setSiteAddress(match.siteAddress ?? "");
    }
  }

  function isStepValid(id: StepId): boolean {
    if (id === "name") return companyId.length > 0 && (namePreset !== CUSTOM_NAME || customName.trim().length > 0);
    if (id === "contratada") return contratada.legalName.trim().length > 0;
    if (id === "contratante") return contratante.legalName.trim().length > 0;
    return true;
  }

  function goTo(index: number) {
    if (index > maxReached) return;
    setError(null);
    setStepIndex(index);
  }

  function goNext() {
    if (!isStepValid(STEPS[stepIndex].id)) {
      setError("Preencha os campos obrigatórios para continuar.");
      return;
    }
    setError(null);
    // Leaving "contratante" for "local": the inspection site is usually the
    // contratante's own facility, so pre-fill from it instead of asking the
    // same address twice — only when the user hasn't touched the site
    // fields yet (a saved-site chip or manual typing always wins).
    if (STEPS[stepIndex].id === "contratante" && !siteIdentification && !siteAddress) {
      setSiteIdentification(contratante.legalName);
      setSiteAddress(contratante.address);
    }
    const next = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    if (!companyId) {
      setError("Seu usuário não está vinculado a uma empresa assinante.");
      return;
    }
    if (!isStepValid("name") || !isStepValid("contratada") || !isStepValid("contratante")) {
      setError("Existem campos obrigatórios não preenchidos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await api.post("/reports", {
        companyId,
        name: namePreset === CUSTOM_NAME ? customName : namePreset,
        description: description || undefined,
        siteAddress,
        siteIdentification,
        siteArea: siteExtra.siteArea || undefined,
        surveyDate: siteExtra.surveyDate || undefined,
        contratante: { legalName: contratante.legalName, cnpj: contratante.cnpj || undefined, address: contratante.address || undefined },
        contratada: { legalName: contratada.legalName, cnpj: contratada.cnpj || undefined, address: contratada.address || undefined },
      });
      navigate(`/app/reports/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar laudo");
    } finally {
      setLoading(false);
    }
  }

  const step = STEPS[stepIndex];
  const reportName = namePreset === CUSTOM_NAME ? customName : namePreset;

  return (
    <Modal
      title="Novo laudo de Ancoragem"
      subtitle={step.title}
      accentColor={step.color}
      onClose={() => navigate("/app/reports")}
      progress={{ current: stepIndex + 1, total: STEPS.length }}
      width={760}
      footer={
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0} style={{ flex: "1 1 140px" }}>
            ← Voltar
          </Button>
          {step.id === "review" ? (
            <Button type="button" onClick={handleSubmit} disabled={loading} style={{ flex: "2 1 200px", background: step.color, borderColor: step.color }}>
              {loading ? "Criando…" : "Criar laudo"}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} style={{ flex: "2 1 200px", background: step.color, borderColor: step.color }}>
              Próximo →
            </Button>
          )}
        </div>
      }
    >
      <StepPills<StepId> steps={STEPS} current={stepIndex} maxReached={maxReached} onSelect={goTo} />

      {error && (
        <div style={{ margin: "16px 0" }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {step.id === "name" && (
          <Section color={step.color} title="Nome do laudo" description="Como esse laudo vai aparecer na lista e nos documentos.">
            {(profile?.role === "zoppi_admin" || profile?.role === "zoppi_engineer") && (
              <FormField label="Empresa assinante">
                <select style={inputStyle} required value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">Selecione a empresa...</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.legal_name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="Nome do laudo">
              <select style={inputStyle} value={namePreset} onChange={(e) => setNamePreset(e.target.value)}>
                {REPORT_NAME_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
                <option value={CUSTOM_NAME}>Personalizado…</option>
              </select>
            </FormField>
            {namePreset === CUSTOM_NAME && (
              <FormField label="Nome personalizado">
                <input style={inputStyle} value={customName} onChange={(e) => setCustomName(e.target.value)} autoFocus />
              </FormField>
            )}
            <FormField label="Descrição breve (opcional — o que é/para que serve este laudo)">
              <textarea
                style={{ ...inputStyle, minHeight: 80 }}
                placeholder="Ex.: Inspeção anual dos pontos de ancoragem do telhado do galpão 2…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </Section>
        )}

        {step.id === "contratada" && (
          <PartyFields
            color={step.color}
            title="Empresa onde será feito o laudo (contratada)"
            saved={savedContratadas}
            party={contratada}
            onSelectSaved={(name) => selectSaved(name, setContratada, savedContratadas)}
            onChange={setContratada}
          />
        )}

        {step.id === "contratante" && (
          <PartyFields
            color={step.color}
            title="Empresa contratante"
            saved={savedContratantes}
            party={contratante}
            onSelectSaved={(name) => selectSaved(name, setContratante, savedContratantes)}
            onChange={setContratante}
          />
        )}

        {step.id === "site" && (
          <SiteFields
            color={step.color}
            saved={savedSites}
            siteIdentification={siteIdentification}
            siteAddress={siteAddress}
            siteExtra={siteExtra}
            onSelectSaved={selectSavedSite}
            onChangeIdentification={setSiteIdentification}
            onChangeAddress={setSiteAddress}
            onChangeExtra={setSiteExtra}
          />
        )}

        {step.id === "review" && (
          <ReviewStep
            color={step.color}
            reportName={reportName}
            contratada={contratada}
            contratante={contratante}
            siteIdentification={siteIdentification}
            siteAddress={siteAddress}
            onEdit={goTo}
          />
        )}
      </div>
    </Modal>
  );
}

// Saved records from past reports render as selectable chips instead of a
// plain <select> — easier to scan and it's obvious that clicking one reuses
// its data.
function SavedChips<T extends { legalName?: string; siteIdentification?: string }>({
  items,
  getLabel,
  getKey,
  selectedKey,
  onSelect,
  newLabel,
}: {
  items: T[];
  getLabel: (item: T) => string;
  getKey: (item: T) => string;
  selectedKey: string;
  onSelect: (key: string | null) => void;
  newLabel: string;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="zp-eyebrow" style={{ marginBottom: 8 }}>
        Reutilizar dados já cadastrados
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={() => onSelect(null)}
          style={{
            padding: "8px 14px",
            borderRadius: 20,
            border: `1.5px dashed ${selectedKey === "" ? "var(--color-orange)" : "var(--color-gray-light)"}`,
            background: "var(--color-white)",
            color: selectedKey === "" ? "var(--color-orange)" : "var(--color-gray)",
            fontWeight: 600,
            fontSize: "0.82rem",
            cursor: "pointer",
          }}
        >
          {newLabel}
        </button>
        {items.map((item) => {
          const key = getKey(item);
          const active = selectedKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: `1.5px solid ${active ? "var(--color-navy)" : "var(--color-gray-light)"}`,
                background: active ? "rgba(29,43,127,0.08)" : "var(--color-white)",
                color: active ? "var(--color-navy)" : "var(--color-text)",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {getLabel(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PartyFields({
  color,
  title,
  saved,
  party,
  onSelectSaved,
  onChange,
}: {
  color: string;
  title: string;
  saved: SavedParty[];
  party: PartyState;
  onSelectSaved: (legalName: string | null) => void;
  onChange: (party: PartyState) => void;
}) {
  return (
    <Section color={color} title={title} description="Preencha o CNPJ para buscar os dados automaticamente, ou reutilize uma empresa já cadastrada.">
      <SavedChips
        items={saved}
        getLabel={(p) => p.legalName}
        getKey={(p) => p.legalName}
        selectedKey={saved.some((p) => p.legalName === party.legalName) ? party.legalName : ""}
        onSelect={onSelectSaved}
        newLabel="+ Nova empresa"
      />
      <CnpjLookupField
        value={party.cnpj}
        onChange={(cnpj) => onChange({ ...party, cnpj })}
        onResult={(result: CnpjLookupResult) =>
          onChange({
            legalName: result.legalName || party.legalName,
            cnpj: result.cnpj,
            address: result.address || party.address,
          })
        }
      />
      <FormField label="Razão social">
        <input style={inputStyle} value={party.legalName} onChange={(e) => onChange({ ...party, legalName: e.target.value })} />
      </FormField>
      <FormField label="Endereço">
        <input style={inputStyle} value={party.address} onChange={(e) => onChange({ ...party, address: e.target.value })} />
      </FormField>
    </Section>
  );
}

function SiteFields({
  color,
  saved,
  siteIdentification,
  siteAddress,
  siteExtra,
  onSelectSaved,
  onChangeIdentification,
  onChangeAddress,
  onChangeExtra,
}: {
  color: string;
  saved: SavedSite[];
  siteIdentification: string;
  siteAddress: string;
  siteExtra: SiteExtraState;
  onSelectSaved: (identification: string | null) => void;
  onChangeIdentification: (v: string) => void;
  onChangeAddress: (v: string) => void;
  onChangeExtra: (s: SiteExtraState) => void;
}) {
  return (
    <Section color={color} title="Local onde será feito o laudo">
      <SavedChips
        items={saved}
        getLabel={(s) => s.siteIdentification}
        getKey={(s) => s.siteIdentification}
        selectedKey={saved.some((s) => s.siteIdentification === siteIdentification) ? siteIdentification : ""}
        onSelect={onSelectSaved}
        newLabel="+ Novo local"
      />
      <div style={gridStyle}>
        <FormField label="Identificação da obra/planta">
          <input style={inputStyle} value={siteIdentification} onChange={(e) => onChangeIdentification(e.target.value)} />
        </FormField>
        <FormField label="Endereço do local">
          <input style={inputStyle} value={siteAddress} onChange={(e) => onChangeAddress(e.target.value)} />
        </FormField>
        <FormField label="Área / pavimento (opcional)">
          <input style={inputStyle} value={siteExtra.siteArea} onChange={(e) => onChangeExtra({ ...siteExtra, siteArea: e.target.value })} />
        </FormField>
        <FormField label="Data do levantamento (opcional)">
          <input style={inputStyle} type="date" value={siteExtra.surveyDate} onChange={(e) => onChangeExtra({ ...siteExtra, surveyDate: e.target.value })} />
        </FormField>
      </div>
    </Section>
  );
}

function ReviewStep({
  color,
  reportName,
  contratada,
  contratante,
  siteIdentification,
  siteAddress,
  onEdit,
}: {
  color: string;
  reportName: string;
  contratada: PartyState;
  contratante: PartyState;
  siteIdentification: string;
  siteAddress: string;
  onEdit: (index: number) => void;
}) {
  return (
    <Section color={color} title="Revise antes de criar" description="Toque em “Editar” em qualquer cartão para corrigir. ART, O.S./contrato e a descrição técnica do sistema são preenchidas depois, na revisão de engenharia e em campo.">
      <div style={{ display: "grid", gap: 12 }}>
        <ReviewRow title="Nome do laudo" onEdit={() => onEdit(0)}>
          <p style={{ margin: 0 }}>{reportName || "—"}</p>
        </ReviewRow>
        <ReviewRow title="Contratada" onEdit={() => onEdit(1)}>
          <PartySummary party={contratada} />
        </ReviewRow>
        <ReviewRow title="Contratante" onEdit={() => onEdit(2)}>
          <PartySummary party={contratante} />
        </ReviewRow>
        <ReviewRow title="Local" onEdit={() => onEdit(3)}>
          <p style={{ margin: 0 }}>{siteIdentification || "—"}</p>
          {siteAddress && <p style={{ margin: "2px 0 0", color: "var(--color-gray)" }}>{siteAddress}</p>}
        </ReviewRow>
      </div>
    </Section>
  );
}

function ReviewRow({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-gray-light)",
        borderRadius: "var(--radius)",
        padding: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 200 }}>
        <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
          {title}
        </div>
        {children}
      </div>
      <Button type="button" variant="outline" onClick={onEdit}>
        Editar
      </Button>
    </div>
  );
}

function PartySummary({ party }: { party: PartyState }) {
  if (!party.legalName) return <p style={{ margin: 0, color: "var(--color-gray)" }}>Não preenchido</p>;
  return (
    <div>
      <p style={{ margin: 0, fontWeight: 600 }}>{party.legalName}</p>
      {party.cnpj && <p style={{ margin: "2px 0 0" }}>{formatCnpj(party.cnpj)}</p>}
      {party.address && <p style={{ margin: "2px 0 0", color: "var(--color-gray)" }}>{party.address}</p>}
    </div>
  );
}
